"""PostgreSQL/pgvector persistence and cosine-similarity search."""

from __future__ import annotations

import os
from pathlib import Path

import psycopg
from pgvector import Vector
from pgvector.psycopg import register_vector

from app.schemas import KnowledgeChunk


class VectorStoreError(RuntimeError):
    pass


class PostgresVectorStore:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            raise VectorStoreError("Set DATABASE_URL to use PostgreSQL vector retrieval.")

    def _connect(self):
        return psycopg.connect(self.database_url)

    def initialize(self) -> None:
        migration = Path(__file__).resolve().parents[1] / "migrations" / "001_rag_pgvector.sql"
        with self._connect() as connection:
            connection.execute(migration.read_text(encoding="utf-8"))
            connection.commit()

    def upsert_chunks(
        self,
        chunks: list[KnowledgeChunk],
        embeddings: list[list[float]],
        embedding_model: str,
    ) -> None:
        if len(chunks) != len(embeddings):
            raise VectorStoreError("Every chunk must have exactly one embedding.")
        with self._connect() as connection:
            register_vector(connection)
            with connection.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO rag_knowledge_chunks (
                        chunk_id, source_filename, source_page, chunk_number, content,
                        document_sha256, text_sha256, embedding_model, embedding
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (chunk_id) DO UPDATE SET
                        content = EXCLUDED.content,
                        text_sha256 = EXCLUDED.text_sha256,
                        embedding_model = EXCLUDED.embedding_model,
                        embedding = EXCLUDED.embedding,
                        indexed_at = now()
                    """,
                    [
                        (
                            chunk.chunk_id,
                            chunk.source_filename,
                            chunk.source_page,
                            chunk.chunk_number,
                            chunk.text,
                            chunk.document_sha256,
                            chunk.text_sha256,
                            embedding_model,
                            Vector(embedding),
                        )
                        for chunk, embedding in zip(chunks, embeddings, strict=True)
                    ],
                )
            connection.commit()

    def search(self, embedding: list[float], *, limit: int = 6) -> list[KnowledgeChunk]:
        try:
            with self._connect() as connection:
                register_vector(connection)
                rows = connection.execute(
                    """
                    SELECT chunk_id, source_filename, source_page, chunk_number, content,
                           document_sha256, text_sha256
                    FROM rag_knowledge_chunks
                    ORDER BY embedding <=> %s
                    LIMIT %s
                    """,
                    (Vector(embedding), limit),
                ).fetchall()
        except psycopg.Error as error:
            raise VectorStoreError("PostgreSQL vector search failed.") from error
        return [
            KnowledgeChunk(
                chunk_id=row[0],
                source_filename=row[1],
                source_page=row[2],
                chunk_number=row[3],
                text=row[4],
                document_sha256=row[5],
                text_sha256=row[6],
            )
            for row in rows
        ]

    def count(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT count(*) FROM rag_knowledge_chunks").fetchone()
        return int(row[0]) if row else 0
