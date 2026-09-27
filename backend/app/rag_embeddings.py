"""Gemini embedding boundary used for document indexing and semantic queries."""

from __future__ import annotations

import math
import os

from google import genai
from google.genai import types

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
DEFAULT_EMBEDDING_DIMENSIONS = 768


class EmbeddingError(RuntimeError):
    pass


class GeminiEmbedder:
    def __init__(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise EmbeddingError("Set GEMINI_API_KEY before generating embeddings.")
        self.model = os.getenv("GEMINI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        self.dimensions = int(
            os.getenv("RAG_EMBEDDING_DIMENSIONS", str(DEFAULT_EMBEDDING_DIMENSIONS))
        )
        if self.dimensions != DEFAULT_EMBEDDING_DIMENSIONS:
            raise EmbeddingError(
                "The current pgvector schema requires RAG_EMBEDDING_DIMENSIONS=768."
            )
        self.client = genai.Client(api_key=api_key)

    async def _embed(self, texts: list[str], task_type: str) -> list[list[float]]:
        if not texts:
            return []
        response = await self.client.aio.models.embed_content(
            model=self.model,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=self.dimensions,
            ),
        )
        embeddings = response.embeddings or []
        if len(embeddings) != len(texts):
            raise EmbeddingError("The embedding service returned an unexpected result count.")
        vectors: list[list[float]] = []
        for embedding in embeddings:
            values = list(embedding.values or [])
            if len(values) != self.dimensions:
                raise EmbeddingError("The embedding service returned an unexpected dimension.")
            # gemini-embedding-001 requires manual normalization when truncated.
            magnitude = math.sqrt(sum(value * value for value in values))
            if not magnitude:
                raise EmbeddingError("The embedding service returned a zero vector.")
            vectors.append([value / magnitude for value in values])
        return vectors

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "RETRIEVAL_DOCUMENT")

    async def embed_queries(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "RETRIEVAL_QUERY")

    async def close(self) -> None:
        await self.client.aio.aclose()
