CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_knowledge_chunks (
    chunk_id text PRIMARY KEY,
    source_filename text NOT NULL,
    source_page integer NOT NULL CHECK (source_page >= 1),
    chunk_number integer NOT NULL CHECK (chunk_number >= 1),
    content text NOT NULL,
    document_sha256 char(64) NOT NULL,
    text_sha256 char(64) NOT NULL,
    embedding_model text NOT NULL,
    embedding vector(768) NOT NULL,
    indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rag_knowledge_chunks_embedding_hnsw
ON rag_knowledge_chunks
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS rag_knowledge_chunks_source
ON rag_knowledge_chunks (source_filename, source_page);
