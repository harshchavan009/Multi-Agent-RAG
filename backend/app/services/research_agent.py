"""
Autonomous Research Agent Service
Orchestrates: Web Research → KB Search → LLM Synthesis → PDF → Email
"""
import os
import uuid
import json
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings


# ========================================================
# STEP FUNCTIONS
# ========================================================

def _research_web(query: str, api_key: Optional[str] = None) -> str:
    """Simulate web research (uses mock unless external search API configured)."""
    from app.agents.graph import web_research_tool
    print(f"[Research Agent] Web research for: '{query}'")
    return web_research_tool(query)


def _search_knowledge_base(query: str, workspace_id: str, db: Session, api_key: Optional[str] = None) -> str:
    """Search the workspace vector KB for relevant context."""
    from app.agents.graph import vector_db_search_tool
    results = vector_db_search_tool(workspace_id, query, db, limit=5, openai_api_key=api_key)
    if results:
        return "\n".join([f"- {r['text'][:300]}" for r in results])
    return "No documents found in the knowledge base for this query."


def _synthesize_report(query: str, web_research: str, kb_context: str, api_key: Optional[str] = None) -> str:
    """Use LLM to synthesize a comparison/research report in markdown."""
    resolved_key = api_key or os.getenv("OPENAI_API_KEY", "")
    is_real_key = resolved_key and not resolved_key.startswith("super-secret") and "mock" not in resolved_key.lower()

    if is_real_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=resolved_key)
            prompt = f"""You are an expert research analyst. Based on the following research data, 
create a comprehensive, well-structured research report in markdown format.

## User Research Query
{query}

## Web Research Findings
{web_research}

## Internal Knowledge Base Context
{kb_context}

Write a detailed, professional research report with the following sections:
1. Executive Summary
2. Key Findings
3. Detailed Analysis  
4. Comparison Table (if applicable)
5. Recommendations
6. Conclusion

Use markdown formatting with headers, bullet points, and tables where appropriate."""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=3000,
                temperature=0.3
            )
            report = response.choices[0].message.content or ""
            print(f"[Research Agent] LLM synthesis complete. Report length: {len(report)} chars")
            return report
        except Exception as e:
            print(f"[Research Agent] LLM synthesis failed: {e}. Using mock report.")

    # Mock report
    return _mock_research_report(query, web_research, kb_context)


def _generate_pdf(title: str, content: str, task_id: str) -> str:
    """Generate PDF report from synthesized content."""
    from app.agents.graph import generate_pdf_report_tool
    filename = f"research_{task_id[:8]}.pdf"
    result = generate_pdf_report_tool(title, content, filename)
    print(f"[Research Agent] PDF generation result: {result}")
    return filename


def _send_email(to_email: str, subject: str, body: str, pdf_filename: Optional[str] = None) -> bool:
    """Send research report via email (SMTP)."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")

    if not smtp_host or not smtp_user:
        print(f"[Research Agent] SMTP not configured. Would have sent email to: {to_email}")
        print(f"[Research Agent] Subject: {subject}")
        return True  # Return True in mock mode

    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.base import MIMEBase
        from email import encoders

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "html"))

        # Attach PDF if present
        if pdf_filename:
            uploads_dir = "/Users/harsh/Desktop/Multi agent rag/uploads"
            pdf_path = os.path.join(uploads_dir, pdf_filename)
            if os.path.exists(pdf_path):
                with open(pdf_path, "rb") as f:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", f"attachment; filename={pdf_filename}")
                    msg.attach(part)

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        print(f"[Research Agent] Email successfully sent to {to_email}")
        return True
    except Exception as e:
        print(f"[Research Agent] Email sending failed: {e}")
        return False


# ========================================================
# MAIN ORCHESTRATOR
# ========================================================

def run_autonomous_research(
    task_id: str,
    query: str,
    workspace_id: str,
    email_to: Optional[str],
    db: Session
) -> dict:
    """
    Full autonomous research pipeline:
    1. Web Research
    2. KB Search
    3. LLM Synthesis
    4. PDF Generation
    5. Email Delivery
    Returns a result dict with all step outputs.
    """
    from app.models.schemas import ResearchTask
    from app.core.database import SessionLocal

    db_local = SessionLocal()
    try:
        task = db_local.query(ResearchTask).filter(ResearchTask.id == uuid.UUID(task_id)).first()
        if task:
            task.status = "running"
            db_local.commit()

        steps = {}

        # Step 1: Web Research
        web_result = _research_web(query)
        steps["web_research"] = web_result

        # Step 2: KB Search
        kb_result = _search_knowledge_base(query, workspace_id, db_local)
        steps["kb_context"] = kb_result

        # Step 3: LLM Synthesis
        api_key = os.getenv("OPENAI_API_KEY")
        if task:
            # Try to get workspace key
            try:
                from app.models.schemas import WorkspaceSettings
                import uuid as _uuid
                ws_settings = db_local.query(WorkspaceSettings).filter(
                    WorkspaceSettings.workspace_id == _uuid.UUID(workspace_id)
                ).first()
                if ws_settings and ws_settings.openai_api_key:
                    api_key = ws_settings.openai_api_key
            except Exception:
                pass

        report_md = _synthesize_report(query, web_result, kb_result, api_key)
        steps["report_markdown"] = report_md

        # Step 4: PDF Generation
        report_title = f"Autonomous Research Report: {query[:80]}"
        pdf_filename = _generate_pdf(report_title, report_md, task_id)
        steps["pdf_filename"] = pdf_filename

        # Step 5: Email
        email_sent = False
        if email_to:
            email_body = f"""
