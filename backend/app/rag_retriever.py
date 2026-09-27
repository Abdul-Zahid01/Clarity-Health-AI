"""Small local BM25 retriever for the curated medical PDF corpus."""

from __future__ import annotations

import math
import os
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

from app.rag_ingestion import build_knowledge_base
from app.schemas import KnowledgeChunk

TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:\.[0-9]+)?", re.IGNORECASE)
STOP_WORDS = {
    "a", "about", "and", "are", "as", "at", "be", "by", "can", "do", "does",
    "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or",
    "that", "the", "this", "to", "what", "when", "which", "why", "with",
}


def tokenize(text: str) -> list[str]:
    return [token for token in TOKEN_PATTERN.findall(text.casefold()) if token not in STOP_WORDS]


class BM25Retriever:
    def __init__(self, chunks: list[KnowledgeChunk]) -> None:
        self.chunks = chunks
        self.term_frequencies = [Counter(tokenize(chunk.text)) for chunk in chunks]
        self.document_lengths = [sum(frequencies.values()) for frequencies in self.term_frequencies]
        self.average_length = (
            sum(self.document_lengths) / len(self.document_lengths) if self.document_lengths else 0
        )
        self.document_frequencies: Counter[str] = Counter()
        for frequencies in self.term_frequencies:
            self.document_frequencies.update(frequencies.keys())

    def retrieve(
        self,
        query: str,
        *,
        limit: int = 6,
        required_terms: set[str] | None = None,
    ) -> list[KnowledgeChunk]:
        query_terms = set(tokenize(query))
        if not query_terms or not self.chunks:
            return []

        total_documents = len(self.chunks)
        scored: list[tuple[float, int]] = []
        k1 = 1.5
        b = 0.75
        for index, frequencies in enumerate(self.term_frequencies):
            if required_terms and not required_terms.intersection(frequencies):
                continue
            score = 0.0
            for term in query_terms:
                frequency = frequencies.get(term, 0)
                if not frequency:
                    continue
                document_frequency = self.document_frequencies[term]
                inverse_frequency = math.log(
                    1 + (total_documents - document_frequency + 0.5) / (document_frequency + 0.5)
                )
                length_ratio = self.document_lengths[index] / self.average_length
                score += inverse_frequency * (
                    frequency * (k1 + 1)
                    / (frequency + k1 * (1 - b + b * length_ratio))
                )
            if score > 0:
                scored.append((score, index))

        scored.sort(key=lambda item: (-item[0], self.chunks[item[1]].chunk_id))
        return [self.chunks[index] for _score, index in scored[:limit]]


def default_docs_dir() -> Path:
    configured = os.getenv("RAG_DOCS_DIR")
    return Path(configured) if configured else Path(__file__).resolve().parents[2] / "docs"


@lru_cache(maxsize=1)
def get_retriever() -> BM25Retriever:
    artifact = build_knowledge_base(default_docs_dir())
    return BM25Retriever(artifact.chunks)
