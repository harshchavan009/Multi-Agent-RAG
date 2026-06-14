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

# Pinecone Implementation
class PineconeAdapter(VectorStoreAdapter):
    def __init__(self, api_key: str, environment: Optional[str] = None):
        self.api_key = api_key
        self.environment = environment

    def insert_vectors(self, collection_name: str, vectors: List[List[float]], payloads: List[Dict[str, Any]], ids: List[str]):
        print(f"[Pinecone] Inserting {len(vectors)} vectors into {collection_name}")

    def search_vectors(self, collection_name: str, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        print(f"[Pinecone] Searching vectors in {collection_name}")
        return []

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

# Factory Pattern for Vector Store Switcher
def get_vector_store(provider: str, settings: Any) -> VectorStoreAdapter:
    if provider == "qdrant" and settings.QDRANT_URL:
        return QdrantAdapter(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
    elif provider == "pinecone" and settings.PINECONE_API_KEY:
        return PineconeAdapter(api_key=settings.PINECONE_API_KEY, environment=settings.PINECONE_ENVIRONMENT)
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

# Hybrid RAG pipeline manager
class RAGPipeline:
    def __init__(self, vector_store: VectorStoreAdapter, embedding_gen: EmbeddingGenerator):
        self.vector_store = vector_store
        self.embedding_gen = embedding_gen

    def ingest_document(self, collection_name: str, doc_id: str, title: str, text: str):
        chunks = DocumentProcessor.chunk_text(text)
        vectors = [self.embedding_gen.get_embedding(chunk) for chunk in chunks]
        payloads = [{"doc_id": doc_id, "title": title, "text": chunk} for chunk in chunks]
        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        self.vector_store.insert_vectors(collection_name, vectors, payloads, ids)

    def hybrid_search(self, collection_name: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        # Dense search
        query_vector = self.embedding_gen.get_embedding(query)
        dense_results = self.vector_store.search_vectors(collection_name, query_vector, limit=limit * 2)

        # In case our vector store is empty, return empty results
        if not dense_results:
            return []

        # Sparse scoring (BM25) over dense retrieval pool
        corpus = [item["payload"]["text"] for item in dense_results]
        bm25 = BM25Retriever(corpus)
        
        scored_results = []
        for idx, item in enumerate(dense_results):
            sparse_score = bm25.score(query, idx)
            # Reciprocal Rank Fusion or linear hybrid weight (0.7 * Dense + 0.3 * Sparse)
            hybrid_score = (0.7 * item["score"]) + (0.3 * sparse_score)
            scored_results.append({
                "text": item["payload"]["text"],
                "title": item["payload"]["title"],
                "doc_id": item["payload"]["doc_id"],
                "score": hybrid_score
            })

        # Sort hybrid score descending
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:limit]