<html><body>
<h2>🔬 Autonomous Research Report</h2>
<p><strong>Query:</strong> {query}</p>
<p>Your research report has been generated. Please find the PDF attached.</p>
<h3>Executive Summary</h3>
<pre style="white-space:pre-wrap;">{report_md[:800]}...</pre>
<p><em>This report was automatically generated by the Multi-Agent RAG Autonomous Research Engine.</em></p>
</body></html>
"""
            email_sent = _send_email(
                to_email=email_to,
                subject=f"Research Report: {query[:60]}",
                body=email_body,
                pdf_filename=pdf_filename
            )
        steps["email_sent"] = email_sent

        # Update task record
        if task:
            task.status = "completed"
            task.result_summary = report_md[:2000]
            task.pdf_filename = pdf_filename
            task.steps_log = json.dumps({"web_research": web_result[:500], "kb_context": kb_result[:500]})
            db_local.commit()

        print(f"[Research Agent] Task {task_id} completed successfully.")
        return {"success": True, "task_id": task_id, "pdf_filename": pdf_filename, "steps": steps}

    except Exception as e:
        import traceback
        print(f"[Research Agent] Task {task_id} failed: {e}")
        traceback.print_exc()
        try:
            task = db_local.query(ResearchTask).filter(ResearchTask.id == uuid.UUID(task_id)).first()
            if task:
                task.status = "failed"
                task.result_summary = f"Error: {str(e)}"
                db_local.commit()
        except Exception:
            pass
        return {"success": False, "task_id": task_id, "error": str(e)}
    finally:
        db_local.close()


def _mock_research_report(query: str, web_research: str, kb_context: str) -> str:
    """Returns a detailed mock research report."""
    return f"""# Autonomous Research Report: {query}

## Executive Summary

This report presents a comprehensive analysis of **{query}**. Based on aggregated web intelligence and internal knowledge base insights, this research synthesizes key findings across the competitive landscape.

## Key Findings

- **Market Leadership**: The AI startup ecosystem in India has seen 340% growth in the last 2 years
- **Top Performers**: Companies like Sarvam AI, Krutrim, and Gnani.ai are leading the charge
- **Investment Trends**: Total funding exceeded $2.1 billion in 2024
- **Technology Focus**: 68% of startups focus on LLM infrastructure and RAG systems

## Detailed Analysis

### Category 1: Foundation Model Startups
Companies building base models trained on Indian languages and domains.
- Sarvam AI: Multilingual LLM, Series A $41M
- Krutrim: Ola-backed, full stack AI infrastructure

### Category 2: Enterprise AI Platforms
RAG and knowledge management platforms for enterprise use.
- Strong demand from BFSI, Healthcare, and Legal sectors
- Integration with existing enterprise workflows is key differentiator

### Category 3: AI Infrastructure
GPU cloud, MLOps platforms, and inference optimization.
- Growing cloud-native infrastructure investment
- Edge AI emerging as key trend

## Comparison Table

| Company | Segment | Funding | Focus Area |
|---------|---------|---------|------------|
| Sarvam AI | Foundation | $41M | Multilingual LLM |
| Krutrim | Infrastructure | $50M | Full Stack AI |
| Gnani.ai | Enterprise | $16M | Conversational AI |
| Observe.AI | Analytics | $125M | Contact Center AI |

## Recommendations

1. **Partner with Sarvam AI** for multilingual RAG capabilities
2. **Monitor Krutrim** for GPU infrastructure partnerships
3. **Evaluate Gnani.ai** for conversational AI integrations
4. **Consider investment** in Indian AI startup basket given strong growth trajectory

## Conclusion

The Indian AI startup ecosystem represents a significant opportunity. Companies with strong RAG and knowledge management capabilities are well-positioned to capture enterprise market share. This report recommends strategic partnerships and monitoring of the top 5 identified companies.

---
*Report generated by Multi-Agent RAG Autonomous Research Engine*
*Web Research: {web_research[:200]}...*
"""
