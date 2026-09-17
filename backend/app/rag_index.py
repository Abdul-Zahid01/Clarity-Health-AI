"""CLI that embeds the curated corpus and upserts it into PostgreSQL/pgvector."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from dotenv import load_dotenv

from app.rag_embeddings import GeminiEmbedder
from app.rag_ingestion import build_knowledge_base
from app.rag_vector_store import PostgresVectorStore

load_dotenv()


async def index_knowledge_base(docs_dir: Path, *, batch_size: int = 32) -> tuple[int, int]:
    artifact = build_knowledge_base(docs_dir)
    store = PostgresVectorStore()
    await asyncio.to_thread(store.initialize)
    embedder = GeminiEmbedder()
    try:
        for start in range(0, len(artifact.chunks), batch_size):
            batch = artifact.chunks[start:start + batch_size]
            texts = [
                f"Document: {chunk.source_filename}\nPage: {chunk.source_page}\n{chunk.text}"
                for chunk in batch
            ]
            embeddings = await embedder.embed_documents(texts)
            await asyncio.to_thread(store.upsert_chunks, batch, embeddings, embedder.model)
            print(f"Indexed {min(start + len(batch), len(artifact.chunks))}/{len(artifact.chunks)} chunks")
    finally:
        await embedder.close()
    return artifact.chunk_count, len(artifact.issues)


def main() -> None:
    parser = argparse.ArgumentParser(description="Index docs into PostgreSQL with pgvector.")
    parser.add_argument("--docs-dir", type=Path, default=Path(__file__).resolve().parents[2] / "docs")
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()
    chunk_count, issue_count = asyncio.run(
        index_knowledge_base(args.docs_dir, batch_size=args.batch_size)
    )
    print(f"Completed: {chunk_count} chunks indexed; {issue_count} document issues reported.")


if __name__ == "__main__":
    main()
