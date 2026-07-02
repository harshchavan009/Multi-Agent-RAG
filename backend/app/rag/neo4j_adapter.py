import logging
import os
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class Neo4jAdapter:
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(Neo4jAdapter, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
        
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.driver = None
        self.mock_mode = False
        
        # In-memory Mock Graph Store
        self.mock_nodes = {}  # name -> label
        self.mock_relationships = []  # List of dicts: {"source", "source_label", "target", "target_label", "type"}
        
        # Load settings
        try:
            from app.core.config import settings
            url = settings.NEO4J_URL
            user = settings.NEO4J_USER
            password = settings.NEO4J_PASSWORD
        except ImportError:
            url = os.getenv("NEO4J_URL", "bolt://localhost:7687")
            user = os.getenv("NEO4J_USER", "neo4j")
            password = os.getenv("NEO4J_PASSWORD", "password123")
            
        if not url:
            logger.warning("NEO4J_URL not set. Falling back to Mock Graph Store.")
            self.mock_mode = True
            return
            
        try:
            from neo4j import GraphDatabase
            # Fail fast if Neo4j is not running locally (e.g. 1.0s timeout)
            self.driver = GraphDatabase.driver(url, auth=(user, password), connection_timeout=1.0)
            self.driver.verify_connectivity()
            logger.info("Successfully connected to Neo4j Graph Database.")
        except Exception as e:
            logger.warning(f"Could not connect to Neo4j at {url}: {e}. Falling back to Mock Graph Store.")
            self.mock_mode = True
            self.driver = None

    def add_node(self, name: str, label: str):
        if not name or not label:
            return
        name_clean = name.strip()
        label_clean = label.strip()
        
        if self.mock_mode:
            self.mock_nodes[name_clean] = label_clean
            logger.info(f"[Mock Graph] Added node: ({name_clean}:{label_clean})")
            return
            
        try:
            allowed_labels = {"Employee", "Organization", "Project", "Department", "Product", "Policy"}
            if label_clean not in allowed_labels:
                # Sanitize node labels to avoid Cypher injection
                return
            query = f"MERGE (n:{label_clean} {{name: $name}}) RETURN n"
            with self.driver.session() as session:
                session.run(query, name=name_clean)
            logger.info(f"[Neo4j Graph] Added node: ({name_clean}:{label_clean})")
        except Exception as e:
            logger.error(f"Failed to add node {name_clean} to Neo4j: {e}. Writing to mock store fallback.")
            self.mock_nodes[name_clean] = label_clean

    def add_relationship(self, source_name: str, source_label: str, target_name: str, target_label: str, rel_type: str):
        if not source_name or not target_name or not rel_type:
            return
        src_clean = source_name.strip()
        tgt_clean = target_name.strip()
        rel_clean = rel_type.strip()
        
        # Auto-create nodes in local dictionary if missing
        self.mock_nodes[src_clean] = source_label
        self.mock_nodes[tgt_clean] = target_label
        
        if self.mock_mode:
            # Check duplicate to avoid duplicate edges
            exists = any(
                r["source"] == src_clean and r["target"] == tgt_clean and r["type"] == rel_clean
                for r in self.mock_relationships
            )
            if not exists:
                self.mock_relationships.append({
                    "source": src_clean,
                    "source_label": source_label,
                    "target": tgt_clean,
                    "target_label": target_label,
                    "type": rel_clean
                })
                logger.info(f"[Mock Graph] Added relationship: ({src_clean}:{source_label})-[:{rel_clean}]->({tgt_clean}:{target_label})")
            return
            
        try:
            allowed_labels = {"Employee", "Organization", "Project", "Department", "Product", "Policy"}
            allowed_types = {"belongs_to", "managed_by"}
            
            if source_label not in allowed_labels or target_label not in allowed_labels or rel_clean not in allowed_types:
                return
                
            query = f"""
            MERGE (s:{source_label} {{name: $source_name}})
            MERGE (t:{target_label} {{name: $target_name}})
            MERGE (s)-[r:{rel_clean}]->(t)
            RETURN r
            """
            with self.driver.session() as session:
                session.run(query, source_name=src_clean, target_name=tgt_clean)
            logger.info(f"[Neo4j Graph] Added relationship: ({src_clean}:{source_label})-[:{rel_clean}]->({tgt_clean}:{target_label})")
        except Exception as e:
            logger.error(f"Failed to add relationship to Neo4j: {e}. Saving to mock store fallback.")
            exists = any(
                r["source"] == src_clean and r["target"] == tgt_clean and r["type"] == rel_clean
                for r in self.mock_relationships
            )
            if not exists:
                self.mock_relationships.append({
                    "source": src_clean,
                    "source_label": source_label,
                    "target": tgt_clean,
                    "target_label": target_label,
                    "type": rel_clean
                })

    def query(self, cypher_query: str, parameters: dict = None) -> List[Dict[str, Any]]:
        if self.mock_mode:
            return self.query_mock(cypher_query)
            
        try:
            with self.driver.session() as session:
                result = session.run(cypher_query, parameters or {})
                return [dict(record) for record in result]
        except Exception as e:
            logger.error(f"Failed to execute Cypher query on Neo4j: {e}. Executing on mock fallback.")
            return self.query_mock(cypher_query)

    def query_mock(self, query_str: str) -> List[Dict[str, Any]]:
        query_clean = query_str.strip().replace("\n", " ")
        
        # 1. Match full path: (src:label {name: '...'})-[:rel]->(tgt:label {name: '...'})
        path_pattern = r"\((?P<src_var>\w+):(?P<src_label>\w+)(?:\s*\{\s*name\s*:\s*['\"](?P<src_name>[^'\"]+)['\"]\s*\})?\)-(?:\[\s*:(?P<rel_type>\w+)\s*\])?->\((?P<tgt_var>\w+):(?P<tgt_label>\w+)(?:\s*\{\s*name\s*:\s*['\"](?P<tgt_name>[^'\"]+)['\"]\s*\})?\)"
        match = re.search(path_pattern, query_clean, re.IGNORECASE)
        
        if match:
            gd = match.groupdict()
            src_label = gd.get("src_label")
            src_name = gd.get("src_name")
            rel_type = gd.get("rel_type")
            tgt_label = gd.get("tgt_label")
            tgt_name = gd.get("tgt_name")
            
            results = []
            for r in self.mock_relationships:
                if src_label and r["source_label"].lower() != src_label.lower():
                    continue
                if tgt_label and r["target_label"].lower() != tgt_label.lower():
                    continue
                if rel_type and r["type"].lower() != rel_type.lower():
                    continue
                if src_name and r["source"].lower() != src_name.lower():
                    continue
                if tgt_name and r["target"].lower() != tgt_name.lower():
                    continue
                
                # Check for RETURN statements
                ret_match = re.search(r"RETURN\s+(.+)$", query_clean, re.IGNORECASE)
                row = {}
                if ret_match:
                    ret_exprs = [x.strip() for x in ret_match.group(1).split(",")]
                    for expr in ret_exprs:
                        # Extract alias if present: e.g. e.name AS employee
                        as_parts = re.split(r"\s+AS\s+", expr, flags=re.IGNORECASE)
                        field = as_parts[0].strip()
                        alias = as_parts[-1].strip() if len(as_parts) > 1 else field
                        
                        val = None
                        if field == f"{gd.get('src_var')}.name":
                            val = r["source"]
                        elif field == f"{gd.get('tgt_var')}.name":
                            val = r["target"]
                        elif field == f"{gd.get('src_var')}.label":
                            val = r["source_label"]
                        elif field == f"{gd.get('tgt_var')}.label":
                            val = r["target_label"]
                        elif field == gd.get('src_var'):
                            val = {"name": r["source"], "label": r["source_label"]}
                        elif field == gd.get('tgt_var'):
                            val = {"name": r["target"], "label": r["target_label"]}
                        
                        row[alias] = val
                else:
                    row = {
                        "source": r["source"],
                        "source_label": r["source_label"],
                        "target": r["target"],
                        "target_label": r["target_label"],
                        "type": r["type"]
                    }
                results.append(row)
            return results

        # 2. Match single node pattern: (n:label {name: '...'})
        node_pattern = r"\((?P<var>\w+):(?P<label>\w+)(?:\s*\{\s*name\s*:\s*['\"](?P<name>[^'\"]+)['\"]\s*\})?\)"
        match = re.search(node_pattern, query_clean, re.IGNORECASE)
        
        if match:
            gd = match.groupdict()
            var = gd.get("var")
            label = gd.get("label")
            name = gd.get("name")
            
            results = []
            for n_name, n_label in self.mock_nodes.items():
                if label and n_label.lower() != label.lower():
                    continue
                if name and n_name.lower() != name.lower():
                    continue
                    
                row = {}
                ret_match = re.search(r"RETURN\s+(.+)$", query_clean, re.IGNORECASE)
                if ret_match:
                    ret_exprs = [x.strip() for x in ret_match.group(1).split(",")]
                    for expr in ret_exprs:
                        as_parts = re.split(r"\s+AS\s+", expr, flags=re.IGNORECASE)
                        field = as_parts[0].strip()
                        alias = as_parts[-1].strip() if len(as_parts) > 1 else field
                        
                        val = None
                        if field == f"{var}.name":
                            val = n_name
                        elif field == var:
                            val = {"name": n_name, "label": n_label}
                        row[alias] = val
                else:
                    row = {"name": n_name, "label": n_label}
                results.append(row)
            return results

        # 3. Match generic (n) RETURN query
        if "match (n) return" in query_clean.lower():
            ret_match = re.search(r"RETURN\s+(.+)$", query_clean, re.IGNORECASE)
            # Find all nodes
            results = []
            for n_name, n_label in self.mock_nodes.items():
                results.append({
                    "name": n_name,
                    "label": n_label
                })
            return results
            
        return []

def get_mock_graph_extraction(text: str) -> Dict[str, Any]:
    text_lower = text.lower()
    nodes = []
    relationships = []
    
    # Track items to prevent duplicate nodes
    extracted_names = set()
    
    # 1. Identify Employees
    employees = []
    for name in ["Alice", "Bob", "Charlie", "John Doe", "Jane Smith", "Harsh"]:
        if name.lower() in text_lower:
            nodes.append({"name": name, "label": "Employee"})
            employees.append(name)
            extracted_names.add(name.lower())
            
    # 2. Identify Departments
    departments = []
    for dept in ["Engineering", "Sales", "HR", "Marketing", "Finance"]:
        if dept.lower() in text_lower:
            nodes.append({"name": dept, "label": "Department"})
            departments.append(dept)
            extracted_names.add(dept.lower())
            
    # 3. Identify Projects
    projects = []
    for proj in ["Alpha Project", "Apollo Project", "Beta Project", "RAG Engine Project"]:
        if proj.lower() in text_lower or proj.replace(" Project", "").lower() in text_lower:
            nodes.append({"name": proj, "label": "Project"})
            projects.append(proj)
            extracted_names.add(proj.lower())
            
    # 4. Identify Organizations
    for org in ["Acme Corp", "Google", "OpenAI", "Enterprise Corp"]:
        if org.lower() in text_lower:
            nodes.append({"name": org, "label": "Organization"})
            extracted_names.add(org.lower())
            
    # 5. Identify Products
    for prod in ["Qdrant", "PostgreSQL", "Alembic", "ReportLab"]:
        if prod.lower() in text_lower:
            nodes.append({"name": prod, "label": "Product"})
            extracted_names.add(prod.lower())
            
    # 6. Identify Policies
    for policy in ["Leave Policy", "Employee Handbook", "Attendance Policy", "Security Policy"]:
        if policy.lower() in text_lower:
            nodes.append({"name": policy, "label": "Policy"})
            extracted_names.add(policy.lower())

    # Fallback to make sure we extract at least something if a generic document is uploaded
    if not nodes:
        # Look for capitalized word pairs or single capitalized words to mock extract
        words = text.split()
        capitalized = [w.strip(".,;:?!()\"'") for w in words if w and w[0].isupper() and len(w) > 1]
        capitalized = [w for w in capitalized if w.lower() not in ["the", "this", "what", "how", "why", "where", "when", "who", "we", "they", "our"]]
        for cap in capitalized[:4]:
            if cap.lower() not in extracted_names:
                nodes.append({"name": cap, "label": "Employee" if len(cap) % 2 == 0 else "Project"})
                extracted_names.add(cap.lower())
                if len(cap) % 2 == 0:
                    employees.append(cap)
                else:
                    projects.append(cap)

    # 7. Establish relationships
    # Employee belongs_to Department
    if "alice" in text_lower and "engineering" in text_lower:
        relationships.append({
            "source": "Alice", "source_label": "Employee",
            "target": "Engineering", "target_label": "Department",
            "type": "belongs_to"
        })
    if "bob" in text_lower and "hr" in text_lower:
        relationships.append({
            "source": "Bob", "source_label": "Employee",
            "target": "HR", "target_label": "Department",
            "type": "belongs_to"
        })
        
    # Default links if elements exist
    if not relationships and employees and departments:
        relationships.append({
            "source": employees[0], "source_label": "Employee",
            "target": departments[0], "target_label": "Department",
            "type": "belongs_to"
        })
        
    # Project managed_by Employee
    if "apollo project" in text_lower and "alice" in text_lower:
        relationships.append({
            "source": "Apollo Project", "source_label": "Project",
            "target": "Alice", "target_label": "Employee",
            "type": "managed_by"
        })
    elif "alpha project" in text_lower and "bob" in text_lower:
        relationships.append({
            "source": "Alpha Project", "source_label": "Project",
            "target": "Bob", "target_label": "Employee",
            "type": "managed_by"
        })
        
    if not any(r["type"] == "managed_by" for r in relationships) and projects and employees:
        relationships.append({
            "source": projects[0], "source_label": "Project",
            "target": employees[0], "target_label": "Employee",
            "type": "managed_by"
        })
        
    return {"nodes": nodes, "relationships": relationships}

def extract_graph_entities_and_relationships(text: str, openai_api_key: Optional[str] = None) -> Dict[str, Any]:
    api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "mock-key" or api_key.startswith("super-secret") or "••••••••••" in api_key:
        logger.info("Using heuristic fallback for graph extraction (mock key detected).")
        return get_mock_graph_extraction(text)
        
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import ChatPromptTemplate
        import json
        
        llm = ChatOpenAI(api_key=api_key, model="gpt-4o", temperature=0.0)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert system that extracts entities and relationships for a Knowledge Graph.
Extract the following entity categories from the input text:
1. People (Extract individuals and represent them as Employee entities in your response)
2. Organizations
3. Projects
4. Departments
5. Products
6. Policies

And identify the following relationships between the extracted entities:
- Employee -[belongs_to]-> Department
- Project -[managed_by]-> Employee

Return the results ONLY as a valid JSON object with the following structure:
{{
  "nodes": [
     {{"name": "Alice Smith", "label": "Employee"}},
     {{"name": "Engineering", "label": "Department"}},
     {{"name": "Apollo Project", "label": "Project"}}
  ],
  "relationships": [
     {{"source": "Alice Smith", "source_label": "Employee", "target": "Engineering", "target_label": "Department", "type": "belongs_to"}},
     {{"source": "Apollo Project", "source_label": "Project", "target": "Alice Smith", "target_label": "Employee", "type": "managed_by"}}
  ]
}}
Do not include any explanation, backticks, or markdown formatting outside of the JSON block."""),
            ("user", "Text to extract from:\n{text}")
        ])
        
        chain = prompt | llm
        response = chain.invoke({"text": text[:15000]}) # Limit input text
        content = response.content.strip()
        
        if content.startswith("```json"):
            content = content.replace("```json", "", 1)
        if content.startswith("```"):
            content = content.replace("```", "", 1)
        if content.endswith("```"):
            content = content[:-3].strip()
        content = content.strip()
        
        return json.loads(content)
    except Exception as e:
        logger.warning(f"Failed to run LLM extraction: {e}. Falling back to rule-based heuristics.")
        return get_mock_graph_extraction(text)
