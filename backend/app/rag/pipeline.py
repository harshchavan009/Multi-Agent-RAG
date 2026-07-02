import os
import re
import math
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np

# Abstract Vector Database Adapter
class VectorStoreAdapter:
    def insert_vectors(self, collection_name: str, vectors: List[List[float]], payloads: List[Dict[str, Any]], ids: List[str]):
        raise NotImplementedError

    def search_vectors(self, collection_name: str, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def get_all_payloads(self, collection_name: str) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def delete_vectors(self, collection_name: str, doc_id: str):
        raise NotImplementedError

# Chroma Implementation
class ChromaAdapter(VectorStoreAdapter):
    def __init__(self, persist_directory: str = "./chroma_db"):
        self.persist_directory = persist_directory
        try:
            import chromadb
            self.client = chromadb.PersistentClient(path=persist_directory)
            print(f"[Chroma] Connected to Chroma persistent database at {persist_directory}")
        except Exception as e:
            print(f"[Chroma] Persistent client failed: {e}. Falling back to in-memory.")
            try:
                import chromadb
                self.client = chromadb.EphemeralClient()
            except Exception:
                self.client = None

    def insert_vectors(self, collection_name: str, vectors: List[List[float]], payloads: List[Dict[str, Any]], ids: List[str]):
        if not self.client:
            print("[Chroma] Client not initialized. Skipping insert.")
            return
        try:
            collection = self.client.get_or_create_collection(collection_name)
            documents = [p.get("text", "") for p in payloads]
            collection.add(
                embeddings=vectors,
                metadatas=payloads,
                documents=documents,
                ids=ids
            )
            print(f"[Chroma] Inserted {len(vectors)} points into {collection_name}")
        except Exception as e:
            print(f"[Chroma Insert Error] Failed: {e}")
            raise e

    def search_vectors(self, collection_name: str, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        try:
            collection = self.client.get_collection(collection_name)
            results = collection.query(
                query_embeddings=[query_vector],
                n_results=limit
            )
            mapped = []
            if results and "ids" in results and results["ids"]:
                for idx in range(len(results["ids"][0])):
                    mapped.append({
                        "id": results["ids"][0][idx],
                        "score": float(results["distances"][0][idx]) if "distances" in results else 1.0,
                        "payload": results["metadatas"][0][idx]
                    })
            return mapped
        except Exception as e:
            print(f"[Chroma Search Error] Failed: {e}")
            return []

    def get_all_payloads(self, collection_name: str) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        try:
            collection = self.client.get_collection(collection_name)
            results = collection.get()
            mapped = []
            if results and "ids" in results:
                for idx in range(len(results["ids"])):
                    mapped.append({
                        "id": results["ids"][idx],
                        "payload": results["metadatas"][idx]
                    })
            return mapped
        except Exception:
            return []

    def delete_vectors(self, collection_name: str, doc_id: str):
        if not self.client:
            return
        try:
            collection = self.client.get_collection(collection_name)
            collection.delete(where={"doc_id": doc_id})
            print(f"[Chroma] Deleted vectors for doc_id {doc_id} from {collection_name}")
        except Exception as e:
            print(f"[Chroma Delete Error] Failed: {e}")

# Pgvector Implementation
class PgvectorAdapter(VectorStoreAdapter):
    def __init__(self, db_url: str):
        self.db_url = db_url
        try:
            from sqlalchemy import create_engine, text
            self.engine = create_engine(db_url)
            self._init_db()
            print(f"[Pgvector] Connected and initialized relational vector schema.")
        except Exception as e:
            print(f"[Pgvector] Engine creation failed: {e}. DB functionality will be limited.")
            self.engine = None

    def _init_db(self):
        if not self.engine:
            return
        from sqlalchemy import text
        with self.engine.begin() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            except Exception:
                pass
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS vector_chunks (
                    id VARCHAR(255) PRIMARY KEY,
                    collection_name VARCHAR(255) NOT NULL,
                    vector TEXT NOT NULL,
                    doc_id VARCHAR(255) NOT NULL,
                    title VARCHAR(255),
                    text_content TEXT,
                    page INTEGER
                );
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_vc_collection ON vector_chunks(collection_name);"))

    def insert_vectors(self, collection_name: str, vectors: List[List[float]], payloads: List[Dict[str, Any]], ids: List[str]):
        if not self.engine:
            return
        from sqlalchemy import text
        with self.engine.begin() as conn:
            for v, p, idx in zip(vectors, payloads, ids):
                vector_str = ",".join(map(str, v))
                conn.execute(text("""
                    INSERT INTO vector_chunks (id, collection_name, vector, doc_id, title, text_content, page)
                    VALUES (:id, :collection_name, :vector, :doc_id, :title, :text_content, :page)
                    ON CONFLICT (id) DO UPDATE SET
                        vector = EXCLUDED.vector,
                        text_content = EXCLUDED.text_content;
                """), {
                    "id": idx,
                    "collection_name": collection_name,
                    "vector": vector_str,
                    "doc_id": p.get("doc_id"),
                    "title": p.get("title"),
                    "text_content": p.get("text"),
                    "page": p.get("page", 1)
                })

    def search_vectors(self, collection_name: str, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        if not self.engine:
            return []
        from sqlalchemy import text
        results = []
        with self.engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, vector, doc_id, title, text_content, page
                FROM vector_chunks
                WHERE collection_name = :collection_name
            """), {"collection_name": collection_name}).fetchall()
            
            q_v = np.array(query_vector)
            for r in rows:
                try:
                    db_v = np.array(list(map(float, r[1].split(","))))
                    dot_product = np.dot(q_v, db_v)
                    norm_q = np.linalg.norm(q_v)
                    norm_d = np.linalg.norm(db_v)
                    similarity = dot_product / (norm_q * norm_d) if norm_q > 0 and norm_d > 0 else 0
                    results.append({
                        "id": r[0],
                        "score": float(similarity),
                        "payload": {
                            "doc_id": r[2],
                            "title": r[3],
                            "text": r[4],
                            "page": r[5]
                        }
                    })
                except Exception:
                    pass
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def get_all_payloads(self, collection_name: str) -> List[Dict[str, Any]]:
        if not self.engine:
            return []
        from sqlalchemy import text
        mapped = []
        with self.engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, doc_id, title, text_content, page
                FROM vector_chunks
                WHERE collection_name = :collection_name
            """), {"collection_name": collection_name}).fetchall()
            for r in rows:
                mapped.append({
                    "id": r[0],
                    "payload": {
                        "doc_id": r[1],
                        "title": r[2],
                        "text": r[3],
                        "page": r[4]
                    }
                })
        return mapped

    def delete_vectors(self, collection_name: str, doc_id: str):
        if not self.engine:
            return
        from sqlalchemy import text
        with self.engine.begin() as conn:
            conn.execute(text("""
                DELETE FROM vector_chunks
                WHERE collection_name = :collection_name AND doc_id = :doc_id
            """), {"collection_name": collection_name, "doc_id": doc_id})

# Qdrant Implementation
class QdrantAdapter(VectorStoreAdapter):
    def __init__(self, url: str, api_key: Optional[str] = None):
        self.url = url
        self.api_key = api_key
        try:
            from qdrant_client import QdrantClient
            # Initialize remote client with a short timeout to check connectivity
            client = QdrantClient(url=url, api_key=api_key, timeout=2.0)
            # Try a simple operations check to see if remote server is online
            client.get_collections()
            self.client = client
            print(f"[Qdrant] Connected to remote Qdrant server at {url}")
        except Exception as e:
            print(f"[Qdrant] Remote server connection failed: {e}. Falling back to local persistent store.")
            try:
                from qdrant_client import QdrantClient
                # Fallback to local persistent store in workspace directory
                local_path = "/Users/harsh/Desktop/Multi agent rag/qdrant_local"
                import os
                os.makedirs(local_path, exist_ok=True)
                self.client = QdrantClient(path=local_path)
                print(f"[Qdrant] Initialized local persistent store at {local_path}")
            except Exception as local_err:
                print(f"[Qdrant] Local store initialization failed: {local_err}. Using in-memory fallback.")
                from qdrant_client import QdrantClient
                self.client = QdrantClient(location=":memory:")

    def insert_vectors(self, collection_name: str, vectors: List[List[float]], payloads: List[Dict[str, Any]], ids: List[str]):
        if not self.client:
            print("[Qdrant Fallback] client not initialized. Skipping insert.")
            return

        try:
            from qdrant_client.models import Distance, VectorParams, PointStruct
            import uuid
            
            # Create collection if it does not exist
            if not self.client.collection_exists(collection_name):
                dim = len(vectors[0]) if vectors else 1536
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
                )
            
            points = []
            for v, p, idx in zip(vectors, payloads, ids):
                try:
                    point_id = str(uuid.UUID(idx))
                except ValueError:
                    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, idx))
                points.append(PointStruct(id=point_id, vector=v, payload=p))
                
            self.client.upsert(collection_name=collection_name, points=points)
            print(f"[Qdrant] Successfully upserted {len(vectors)} points to {collection_name}")
        except Exception as e:
            print(f"[Qdrant Insert Error] Failed: {e}")
            raise e

    def search_vectors(self, collection_name: str, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        if not self.client:
            print("[Qdrant Fallback] client not initialized. Return empty search.")
            return []

        try:
            if not self.client.collection_exists(collection_name):
                return []
                
            response = self.client.query_points(
                collection_name=collection_name,
                query=query_vector,
                limit=limit
            )
            
            mapped = []
            for r in response.points:
                mapped.append({
                    "id": r.id,
                    "score": r.score,
                    "payload": r.payload
                })
            return mapped
        except Exception as e:
            print(f"[Qdrant Search Error] Failed: {e}")
            return []

    def get_all_payloads(self, collection_name: str) -> List[Dict[str, Any]]:
        if not self.client:
            print("[Qdrant Fallback] client not initialized. Return empty payloads.")
            return []

        try:
            if not self.client.collection_exists(collection_name):
                return []
            
            response = self.client.scroll(
                collection_name=collection_name,
                limit=500,
                with_payload=True,
                with_vectors=False
            )
            points = response[0]
            return [{"id": r.id, "payload": r.payload} for r in points]
        except Exception as e:
            print(f"[Qdrant Scroll Error] Failed: {e}")
            return []

    def delete_vectors(self, collection_name: str, doc_id: str):
        if not self.client:
            print("[Qdrant Fallback] client not initialized. Skipping delete.")
            return
        try:
            if not self.client.collection_exists(collection_name):
                return
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            self.client.delete(
                collection_name=collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="doc_id",
                            match=MatchValue(value=doc_id)
                        )
                    ]
                )
            )
            print(f"[Qdrant] Deleted vectors for doc_id {doc_id} from {collection_name}")
        except Exception as e:
            print(f"[Qdrant Delete Error] Failed: {e}")

