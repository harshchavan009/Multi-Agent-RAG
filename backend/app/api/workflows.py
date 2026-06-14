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
            if node_type == "webhook":
                # Webhook Validation
                source = node_config.get("source")
                if not source:
                    log_entry["validation"] = "Failed: Missing webhook source URL/topic configuration."
                    log_entry["status"] = "failed"
                    log_entry["output"] = "Webhook node execution skipped due to missing config."
                    execution_logs.append(log_entry)
                    success = False
                    continue
                
                # Execution
                log_entry["output"] = f"Triggered successfully via webhook topic: '{source}'."

            elif node_type == "agent":
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
                # Run the actual LangGraph multi-agent flow!
                result = execute_agent_workflow(
                    query=prompt,
                    workspace_id=str(workflow.workspace_id),
                    chat_id=uuid.uuid4(),
                    db=db,
                    selected_agent=agent_name
                )
                log_entry["output"] = f"Agent '{agent_name}' finished graph execution. Result: {result.get('response')}"

            elif node_type == "api":
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
                # Make real HTTP requests! Use a short timeout of 5.0s
                async with httpx.AsyncClient(timeout=5.0) as client:
                    if method == "GET":
                        res = await client.get(url)
                    elif method == "POST":
                        res = await client.post(url, json={"trigger": "workflow_engine"})
                    else:
                        res = await client.request(method, url)
                
                log_entry["output"] = f"HTTP request {method} {url} returned status code {res.status_code}. Content snippet: {res.text[:200]}"

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
                # Execute SQL statement command against PostgreSQL/SQLite session
                # Limit execution snippet for safety and log output
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

        # If a node execution fails, we stop the pipeline
        if log_entry["status"] == "failed":
            success = False
            break

    return {
        "workflow_id": str(workflow_id),
        "name": workflow.name,
        "success": success,
        "logs": execution_logs
    }
