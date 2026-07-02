import os
import numpy as np
from uuid import UUID
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.schemas import AgentMemory, Message
from app.rag.pipeline import EmbeddingGenerator
from app.core.config import settings

class AgentMemorySystem:
    def __init__(self, db: Session, workspace_id: UUID, chat_id: Optional[UUID] = None):
        self.db = db
        self.workspace_id = workspace_id
        self.chat_id = chat_id
        self.embedding_gen = EmbeddingGenerator(provider="openai", api_key=settings.OPENAI_API_KEY)

    def extract_and_store_memories(self, user_query: str, assistant_response: str):
        """Extracts key facts, choices, or preferences from a conversation turn
        and saves them as workspace/long-term memory.
        """
        api_key = settings.OPENAI_API_KEY
        if not api_key or api_key.startswith("mock") or api_key.startswith("super-secret") or "••••" in api_key:
            # Fallback heuristic extractor
            self._heuristic_extract_and_store(user_query, assistant_response)
            return

        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            prompt = f"""
            You are a memory processor. Analyze this conversation turn:
            User: "{user_query}"
            Assistant: "{assistant_response}"
            
            Extract any permanent facts, user preferences, configurations, or workspace constraints mentioned.
            Respond only with a bulleted list of new facts (e.g. "* User prefers Python scripts over Javascript").
            If no permanent facts were mentioned, respond with "NONE". Do not include intro or outro text.
            """
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0
            )
            extracted = response.choices[0].message.content.strip()
            if "NONE" not in extracted:
                for line in extracted.split("\n"):
                    fact = line.strip().lstrip("* ").lstrip("- ").strip()
                    if fact:
                        self.save_memory(fact, memory_type="workspace_fact")
        except Exception as e:
            print(f"[Memory System Extraction Error] {e}")
            self._heuristic_extract_and_store(user_query, assistant_response)

    def _heuristic_extract_and_store(self, user_query: str, assistant_response: str):
        """Rule-based heuristic fallback to extract key facts."""
        q_lower = user_query.lower()
        if "use" in q_lower or "prefer" in q_lower or "setting" in q_lower or "policy" in q_lower:
            fact = f"User query context: '{user_query}'"
            self.save_memory(fact, memory_type="workspace_fact")

    def save_memory(self, content: str, memory_type: str = "workspace_fact") -> AgentMemory:
        """Saves a fact, preference, or summary to DB with vector embedding representation."""
        vector_list = self.embedding_gen.get_embedding(content)
        vector_str = ",".join(map(str, vector_list))

        new_mem = AgentMemory(
            workspace_id=self.workspace_id,
            chat_id=self.chat_id,
            memory_type=memory_type,
            content=content,
            vector=vector_str
        )
        self.db.add(new_mem)
        self.db.commit()
        self.db.refresh(new_mem)
        print(f"[Memory System] Saved '{memory_type}' memory: {content[:100]}...")
        return new_mem

    def search_semantic_memories(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Performs dynamic cosine similarity vector search over saved workspace/chat memories."""
        query_v = np.array(self.embedding_gen.get_embedding(query))
        
        # Load memories from active workspace
        memories = self.db.query(AgentMemory).filter(
            AgentMemory.workspace_id == self.workspace_id
        ).all()
        
        scored_memories = []
        for mem in memories:
            if not mem.vector:
                continue
            try:
                db_v = np.array(list(map(float, mem.vector.split(","))))
                dot_prod = np.dot(query_v, db_v)
                norm_q = np.linalg.norm(query_v)
                norm_db = np.linalg.norm(db_v)
                similarity = dot_prod / (norm_q * norm_db) if norm_q > 0 and norm_db > 0 else 0
                scored_memories.append({
                    "content": mem.content,
                    "type": mem.memory_type,
                    "similarity": float(similarity),
                    "created_at": mem.created_at.isoformat()
                })
            except Exception:
                pass
                
        # Sort by similarity descending
        scored_memories.sort(key=lambda x: x["similarity"], reverse=True)
        return scored_memories[:limit]

    def compress_memories(self):
        """Consolidates/compresses memories when workspace facts grow to prevent context bloat."""
        memories = self.db.query(AgentMemory).filter(
            AgentMemory.workspace_id == self.workspace_id,
            AgentMemory.memory_type == "workspace_fact"
        ).all()
        
        if len(memories) < 10:
            return # No compression needed yet
            
        facts_text = "\n".join([f"- {m.content}" for m in memories])
        
        api_key = settings.OPENAI_API_KEY
        consolidated = ""
        if api_key and not api_key.startswith("mock") and not api_key.startswith("super-secret") and "••••" not in api_key:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                prompt = f"""
                Consolidate these workspace facts into a single concise list of max 3 high-level core rules/preferences:
                {facts_text}
                
                Respond with the consolidated rules only. Do not include intros or outros.
                """
                res = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1
                )
                consolidated = res.choices[0].message.content.strip()
            except Exception:
                pass
                
        if not consolidated:
            # Fallback manual compression
            consolidated = f"Consolidated list of {len(memories)} facts including: " + "; ".join([m.content[:50] for m in memories[:3]])

        # Delete older facts
        for m in memories:
            self.db.delete(m)
        self.db.commit()
        
        # Save consolidated rule
        self.save_memory(consolidated, memory_type="workspace_fact")
        print(f"[Memory System] Completed fact compression.")

    def compile_chat_history_buffer(self, limit: int = 10) -> str:
        """Compiles the conversation short-term memory buffer (chat history) into a prompt segment."""
        if not self.chat_id:
            return ""
            
        messages = self.db.query(Message).filter(
            Message.chat_id == self.chat_id
        ).order_by(Message.created_at.asc()).all()
        
        history_lines = []
        for msg in messages[-limit:]:
            role_label = "User" if msg.role == "user" else "Assistant"
            history_lines.append(f"{role_label}: {msg.content}")
            
        return "\n".join(history_lines)
