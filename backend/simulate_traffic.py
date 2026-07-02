import time
import random
import uuid
from app.core.database import SessionLocal
from app.models.schemas import Message, AnalyticsLog, Evaluation, AuditLog, Document

# Default workspace ID
WORKSPACE_ID = uuid.UUID("5b6b042c-8c82-4ec7-9e38-2ae95a03c2a5")

print("Starting live traffic simulation on SQLite database...")
print("This will insert live messages, tokens, and logs every 2 seconds.")
print("Press CTRL+C to stop.")

db = SessionLocal()

# Find or create a chat session
from app.models.schemas import Chat, User
user = db.query(User).first()
if not user:
    # create a dummy user
    user = User(email="test@example.com", password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)

chat = db.query(Chat).filter(Chat.workspace_id == WORKSPACE_ID).first()
if not chat:
    chat = Chat(workspace_id=WORKSPACE_ID, user_id=user.id, title="Simulated Session")
    db.add(chat)
    db.commit()
    db.refresh(chat)

db.close()

agents = ["Supervisor Agent", "RAG Agent", "Research Agent", "Compliance Agent", "Analytics Agent"]

try:
    while True:
        db = SessionLocal()
        try:
            # 1. Insert a simulated user query message
            user_msg = Message(
                chat_id=chat.id,
                role="user",
                content=f"Simulated query {random.randint(100, 999)}"
            )
            db.add(user_msg)
            db.commit()
            
            # 2. Insert corresponding analytics log
            tokens = random.randint(400, 2500)
            cost = round(tokens * 0.000002, 6)
            latency = random.randint(120, 450)
            agent = random.choice(agents)
            
            log = AnalyticsLog(
                workspace_id=WORKSPACE_ID,
                query=user_msg.content,
                tokens_consumed=tokens,
                cost_usd=cost,
                latency_ms=latency,
                agent_visited=agent
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            
            # 3. Add an evaluation score
            eval_score = Evaluation(
                message_id=user_msg.id,
                groundedness_score=random.uniform(0.92, 1.0)
            )
            db.add(eval_score)
            
            # 4. Insert an audit log
            audit = AuditLog(
                organization_id=uuid.uuid4(),  # dummy organization
                user_id=user.id,
                action=f"Agent Visited: {agent}",
                details={"details": f"Processed query with {tokens} tokens in {latency}ms."}
            )
            db.add(audit)
            
            # 5. Occasionally process a simulated document upload status
            if random.random() > 0.7:
                doc = Document(
                    knowledge_base_id=uuid.uuid4(),
                    name=f"report_{random.randint(10, 99)}.pdf",
                    file_size=random.randint(100000, 5000000),
                    status=random.choice(["processing", "completed"])
                )
                db.add(doc)
            
            db.commit()
            print(f"Logged query: {user_msg.content} | Agent: {agent} | Tokens: {tokens} | Latency: {latency}ms")
            
        finally:
            db.close()
            
        time.sleep(2.0)

except KeyboardInterrupt:
    print("Traffic simulation stopped.")
