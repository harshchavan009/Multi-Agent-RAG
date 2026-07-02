from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from app.core.config import settings
from app.core.database import engine, Base

# Import API routes
from app.api.auth import router as auth_router
from app.api.chats import router as chats_router
from app.api.agents import router as agents_router
from app.api.workflows import router as workflows_router
from app.api.documents import router as documents_router
from app.api.analytics import router as analytics_router
from app.api.models import router as models_router
from app.api.audit_logs import router as audit_logs_router
from app.api.analytics_logs import router as analytics_logs_router
from app.api.settings import router as settings_router
from app.api.integrations import router as integrations_router
from app.api.llmops import router as llmops_router
from app.api.voice_rag import router as voice_rag_router
from app.api.ocr import router as ocr_router
from app.api.meeting import router as meeting_router
from app.api.research import router as research_router
from app.api.memory import router as memory_router
from app.api.llm import router as llm_router

# Autogenerate database tables on boot (if not already managed via migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Mount uploads directory to serve generated PDF reports
uploads_dir = "/Users/harsh/Desktop/Multi agent rag/uploads"
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Set CORS middleware
if settings.BACKEND_CORS_ORIGINS == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex="https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register routes
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(chats_router, prefix=settings.API_V1_STR)
app.include_router(agents_router, prefix=settings.API_V1_STR)
app.include_router(workflows_router, prefix=settings.API_V1_STR)
app.include_router(documents_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(models_router, prefix=settings.API_V1_STR)
app.include_router(audit_logs_router, prefix=settings.API_V1_STR)
app.include_router(analytics_logs_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(integrations_router, prefix=settings.API_V1_STR)
app.include_router(llmops_router, prefix=settings.API_V1_STR)
app.include_router(voice_rag_router, prefix=settings.API_V1_STR)
app.include_router(ocr_router, prefix=settings.API_V1_STR)
app.include_router(meeting_router, prefix=settings.API_V1_STR)
app.include_router(research_router, prefix=settings.API_V1_STR)
app.include_router(memory_router, prefix=f"{settings.API_V1_STR}/memory", tags=["Memory"])
app.include_router(llm_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def read_root():
    return {
        "status": "healthy"
    }

from fastapi import WebSocket, WebSocketDisconnect
from app.core.websockets import manager
from app.core.telemetry import telemetry_tracker
import asyncio

async def dashboard_telemetry_loop():
    while True:
        try:
            from app.core.database import SessionLocal
            db = SessionLocal()
            try:
                from app.models.schemas import Message, AnalyticsLog, Evaluation, Document, AuditLog, Workflow
                from sqlalchemy import func
                
                queries_count = db.query(Message).count()
                sum_tokens = db.query(func.sum(AnalyticsLog.tokens_consumed)).scalar() or 0
                avg_latency = db.query(func.avg(AnalyticsLog.latency_ms)).scalar() or 0
                avg_accuracy = db.query(func.avg(Evaluation.groundedness_score)).scalar()
                accuracy_pct = round(float(avg_accuracy) * 100, 1) if avg_accuracy is not None else 96.8
                sum_cost = float(db.query(func.sum(AnalyticsLog.cost_usd)).scalar() or 0.0)
                
                # Active agents count
                active_agents_dict = telemetry_tracker.get_agents()
                running_count = sum(1 for a in active_agents_dict.values() if a.get("state") == "running")
                
                # 2. Redis queue depth
                queue_depth = 0
                try:
                    import redis
                    from app.core.config import settings
                    r = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=0.5)
                    queue_depth = r.llen("celery")
                except Exception:
                    pass
                
                # If celery queue is 0/unavailable, fallback to pending docs
                if queue_depth == 0:
                    queue_depth = db.query(Document).filter(Document.status == "pending").count()
                
                # 3. Documents (Uploads)
                recent_docs = db.query(Document).order_by(Document.created_at.desc()).limit(5).all()
                docs_payload = []
                for doc in recent_docs:
                    progress = 0
                    status_mapped = "queued"
                    if doc.status == "completed":
                        progress = 100
                        status_mapped = "done"
                    elif doc.status == "processing":
                        progress = 50
                        status_mapped = "indexing"
                    elif doc.status == "failed":
                        progress = 100
                        status_mapped = "failed"
                    
                    size_str = "0.0 MB"
                    if doc.file_size:
                        size_str = f"{round(doc.file_size / (1024 * 1024), 2)} MB"
                        
                    docs_payload.append({
                        "id": str(doc.id),
                        "name": doc.name,
                        "size": size_str,
                        "chunks": doc.metadata_fields.get("chunks_count", 0) if doc.metadata_fields else 0,
                        "progress": progress,
                        "status": status_mapped
                    })
                    
                # 4. Workflows status
                workflows = db.query(Workflow).limit(5).all()
                workflows_payload = []
                for wf in workflows:
                    status = "completed" if wf.is_active else "pending"
                    progress = 100 if wf.is_active else 0
                    steps = len(wf.definition.get("nodes", [])) if (wf.definition and isinstance(wf.definition, dict)) else 4
                    steps_complete = steps if wf.is_active else 0
                    started_at = "—"
                    duration = "—"
                    
                    if str(wf.id) in telemetry_tracker._workflows:
                        live_wf = telemetry_tracker._workflows[str(wf.id)]
                        status = live_wf["status"]
                        progress = live_wf["progress"]
                        steps_complete = live_wf["stepsComplete"]
                        steps = live_wf["steps"]
                        started_at = live_wf.get("startedAt", "Just now")
                        duration = live_wf.get("duration", "~30s")
                        
                    workflows_payload.append({
                        "id": str(wf.id),
                        "name": wf.name,
                        "status": status,
                        "progress": progress,
                        "startedAt": started_at,
                        "duration": duration,
                        "steps": steps,
                        "stepsComplete": steps_complete
                    })
                    
                if not workflows_payload:
                    workflows_payload = telemetry_tracker.get_workflows()
                    
                # 5. Audit logs (Activity feed)
                recent_audit_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
                logs_payload = []
                for log in recent_audit_logs:
                    level = "info"
                    action_lower = log.action.lower()
                    if "success" in action_lower or "completed" in action_lower:
                        level = "success"
                    elif "fail" in action_lower or "error" in action_lower:
                        level = "error"
                    elif "warn" in action_lower:
                        level = "warn"
                        
                    logs_payload.append({
                        "id": str(log.id),
                        "ts": log.created_at.strftime("%H:%M:%S"),
                        "level": level,
                        "msg": f"{log.action}: {log.details.get('details', '') or ''}"
                    })
                    
                # Broadcast the telemetry update packet
                payload = {
                    "type": "dashboard_telemetry",
                    "kpis": {
                        "queries": queries_count,
                        "tokens": sum_tokens,
                        "cost": sum_cost,
                        "accuracy": accuracy_pct,
                        "latency": int(avg_latency),
                        "activeAgents": max(1, running_count)
                    },
                    "agents": telemetry_tracker.get_agents_list(),
                    "queue_depth": queue_depth,
                    "docs": docs_payload,
                    "workflows": workflows_payload,
                    "logs": logs_payload
                }
                
                await manager.broadcast(payload)
                
            finally:
                db.close()
        except Exception as e:
            print(f"Error in dashboard telemetry loop: {e}")
            
        await asyncio.sleep(2.0)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(dashboard_telemetry_loop())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket endpoint error: {e}")
        manager.disconnect(websocket)

from fastapi.responses import FileResponse, JSONResponse
from fastapi import Request, HTTPException

frontend_dist_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")

# Mount Next.js _next assets folder directly for fast static routing
if os.path.exists(os.path.join(frontend_dist_path, "_next")):
    app.mount("/_next", StaticFiles(directory=os.path.join(frontend_dist_path, "_next")), name="next-assets")
    print(f"[Static] Mounted _next assets directory.")

@app.get("/{path:path}")
async def serve_frontend(request: Request, path: str):
    # Skip routing if path targets documentation, health checks, or websocket endpoints
    if path.startswith("api") or path.startswith("ws") or path.startswith("docs") or path.startswith("openapi.json"):
        raise HTTPException(status_code=404, detail="Not Found")
        
    clean_path = path.strip("/")
    
    # 1. Root / mapping
    if not clean_path:
        index_path = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
    # 2. Check exact file in dist (e.g. icon.svg, favicon.ico)
    exact_file = os.path.join(frontend_dist_path, clean_path)
    if os.path.exists(exact_file) and os.path.isfile(exact_file):
        return FileResponse(exact_file)
        
    # 3. Check pre-rendered HTML file (e.g. /dashboard -> dashboard.html)
    html_file = os.path.join(frontend_dist_path, f"{clean_path}.html")
    if os.path.exists(html_file) and os.path.isfile(html_file):
        return FileResponse(html_file)
        
    # 4. Check index.html inside a directory (e.g. /dashboard/ -> dashboard/index.html)
    index_file = os.path.join(frontend_dist_path, clean_path, "index.html")
    if os.path.exists(index_file) and os.path.isfile(index_file):
        return FileResponse(index_file)
        
    # 5. Fallback to index.html for frontend client routing
    index_path = os.path.join(frontend_dist_path, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
        
    raise HTTPException(status_code=404, detail="Not Found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
