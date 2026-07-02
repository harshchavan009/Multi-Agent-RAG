from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.schemas import (
    Prompt, PromptCreate, PromptResponse,
    Experiment, ExperimentCreate, ExperimentResponse,
    AnalyticsLog, Evaluation, Message
)
from app.api.chats import get_current_user_email
from app.core.langfuse_integration import sync_prompts_from_langfuse

router = APIRouter(prefix="/llmops", tags=["llmops"])

# ==========================================================
# 1. PROMPT REGISTRY ENDPOINTS
# ==========================================================

@router.get("/prompts", response_model=List[PromptResponse])
def list_prompts(
    workspace_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Lists all prompts and versions in a workspace.
    """
    prompts = db.query(Prompt).filter(
        Prompt.workspace_id == workspace_id
    ).order_by(Prompt.name, Prompt.version.desc()).all()
    
    # If empty, pre-populate default prompts for a better experience
    if not prompts:
        defaults = [
            {
                "name": "rag_synthesis",
                "content": """You are a helpful enterprise knowledge assistant. Answer the user query based ONLY on the provided document context. If the context does not contain the answer, say "I could not find the answer in the provided document context."

Context:
{context_str}

Query: {query}
Answer:"""
            },
            {
                "name": "kg_translation",
                "content": """You are an expert system that translates natural language queries into Cypher queries for a Neo4j Graph Database.
The database schema has:
- Nodes: Employee, Organization, Project, Department, Product, Policy
- Relationships:
  - Employee -[:belongs_to]-> Department
  - Project -[:managed_by]-> Employee

Translate the user's question into a Cypher query. Return ONLY the Cypher query. No explanation, no markdown wrap."""
            }
        ]
        for d in defaults:
            new_prompt = Prompt(
                workspace_id=workspace_id,
                name=d["name"],
                version=1,
                content=d["content"],
                is_active=True
            )
            db.add(new_prompt)
        db.commit()
        prompts = db.query(Prompt).filter(
            Prompt.workspace_id == workspace_id
        ).order_by(Prompt.name, Prompt.version.desc()).all()
        
    return prompts

