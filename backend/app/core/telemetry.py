import threading
import time
from typing import Dict, Any, List

class TelemetryTracker:
    def __init__(self):
        self._lock = threading.Lock()
        self._agents = {
            "supervisor": {
                "id": "supervisor",
                "name": "Supervisor",
                "role": "Orchestration",
                "state": "idle",
                "task": "Standby — waiting for queries",
                "progress": 100,
                "tokens": 0,
                "latency": 0
            },
            "research": {
                "id": "research",
                "name": "Research Agent",
                "role": "Web Retrieval",
                "state": "idle",
                "task": "Standby — no research tasks",
                "progress": 100,
                "tokens": 0,
                "latency": 0
            },
            "rag": {
                "id": "rag",
                "name": "RAG Agent",
                "role": "Vector Search",
                "state": "idle",
                "task": "Standby — no RAG search requested",
                "progress": 100,
                "tokens": 0,
                "latency": 0
            },
            "analytics": {
                "id": "analytics",
                "name": "Analytics Agent",
                "role": "Data Processing",
                "state": "idle",
                "task": "Standby — analytics engine ready",
                "progress": 100,
                "tokens": 0,
                "latency": 0
            },
            "compliance": {
                "id": "compliance",
                "name": "Compliance Agent",
                "role": "Guardrails",
                "state": "idle",
                "task": "Standby — No guardrail violations detected",
                "progress": 100,
                "tokens": 0,
                "latency": 0
            },
            "report": {
                "id": "report",
                "name": "Report Agent",
                "role": "Output Generation",
                "state": "idle",
                "task": "Standby — output report generator idle",
                "progress": 100,
                "tokens": 0,
                "latency": 0
            },
        }
        self._workflows = {}  # maps workflow_id -> dict
        
        # Maps graph node name to dashboard ID
        self._agent_name_mapping = {
            "supervisor": "supervisor",
            "planner": "supervisor",
            "critic": "supervisor",
            "workflow_agent": "supervisor",
            "crew": "supervisor",
            "research": "research",
            "rag": "rag",
            "knowledge": "rag",
            "code": "analytics",
            "analytics": "analytics",
            "compliance": "compliance",
            "reporting": "report"
        }

    def set_agent_state(self, name_in_graph: str, state: str, task: str = "", progress: int = 0, tokens: int = 0, latency: int = 0):
        mapped_id = self._agent_name_mapping.get(name_in_graph.lower(), "supervisor")
        with self._lock:
            # If we set an agent to running, reset others to idle to focus on active state
            if state == "running":
                for k in self._agents:
                    if k != mapped_id and self._agents[k]["state"] == "running":
                        self._agents[k]["state"] = "idle"
                        self._agents[k]["progress"] = 100
            
            self._agents[mapped_id]["state"] = state
            if task:
                self._agents[mapped_id]["task"] = task
            self._agents[mapped_id]["progress"] = progress
            if tokens > 0:
                self._agents[mapped_id]["tokens"] = tokens
            if latency > 0:
                self._agents[mapped_id]["latency"] = latency

    def reset_agents(self):
        with self._lock:
            default_tasks = {
                "supervisor": "Standby — waiting for queries",
                "research": "Standby — no research tasks",
                "rag": "Standby — no RAG search requested",
                "analytics": "Standby — analytics engine ready",
                "compliance": "Standby — No guardrail violations detected",
                "report": "Standby — output report generator idle"
            }
            for k in self._agents:
                self._agents[k]["state"] = "idle"
                self._agents[k]["progress"] = 100
                self._agents[k]["task"] = default_tasks.get(k, "Standby")

    def get_agents_list(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(a) for a in self._agents.values()]

    def get_agents(self) -> Dict[str, Any]:
        with self._lock:
            return {k: dict(v) for k, v in self._agents.items()}

    def start_workflow(self, workflow_id: str, name: str, steps: int = 5):
        with self._lock:
            self._workflows[workflow_id] = {
                "id": workflow_id,
                "name": name,
                "status": "running",
                "progress": 0,
                "startedAt": "Just now",
                "duration": "~30s",
                "steps": steps,
                "stepsComplete": 0
            }

    def update_workflow(self, workflow_id: str, steps_complete: int, progress: int):
        with self._lock:
            if workflow_id in self._workflows:
                self._workflows[workflow_id]["stepsComplete"] = steps_complete
                self._workflows[workflow_id]["progress"] = progress

    def complete_workflow(self, workflow_id: str, success: bool = True):
        with self._lock:
            if workflow_id in self._workflows:
                self._workflows[workflow_id]["status"] = "completed" if success else "failed"
                self._workflows[workflow_id]["progress"] = 100
                self._workflows[workflow_id]["duration"] = "Completed"

    def get_workflows(self) -> List[Dict[str, Any]]:
        with self._lock:
            # Return last 5 workflows run
            return [dict(w) for w in self._workflows.values()][-5:]

telemetry_tracker = TelemetryTracker()
