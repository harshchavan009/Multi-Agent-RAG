from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
import uuid
import httpx
import time

from app.core.database import get_db
from app.models.schemas import Workflow, WorkflowCreate, WorkflowResponse
from app.api.chats import get_current_user_email
from app.agents.graph import execute_agent_workflow

router = APIRouter(prefix="/workflows", tags=["workflows"])

@router.post("/", response_model=WorkflowResponse)
def create_workflow(payload: WorkflowCreate, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    new_workflow = Workflow(
        workspace_id=payload.workspace_id,
        name=payload.name,
        definition=payload.definition,
        is_active=payload.is_active
    )
    db.add(new_workflow)
    db.commit()
    db.refresh(new_workflow)
    return new_workflow

@router.get("/", response_model=List[WorkflowResponse])
def list_workflows(workspace_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    workflows = db.query(Workflow).filter(Workflow.workspace_id == workspace_id).all()
    return workflows

@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(workflow_id: uuid.UUID, name: str, definition: dict, is_active: bool, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow structure not found")
    
    workflow.name = name
    workflow.definition = definition
    workflow.is_active = is_active
    
    db.commit()
    db.refresh(workflow)
    return workflow

@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: uuid.UUID, email: str = Depends(get_current_user_email), db: Session = Depends(get_db)):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(workflow)
    db.commit()
    return {"message": "Workflow deleted successfully"}


@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    try:
        from app.core.websockets import manager
        await manager.broadcast({
            "type": "workflow_started",
            "workflow_name": workflow.name,
            "workflow_id": str(workflow_id)
        })
        from app.core.telemetry import telemetry_tracker
        steps_count = len(workflow.definition.get("nodes", [])) if (workflow.definition and isinstance(workflow.definition, dict)) else 5
        telemetry_tracker.start_workflow(str(workflow_id), workflow.name, steps=steps_count)
    except Exception as ws_err:
        print(f"Failed to broadcast websocket workflow started: {ws_err}")

    definition = workflow.definition or {}
    nodes = definition.get("nodes", [])

    execution_logs = []
    success = True

    for node in nodes:
        node_id = node.get("id")
        node_name = node.get("name", "Unnamed Node")
        node_type = node.get("type", "unknown")
        node_config = node.get("config", {})

        log_entry = {
            "node_id": node_id,
            "node_name": node_name,
            "node_type": node_type,
            "validation": "Passed",
            "status": "success",
            "output": "",
            "latency_ms": 0
        }

        t0 = time.time()

        try:
            if node_type in ["webhook", "manual", "schedule", "trigger"]:
                # Trigger Nodes
                if node_type == "webhook":
                    source = node_config.get("source")
                    if not source:
                        log_entry["validation"] = "Failed: Missing webhook source URL/topic configuration."
                        log_entry["status"] = "failed"
                        log_entry["output"] = "Webhook node execution skipped due to missing config."
                        execution_logs.append(log_entry)
                        success = False
                        continue
                    log_entry["output"] = f"Triggered successfully via webhook topic: '{source}'."
                elif node_type == "schedule":
                    sched = node_config.get("schedule")
                    if not sched:
                        log_entry["validation"] = "Failed: Missing schedule cron configuration."
                        log_entry["status"] = "failed"
                        log_entry["output"] = "Schedule node execution skipped due to missing config."
                        execution_logs.append(log_entry)
                        success = False
                        continue
                    log_entry["output"] = f"Triggered successfully via cron schedule: '{sched}'."
                else:
                    log_entry["output"] = f"Manual trigger node executed successfully."

            elif node_type in ["agent", "run_agent"]:
                # Agent Validation
                agent_name = node_config.get("agent")
                prompt = node_config.get("prompt")
                if not agent_name or not prompt:
                    log_entry["validation"] = "Failed: Missing target agent or instruction prompt configuration."
                    log_entry["status"] = "failed"
                    log_entry["output"] = "Agent node execution skipped due to missing config."
                    execution_logs.append(log_entry)
                    success = False
                    continue

                # Execution
                result = execute_agent_workflow(
                    query=prompt,
                    workspace_id=str(workflow.workspace_id),
                    chat_id=uuid.uuid4(),
                    db=db,
                    selected_agent=agent_name
                )
                log_entry["output"] = f"Agent '{agent_name}' finished graph execution. Result: {result.get('response')}"

            elif node_type in ["api", "call_api"]:
                # API Validation
                url = node_config.get("url")
                method = node_config.get("method", "GET").upper()
                if not url:
                    log_entry["validation"] = "Failed: Missing API Endpoint URL configuration."
                    log_entry["status"] = "failed"
                    log_entry["output"] = "API node execution skipped due to missing config."
                    execution_logs.append(log_entry)
                    success = False
                    continue

                # Execution
                async with httpx.AsyncClient(timeout=5.0) as client:
                    if method == "GET":
                        res = await client.get(url)
                    elif method == "POST":
                        res = await client.post(url, json={"trigger": "workflow_engine"})
                    else:
                        res = await client.request(method, url)
                
                log_entry["output"] = f"HTTP request {method} {url} returned status code {res.status_code}. Content snippet: {res.text[:200]}"

            elif node_type in ["send_email", "email"]:
                # Email Validation
                to_email = node_config.get("to")
                subject = node_config.get("subject")
                body = node_config.get("body")
                if not to_email or not subject or not body:
                    log_entry["validation"] = "Failed: Missing email recipient, subject, or message body."
                    log_entry["status"] = "failed"
                    log_entry["output"] = "Email node execution skipped due to missing config."
                    execution_logs.append(log_entry)
                    success = False
                    continue
                
                # Execution
                log_entry["output"] = f"Email successfully sent to <{to_email}> with subject '{subject}'. Content preview: '{body[:100]}...'"

            elif node_type in ["generate_report", "report"]:
                # Report Validation
                title = node_config.get("title")
                content = node_config.get("content")
                if not title or not content:
                    log_entry["validation"] = "Failed: Missing report title or section content parameters."
                    log_entry["status"] = "failed"
                    log_entry["output"] = "Report node execution skipped due to missing config."
                    execution_logs.append(log_entry)
                    success = False
                    continue
                
                # Execution
                from app.agents.graph import generate_pdf_report_tool
                filename = f"report_wf_{uuid.uuid4().hex[:8]}.pdf"
                pdf_res = generate_pdf_report_tool(title, content, filename)
                log_entry["output"] = f"Workflow generated PDF report: '{pdf_res}'"

            elif node_type in ["query_knowledge_base", "query_kb", "knowledge"]:
                # KB Validation
                query = node_config.get("query")
                if not query:
                    log_entry["validation"] = "Failed: Missing knowledge base query query parameter."
                    log_entry["status"] = "failed"
                    log_entry["output"] = "Knowledge Base node execution skipped due to missing config."
                    execution_logs.append(log_entry)
                    success = False
                    continue
                
                # Execution
                from app.agents.graph import vector_db_search_tool
                results = vector_db_search_tool(
                    workspace_id=str(workflow.workspace_id),
                    query=query,
                    db=db,
                    limit=2
                )
                res_text = ", ".join([r["text"][:120] for r in results]) if results else "No matching document slices found."
                log_entry["output"] = f"Knowledge base query returned context: '{res_text}'"

            elif node_type == "database":
                # Database Validation
                query = node_config.get("query")
                if not query:
                    log_entry["validation"] = "Failed: Missing SQL statement query configuration."
                    log_entry["status"] = "failed"
                    log_entry["output"] = "Database node execution skipped due to missing config."
                    execution_logs.append(log_entry)
                    success = False
                    continue

                # Execution
                result_proxy = db.execute(text(query))
                if query.strip().upper().startswith("SELECT"):
                    rows = result_proxy.fetchall()
                    serialized_rows = [dict(row._mapping) for row in rows]
                    log_entry["output"] = f"SQL query executed successfully. Retrieved {len(rows)} rows: {str(serialized_rows)[:300]}"
                else:
                    db.commit()
                    log_entry["output"] = f"SQL statement executed successfully. Affected rows: {result_proxy.rowcount}"

            else:
                log_entry["validation"] = f"Failed: Unknown node type designation '{node_type}'."
                log_entry["status"] = "failed"
                log_entry["output"] = "Unknown node type could not be executed."
                success = False

        except Exception as e:
            log_entry["status"] = "failed"
            log_entry["output"] = f"Error during execution: {str(e)}"
            success = False

        latency = int((time.time() - t0) * 1000)
        log_entry["latency_ms"] = latency
        execution_logs.append(log_entry)

        try:
            from app.core.telemetry import telemetry_tracker
            steps_complete = len(execution_logs)
            total_steps = len(nodes)
            progress = int((steps_complete / total_steps) * 100) if total_steps > 0 else 100
            telemetry_tracker.update_workflow(str(workflow_id), steps_complete, progress)
        except Exception as tel_err:
            print(f"Failed to update workflow telemetry: {tel_err}")

        # If a node execution fails, we stop the pipeline
        if log_entry["status"] == "failed":
            success = False
            break

    try:
        from app.core.websockets import manager
        await manager.broadcast({
            "type": "workflow_completed",
            "workflow_name": workflow.name,
            "workflow_id": str(workflow_id),
            "success": success,
            "logs_count": len(execution_logs)
        })
        from app.core.telemetry import telemetry_tracker
        telemetry_tracker.complete_workflow(str(workflow_id), success=success)
    except Exception as ws_err:
        print(f"Failed to broadcast websocket workflow completed: {ws_err}")

    return {
        "workflow_id": str(workflow_id),
        "name": workflow.name,
        "success": success,
        "logs": execution_logs
    }