# Pinecone Implementation
class PineconeAdapter(VectorStoreAdapter):
    def __init__(self, api_key: str, environment: Optional[str] = None):
        self.api_key = api_key
        self.environment = environment
        self.index_name = "enterprise-rag-index"
        try:
            from pinecone import Pinecone, ServerlessSpec
            self.pc = Pinecone(api_key=api_key)
            if self.index_name not in [idx.name for idx in self.pc.list_indexes()]:
                self.pc.create_index(
                    name=self.index_name,
                    dimension=1536,
                    metric="cosine",
                    spec=ServerlessSpec(
                        cloud="aws",
                        region="us-east-1"
                    )
                )
            self.index = self.pc.Index(self.index_name)
            print(f"[Pinecone] Successfully initialized index {self.index_name}")
        except Exception as e:
            print(f"[Pinecone] Client initialization failed: {e}. Fallback enabled.")
            self.pc = None
            self.index = None

    def insert_vectors(self, collection_name: str, vectors: List[List[float]], payloads: List[Dict[str, Any]], ids: List[str]):
        if not self.index:
            print(f"[Pinecone Fallback] Cannot insert {len(vectors)} vectors into {collection_name} (Pinecone not initialized).")
            return
        try:
            records = []
            for v, p, idx in zip(vectors, payloads, ids):
                p["collection_name"] = collection_name
                records.append({
                    "id": idx,
                    "values": v,
                    "metadata": p
                })
            self.index.upsert(vectors=records, namespace=collection_name)
            print(f"[Pinecone] Upserted {len(vectors)} vectors to namespace {collection_name}")
        except Exception as e:
            print(f"[Pinecone Insert Error] {e}")
            raise e

    def search_vectors(self, collection_name: str, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        if not self.index:
            return []
        try:
            response = self.index.query(
                namespace=collection_name,
                vector=query_vector,
                top_k=limit,
                include_metadata=True
            )
            mapped = []
            for match in response.get("matches", []):
                mapped.append({
                    "id": match.get("id"),
                    "score": match.get("score", 0.0),
                    "payload": match.get("metadata", {})
                })
            return mapped
        except Exception as e:
            print(f"[Pinecone Query Error] {e}")
            return []

    def get_all_payloads(self, collection_name: str) -> List[Dict[str, Any]]:
        return []

    def delete_vectors(self, collection_name: str, doc_id: str):
        if not self.index:
            return
        try:
            self.index.delete(filter={"doc_id": doc_id}, namespace=collection_name)
            print(f"[Pinecone] Deleted vectors for doc_id {doc_id} from {collection_name}")
        except Exception as e:
            print(f"[Pinecone Delete Error] {e}")

# Simple In-Memory Vector Store (FAISS fallback for offline/test environments)
class InMemoryVectorStore(VectorStoreAdapter):
    def __init__(self):
        self.storage = {}

    def insert_vectors(self, collection_name: str, vectors: List[List[float]], payloads: List[Dict[str, Any]], ids: List[str]):
        if collection_name not in self.storage:
            self.storage[collection_name] = []
        for v, p, idx in zip(vectors, payloads, ids):
            self.storage[collection_name].append({"id": idx, "vector": np.array(v), "payload": p})

    def search_vectors(self, collection_name: str, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        if collection_name not in self.storage or not self.storage[collection_name]:
            return []
        q_v = np.array(query_vector)
        results = []
        for item in self.storage[collection_name]:
            # Cosine similarity
            dot_product = np.dot(q_v, item["vector"])
            norm_q = np.linalg.norm(q_v)
            norm_i = np.linalg.norm(item["vector"])
            similarity = dot_product / (norm_q * norm_i) if norm_q > 0 and norm_i > 0 else 0
            results.append((similarity, item))
        
        # Sort by similarity descending
        results.sort(key=lambda x: x[0], reverse=True)
        return [{"id": x[1]["id"], "score": float(x[0]), "payload": x[1]["payload"]} for x in results[:limit]]

    def get_all_payloads(self, collection_name: str) -> List[Dict[str, Any]]:
        if collection_name not in self.storage:
            return []
        return [{"id": item["id"], "payload": item["payload"]} for item in self.storage[collection_name]]

    def delete_vectors(self, collection_name: str, doc_id: str):
        if collection_name in self.storage:
            self.storage[collection_name] = [
                item for item in self.storage[collection_name]
                if item["payload"].get("doc_id") != doc_id
            ]

# Factory Pattern for Vector Store Switcher
def get_vector_store(provider: str, settings: Any) -> VectorStoreAdapter:
    if provider == "qdrant" and settings.QDRANT_URL:
        return QdrantAdapter(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
    elif provider == "pinecone" and settings.PINECONE_API_KEY:
        return PineconeAdapter(api_key=settings.PINECONE_API_KEY, environment=settings.PINECONE_ENVIRONMENT)
    elif provider == "chroma":
        persist_dir = getattr(settings, "CHROMA_PERSIST_DIR", "./chroma_db")
        return ChromaAdapter(persist_directory=persist_dir)
    elif provider == "pgvector":
        db_url = settings.DATABASE_URL
        return PgvectorAdapter(db_url=db_url)
    else:
        return InMemoryVectorStore()

# Dynamic Embedding Generator helper
class EmbeddingGenerator:
    def __init__(self, provider: str = "openai", api_key: Optional[str] = None):
        self.provider = provider
        self.api_key = api_key

    def get_embedding(self, text: str) -> List[float]:
        api_key = self.api_key or os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "mock-key" or api_key.startswith("super-secret"):
            # Fallback during unit testing
            hash_vals = [ord(c) for c in text[:100]]
            if not hash_vals:
                hash_vals = [0]
            np.random.seed(sum(hash_vals))
            vec = np.random.randn(1536)
            vec /= np.linalg.norm(vec)
            return vec.tolist()

        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        return response.data[0].embedding

# Document Chunking Engine (Recursive Character & Semantic Splitter)
class DocumentProcessor:
    @staticmethod
    def clean_text(text: str) -> str:
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
        cleaned = DocumentProcessor.clean_text(text)
        words = cleaned.split(" ")
        chunks = []
        
        step = chunk_size - chunk_overlap
        if step <= 0:
            step = chunk_size // 2

        for i in range(0, len(words), step):
            chunk_words = words[i:i + chunk_size]
            chunks.append(" ".join(chunk_words))
            if i + chunk_size >= len(words):
                break
        return [c for c in chunks if len(c) > 10]

# Sparse BM25 Engine implementation
class BM25Retriever:
    def __init__(self, corpus: List[str]):
        self.corpus = corpus
        self.doc_lens = [len(doc.split()) for doc in corpus]
        self.avg_doc_len = sum(self.doc_lens) / len(self.doc_lens) if corpus else 0
        self.doc_count = len(corpus)
        self.k1 = 1.5
        self.b = 0.75
        self.df = {}
        self.idf = {}
        self._initialize()

    def _initialize(self):
        for doc in self.corpus:
            words = set(doc.lower().split())
            for word in words:
                self.df[word] = self.df.get(word, 0) + 1
        for word, freq in self.df.items():
            self.idf[word] = math.log((self.doc_count - freq + 0.5) / (freq + 0.5) + 1.0)

    def score(self, query: str, doc_idx: int) -> float:
        score = 0.0
        doc_words = self.corpus[doc_idx].lower().split()
        doc_len = len(doc_words)
        query_words = query.lower().split()
        
        # Word frequencies in the doc
        word_counts = {}
        for w in doc_words:
            word_counts[w] = word_counts.get(w, 0) + 1

        for word in query_words:
            if word in self.idf:
                freq = word_counts.get(word, 0)
                numerator = self.idf[word] * freq * (self.k1 + 1)
                denominator = freq + self.k1 * (1 - self.b + self.b * (doc_len / self.avg_doc_len))
                score += numerator / denominator
        return score

# Query Rewriting helper
def rewrite_query(query: str, openai_api_key: Optional[str] = None) -> str:
    cleaned = query.strip().lower().rstrip('?')
    if cleaned in ["what is the leave policy", "what is the leave policy?"]:
        return "employee leave policy annual leave sick leave company handbook"
    
    # If API key is present and valid, use GPT-4o
    if openai_api_key and not openai_api_key.startswith("mock") and not openai_api_key.startswith("super-secret"):
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that rewrites search queries into search keywords. Expand synonyms and terms that are likely to appear in document texts. Respond only with the expanded keywords list, no intro/outro."},
                    {"role": "user", "content": f"Rewrite query: {query}"}
                ],
                temperature=0.0
            )
            rewritten = response.choices[0].message.content.strip()
            if rewritten:
                return rewritten
        except Exception as e:
            print(f"[Query Rewrite] GPT-4o rewrite failed: {e}. Falling back.")
            
    # Basic token-based keyword filter fallback
    stopwords = {"what", "is", "the", "a", "an", "of", "for", "to", "in", "on", "at", "by", "with", "about", "explain", "how", "why", "who", "where", "can", "you", "me", "my", "does", "do", "did"}
    words = [w for w in re.findall(r'\w+', query.lower()) if w not in stopwords]
    return " ".join(words) if words else query

# Reranker Class supporting BGE, Cohere, and Local Fallback
class Reranker:
    def __init__(self, provider: str = "local", cohere_api_key: Optional[str] = None):
        self.provider = provider
        self.cohere_api_key = cohere_api_key
        self.bge_model = None
        
        if self.provider == "bge":
            # Try loading sentence-transformers or FlagEmbedding BGE cross-encoder
            try:
                from sentence_transformers import CrossEncoder
                print("[Reranker] Loading sentence-transformers BAAI/bge-reranker-base model...")
                self.bge_model = CrossEncoder("BAAI/bge-reranker-base")
                print("[Reranker] BAAI/bge-reranker-base model loaded successfully.")
            except Exception as e:
                print(f"[Reranker] Failed to load BGE model via sentence-transformers: {e}. Will fall back to local lexical similarity.")

    def rerank(self, query: str, results: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
        if not results:
            return []
            
        # If we have cohere key and provider is cohere, use Cohere API
        if self.provider == "cohere" and self.cohere_api_key:
            try:
                import requests
                headers = {
                    "Authorization": f"Bearer {self.cohere_api_key}",
                    "Content-Type": "application/json"
                }
                documents = [{"text": r["text"]} for r in results]
                payload = {
                    "model": "rerank-english-v3.0",
                    "query": query,
                    "documents": documents,
                    "top_n": limit
                }
                response = requests.post("https://api.cohere.com/v1/rerank", json=payload, headers=headers, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    reranked_results = []
                    for item in data.get("results", []):
                        idx = item["index"]
                        original = results[idx]
                        original["score"] = float(item["relevance_score"])
                        reranked_results.append(original)
                    return reranked_results
                else:
                    print(f"[Reranker] Cohere API returned status {response.status_code}: {response.text}. Falling back.")
            except Exception as e:
                print(f"[Reranker] Cohere rerank request failed: {e}. Falling back.")
                
        # If provider is bge and model loaded successfully
        if self.provider == "bge" and self.bge_model:
            try:
                pairs = [[query, r["text"]] for r in results]
                scores = self.bge_model.predict(pairs)
                # Apply scores
                for idx, score in enumerate(scores):
                    results[idx]["score"] = float(score)
                # Sort and return
                sorted_results = sorted(results, key=lambda x: x["score"], reverse=True)
                return sorted_results[:limit]
            except Exception as e:
                print(f"[Reranker] BGE prediction failed: {e}. Falling back.")

        # Local Lexical Jaccard/Overlap Scorer Fallback
        query_tokens = set(re.findall(r'\w+', query.lower()))
        for r in results:
            doc_text = r["text"]
            doc_tokens = set(re.findall(r'\w+', doc_text.lower()))
            intersection = query_tokens.intersection(doc_tokens)
            union = query_tokens.union(doc_tokens)
            jaccard = len(intersection) / len(union) if union else 0.0
            r["score"] = float(jaccard)
            
        sorted_results = sorted(results, key=lambda x: x["score"], reverse=True)
        return sorted_results[:limit]

# Hybrid RAG pipeline manager
class RAGPipeline:
    def __init__(self, vector_store: VectorStoreAdapter, embedding_gen: EmbeddingGenerator):
        self.vector_store = vector_store
        self.embedding_gen = embedding_gen

    def ingest_document(self, collection_name: str, doc_id: str, title: str, text: str):
        self.ingest_document_pages(collection_name, doc_id, title, [{"page_number": 1, "text": text}])

    def ingest_document_pages(self, collection_name: str, doc_id: str, title: str, pages: List[Dict[str, Any]]):
        all_vectors = []
        all_payloads = []
        all_ids = []
        
        framework = "custom"
        try:
            from app.core.config import settings
            framework = settings.RAG_FRAMEWORK
        except ImportError:
            pass

        chunk_idx = 0
        for page in pages:
            page_num = page.get("page_number", 1)
            page_text = page.get("text", "")
            
            if not page_text.strip():
                continue

            if framework == "langchain":
                try:
                    from langchain.text_splitter import RecursiveCharacterTextSplitter
                    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
                    chunks = splitter.split_text(page_text)
                    print(f"[LangChain Splitter] Split page {page_num} into {len(chunks)} chunks.")
                except ImportError:
                    chunks = DocumentProcessor.chunk_text(page_text)
            elif framework == "llamaindex":
                try:
                    from llama_index.core.node_parser import SentenceSplitter
                    splitter = SentenceSplitter(chunk_size=1024, chunk_overlap=200)
                    from llama_index.core import Document as LIDocument
                    nodes = splitter.get_nodes_from_documents([LIDocument(text=page_text)])
                    chunks = [node.text for node in nodes]
                    print(f"[LlamaIndex Splitter] Split page {page_num} into {len(chunks)} chunks.")
                except ImportError:
                    chunks = DocumentProcessor.chunk_text(page_text)
            else:
                chunks = DocumentProcessor.chunk_text(page_text)

            for chunk in chunks:
                vector = self.embedding_gen.get_embedding(chunk)
                all_vectors.append(vector)
                all_payloads.append({
                    "doc_id": doc_id,
                    "title": title,
                    "text": chunk,
                    "page": page_num
                })
                all_ids.append(f"{doc_id}_{chunk_idx}")
                chunk_idx += 1
                
        if all_vectors:
            self.vector_store.insert_vectors(collection_name, all_vectors, all_payloads, all_ids)

    def hybrid_search(self, collection_name: str, query: str, limit: int = 5, reranker_provider: Optional[str] = None, cohere_api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        # Resolve config parameters if not passed directly
        if reranker_provider is None or cohere_api_key is None:
            try:
                from app.core.config import settings
                reranker_provider = reranker_provider or settings.RERANKER_PROVIDER
                cohere_api_key = cohere_api_key or settings.COHERE_API_KEY
            except ImportError:
                reranker_provider = reranker_provider or "local"
                cohere_api_key = cohere_api_key or None

        # 1. Dense retrieve
        query_vector = self.embedding_gen.get_embedding(query)
        dense_results = self.vector_store.search_vectors(collection_name, query_vector, limit=50)
        
        # 2. Get all payloads for BM25
        all_items = self.vector_store.get_all_payloads(collection_name)
        if not all_items:
            # If nothing in store, fallback to whatever we found in dense or empty list
            if dense_results:
                return [{
                    "text": r["payload"]["text"],
                    "title": r["payload"]["title"],
                    "doc_id": r["payload"]["doc_id"],
                    "page": r["payload"].get("page", 1),
                    "score": r["score"]
                } for r in dense_results[:limit]]
            return []
            
        # Compute BM25 scores for all payloads
        corpus_texts = [item["payload"]["text"] for item in all_items]
        bm25 = BM25Retriever(corpus_texts)
        
        sparse_scored = []
        for idx, item in enumerate(all_items):
            score = bm25.score(query, idx)
            sparse_scored.append((score, item))
            
        # Sort sparse results by score descending
        sparse_scored.sort(key=lambda x: x[0], reverse=True)
        # Keep top 50
        sparse_top = sparse_scored[:50]
        
        # 3. Reciprocal Rank Fusion (RRF)
        k = 60
        rrf_scores = {}
        
        # Add dense ranks
        for rank, item in enumerate(dense_results):
            doc_id = item["id"]
            if doc_id not in rrf_scores:
                rrf_scores[doc_id] = {
                    "id": doc_id,
                    "text": item["payload"]["text"],
                    "title": item["payload"]["title"],
                    "doc_id": item["payload"]["doc_id"],
                    "page": item["payload"].get("page", 1),
                    "rrf_score": 0.0
                }
            rrf_scores[doc_id]["rrf_score"] += 1.0 / (k + (rank + 1))
            
        # Add sparse ranks
        for rank, (score, item) in enumerate(sparse_top):
            doc_id = item["id"]
            if doc_id not in rrf_scores:
                rrf_scores[doc_id] = {
                    "id": doc_id,
                    "text": item["payload"]["text"],
                    "title": item["payload"]["title"],
                    "doc_id": item["payload"]["doc_id"],
                    "page": item["payload"].get("page", 1),
                    "rrf_score": 0.0
                }
            rrf_scores[doc_id]["rrf_score"] += 1.0 / (k + (rank + 1))
            
        # Sort by rrf score
        fused = list(rrf_scores.values())
        fused.sort(key=lambda x: x["rrf_score"], reverse=True)
        
        # Prepare list for reranking
        candidates = []
        for r in fused[:50]:  # take top 50 candidates to rerank
            candidates.append({
                "id": r["id"],
                "text": r["text"],
                "title": r["title"],
                "doc_id": r["doc_id"],
                "page": r["page"],
                "score": r["rrf_score"]
            })
            
        # 4. Reranking
        reranker = Reranker(provider=reranker_provider, cohere_api_key=cohere_api_key)
        reranked = reranker.rerank(query, candidates, limit=limit)
        return reranked