@router.post("/prompts", response_model=PromptResponse)
def create_prompt_version(
    payload: PromptCreate,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Registers a new version of a prompt in the workspace.
    If is_active is set to True, it deactivates all other versions of the same prompt name.
    """
    # Determine the next version number
    max_v = db.query(Prompt).filter(
        Prompt.workspace_id == payload.workspace_id,
        Prompt.name == payload.name
    ).order_by(Prompt.version.desc()).first()
    
    next_version = (max_v.version + 1) if max_v else 1
    
    if payload.is_active:
        # Deactivate others of same name in this workspace
        db.query(Prompt).filter(
            Prompt.workspace_id == payload.workspace_id,
            Prompt.name == payload.name
        ).update({"is_active": False})
        
    new_prompt = Prompt(
        workspace_id=payload.workspace_id,
        name=payload.name,
        version=next_version,
        content=payload.content,
        is_active=payload.is_active
    )
    db.add(new_prompt)
    db.commit()
    db.refresh(new_prompt)
    return new_prompt

@router.post("/prompts/{name}/activate")
def activate_prompt_version(
    name: str,
    workspace_id: uuid.UUID = Query(...),
    version: int = Query(...),
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Sets a specific version of a prompt to active and disables other versions of the same name.
    """
    # Check if target prompt exists
    target = db.query(Prompt).filter(
        Prompt.workspace_id == workspace_id,
        Prompt.name == name,
        Prompt.version == version
    ).first()
    
    if not target:
        raise HTTPException(status_code=404, detail=f"Prompt version {version} not found.")
        
    # Deactivate all versions of this prompt
    db.query(Prompt).filter(
        Prompt.workspace_id == workspace_id,
        Prompt.name == name
    ).update({"is_active": False})
    
    # Activate target
    target.is_active = True
    db.commit()
    db.refresh(target)
    return {"message": f"Prompt '{name}' version {version} successfully activated.", "prompt": target}

@router.delete("/prompts/{name}/version/{version}")
def delete_prompt_version(
    name: str,
    version: int,
    workspace_id: uuid.UUID = Query(...),
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Deletes a specific prompt version.
    """
    target = db.query(Prompt).filter(
        Prompt.workspace_id == workspace_id,
        Prompt.name == name,
        Prompt.version == version
    ).first()
    
    if not target:
        raise HTTPException(status_code=404, detail="Prompt version not found.")
        
    db.delete(target)
    db.commit()
    return {"message": f"Prompt '{name}' version {version} removed successfully."}

@router.post("/prompts/sync")
def sync_with_langfuse(
    workspace_id: uuid.UUID = Query(...),
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Sync prompt templates from Langfuse Prompt Registry.
    """
    result = sync_prompts_from_langfuse(db, workspace_id)
    return result


# ==========================================================
# 2. A/B TESTING EXPERIMENTS ENDPOINTS
# ==========================================================

@router.get("/experiments", response_model=List[ExperimentResponse])
def list_experiments(
    workspace_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    List all A/B testing experiments configured in a workspace.
    """
    return db.query(Experiment).filter(
        Experiment.workspace_id == workspace_id
    ).order_by(Experiment.created_at.desc()).all()

@router.post("/experiments", response_model=ExperimentResponse)
def create_experiment(
    payload: ExperimentCreate,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Create a new A/B testing experiment in draft mode.
    """
    new_exp = Experiment(
        workspace_id=payload.workspace_id,
        name=payload.name,
        status="draft",
        model_a=payload.model_a,
        model_b=payload.model_b,
        prompt_a_id=payload.prompt_a_id,
        prompt_b_id=payload.prompt_b_id,
        traffic_split_a=payload.traffic_split_a
    )
    db.add(new_exp)
    db.commit()
    db.refresh(new_exp)
    return new_exp

@router.put("/experiments/{experiment_id}", response_model=ExperimentResponse)
def update_experiment(
    experiment_id: uuid.UUID,
    payload: ExperimentCreate,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Update an experiment definition.
    If the status transitions to 'active', all other active experiments in this workspace are set to 'ended'.
    """
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
        
    # Check if activating
    if payload.status == "active" and exp.status != "active":
        # Deactivate all other active experiments in this workspace
        db.query(Experiment).filter(
            Experiment.workspace_id == exp.workspace_id,
            Experiment.id != experiment_id,
            Experiment.status == "active"
        ).update({"status": "ended"})
        
    exp.name = payload.name
    exp.status = payload.status
    exp.model_a = payload.model_a
    exp.model_b = payload.model_b
    exp.prompt_a_id = payload.prompt_a_id
    exp.prompt_b_id = payload.prompt_b_id
    exp.traffic_split_a = payload.traffic_split_a
    
    db.commit()
    db.refresh(exp)
    return exp

@router.delete("/experiments/{experiment_id}")
def delete_experiment(
    experiment_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Remove an experiment.
    """
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
        
    db.delete(exp)
    db.commit()
    return {"message": "Experiment deleted successfully"}


@router.get("/experiments/{experiment_id}/metrics")
def get_experiment_metrics(
    experiment_id: uuid.UUID,
    email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """
    Fetches comparative analysis metrics between Variant A and Variant B for an experiment.
    Queries the AnalyticsLog and Evaluation tables to output side-by-side stats.
    """
    # 1. Variant A Analytics Stats
    calls_a = db.query(AnalyticsLog).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "A"
    ).count()
    
    avg_latency_a = db.query(func.avg(AnalyticsLog.latency_ms)).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "A"
    ).scalar() or 0.0
    
    total_tokens_a = db.query(func.sum(AnalyticsLog.tokens_consumed)).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "A"
    ).scalar() or 0
    
    total_cost_a = db.query(func.sum(AnalyticsLog.cost_usd)).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "A"
    ).scalar() or 0.0
    
    evals_a = db.query(
        func.avg(Evaluation.groundedness_score),
        func.avg(Evaluation.faithfulness_score),
        func.avg(Evaluation.hallucination_score)
    ).join(Message, Message.id == Evaluation.message_id).filter(
        Message.experiment_id == experiment_id,
        Message.variant == "A"
    ).first()

    # 2. Variant B Analytics Stats
    calls_b = db.query(AnalyticsLog).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "B"
    ).count()
    
    avg_latency_b = db.query(func.avg(AnalyticsLog.latency_ms)).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "B"
    ).scalar() or 0.0
    
    total_tokens_b = db.query(func.sum(AnalyticsLog.tokens_consumed)).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "B"
    ).scalar() or 0
    
    total_cost_b = db.query(func.sum(AnalyticsLog.cost_usd)).filter(
        AnalyticsLog.experiment_id == experiment_id,
        AnalyticsLog.variant == "B"
    ).scalar() or 0.0
    
    evals_b = db.query(
        func.avg(Evaluation.groundedness_score),
        func.avg(Evaluation.faithfulness_score),
        func.avg(Evaluation.hallucination_score)
    ).join(Message, Message.id == Evaluation.message_id).filter(
        Message.experiment_id == experiment_id,
        Message.variant == "B"
    ).first()

    # If the experiment has no execution traces yet (e.g. fresh creation),
    # return a structured comparative payload
    return {
        "variant_a": {
            "calls": calls_a,
            "avg_latency_ms": round(float(avg_latency_a), 1),
            "total_tokens": int(total_tokens_a),
            "total_cost_usd": round(float(total_cost_a), 6),
            "groundedness": round(float(evals_a[0]), 2) if evals_a and evals_a[0] is not None else 0.00,
            "faithfulness": round(float(evals_a[1]), 2) if evals_a and evals_a[1] is not None else 0.00,
            "hallucination": round(float(evals_a[2]), 2) if evals_a and evals_a[2] is not None else 0.00
        },
        "variant_b": {
            "calls": calls_b,
            "avg_latency_ms": round(float(avg_latency_b), 1),
            "total_tokens": int(total_tokens_b),
            "total_cost_usd": round(float(total_cost_b), 6),
            "groundedness": round(float(evals_b[0]), 2) if evals_b and evals_b[0] is not None else 0.00,
            "faithfulness": round(float(evals_b[1]), 2) if evals_b and evals_b[1] is not None else 0.00,
            "hallucination": round(float(evals_b[2]), 2) if evals_b and evals_b[2] is not None else 0.00
        }
    }
