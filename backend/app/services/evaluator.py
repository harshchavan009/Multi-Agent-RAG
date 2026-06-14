from typing import List, Dict, Any

class AIEvaluator:
    @staticmethod
    def calculate_groundedness(response: str, sources: List[str]) -> float:
        """
        Measures if the response is fully derived from the retrieved documents.
        Emulates factual groundedness using token intersection overlap.
        """
        if not sources or not response:
            return 0.0
        
        response_words = set(response.lower().split())
        source_words = set()
        for source in sources:
            source_words.update(source.lower().split())
            
        if not response_words:
            return 1.0
            
        intersection = response_words.intersection(source_words)
        # Percentage of key response concepts backed by source document words
        score = len(intersection) / len(response_words)
        # Apply smoothing / bound
        return round(min(score * 1.5, 1.0), 2)

    @staticmethod
    def calculate_faithfulness(response: str, user_query: str) -> float:
        """
        Measures if the response answers the user's intent.
        """
        if not response or not user_query:
            return 0.0
        query_words = set(user_query.lower().split())
        response_words = set(response.lower().split())
        
        # Stop words filter out for simple check
        stop_words = {"what", "how", "why", "where", "who", "is", "are", "the", "a", "an", "and", "or", "in", "to", "for"}
        filtered_query = query_words - stop_words
        
        if not filtered_query:
            return 1.0
            
        matches = filtered_query.intersection(response_words)
        return round(len(matches) / len(filtered_query), 2)

    @staticmethod
    def calculate_hallucination_score(response: str, sources: List[str]) -> float:
        """
        Hallucination index is inverse of groundedness.
        """
        groundedness = AIEvaluator.calculate_groundedness(response, sources)
        return round(1.0 - groundedness, 2)

    @staticmethod
    def evaluate_turn(query: str, response: str, sources: List[str]) -> Dict[str, float]:
        groundedness = AIEvaluator.calculate_groundedness(response, sources)
        faithfulness = AIEvaluator.calculate_faithfulness(response, query)
        hallucination = AIEvaluator.calculate_hallucination_score(response, sources)
        # Retrieval relevance (how close the response text matches retrieved chunk keywords)
        retrieval_relevance = round((groundedness + faithfulness) / 2.0, 2)
        
        return {
            "groundedness_score": groundedness,
            "faithfulness_score": faithfulness,
            "hallucination_score": hallucination,
            "retrieval_score": retrieval_relevance,
            "performance_score": round((groundedness * 0.4 + faithfulness * 0.4 + (1.0 - hallucination) * 0.2), 2)
        }
