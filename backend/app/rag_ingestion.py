"""Build deterministic, page-traceable chunks from the curated PDF corpus."""

from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

from app.pdf_parser import PDFExtractionError, extract_pages
from app.schemas import KnowledgeBaseArtifact, KnowledgeChunk, KnowledgeDocumentIssue

DEFAULT_CHUNK_SIZE = 1400
DEFAULT_CHUNK_OVERLAP = 200


class KnowledgeBaseIngestionError(ValueError):
    pass


def normalize_text(text: str) -> str:
    """Remove PDF control characters and collapse layout whitespace."""

    return re.sub(r"\s+", " ", text.replace("\x00", " ")).strip()


def chunk_page_text(
    text: str,
    *,
    max_chars: int = DEFAULT_CHUNK_SIZE,
    overlap_chars: int = DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    """Split one page on word boundaries, retaining a small context overlap."""

    if max_chars < 200:
        raise ValueError("max_chars must be at least 200.")
    if overlap_chars < 0 or overlap_chars >= max_chars:
        raise ValueError("overlap_chars must be non-negative and smaller than max_chars.")

    words = normalize_text(text).split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start
        character_count = 0
        while end < len(words):
            added = len(words[end]) + (1 if end > start else 0)
            if end > start and character_count + added > max_chars:
                break
            character_count += added
            end += 1

        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        if overlap_chars == 0:
            start = end
            continue

        overlap_start = end
        overlap_size = 0
        while overlap_start > start:
            candidate_size = len(words[overlap_start - 1]) + (1 if overlap_size else 0)
            if overlap_size and overlap_size + candidate_size > overlap_chars:
                break
            overlap_start -= 1
            overlap_size += candidate_size
        start = max(start + 1, overlap_start)

    return chunks


def build_knowledge_base(
    docs_dir: Path,
    *,
    max_chars: int = DEFAULT_CHUNK_SIZE,
    overlap_chars: int = DEFAULT_CHUNK_OVERLAP,
) -> KnowledgeBaseArtifact:
    """Extract all PDFs in ``docs_dir`` into validated evidence chunks."""

    if not docs_dir.is_dir():
        raise KnowledgeBaseIngestionError(f"Knowledge-base directory does not exist: {docs_dir}")

    pdf_paths = sorted(docs_dir.glob("*.pdf"), key=lambda path: path.name.casefold())
    if not pdf_paths:
        raise KnowledgeBaseIngestionError(f"No PDF documents were found in: {docs_dir}")

    chunks: list[KnowledgeChunk] = []
    issues: list[KnowledgeDocumentIssue] = []
    documents_with_text: set[str] = set()
    for pdf_path in pdf_paths:
        pdf_bytes = pdf_path.read_bytes()
        document_sha256 = hashlib.sha256(pdf_bytes).hexdigest()
        try:
            pages, warnings = extract_pages(pdf_bytes)
        except PDFExtractionError as error:
            issues.append(
                KnowledgeDocumentIssue(
                    source_filename=pdf_path.name,
                    reason=str(error),
                    needs_ocr="No selectable text" in str(error),
                )
            )
            continue

        issues.extend(
            KnowledgeDocumentIssue(
                source_filename=pdf_path.name,
                reason=warning,
                needs_ocr="No selectable text" in warning,
            )
            for warning in warnings
        )

        document_prefix = hashlib.sha256(
            f"{pdf_path.name}:{document_sha256}".encode("utf-8")
        ).hexdigest()[:16]
        document_has_text = False
        for page in pages:
            page_chunks = chunk_page_text(
                page.text,
                max_chars=max_chars,
                overlap_chars=overlap_chars,
            )
            for chunk_number, chunk_text in enumerate(page_chunks, start=1):
                document_has_text = True
                chunks.append(
                    KnowledgeChunk(
                        chunk_id=f"{document_prefix}-p{page.page_number}-c{chunk_number}",
                        source_filename=pdf_path.name,
                        source_page=page.page_number,
                        chunk_number=chunk_number,
                        text=chunk_text,
                        document_sha256=document_sha256,
                        text_sha256=hashlib.sha256(chunk_text.encode("utf-8")).hexdigest(),
                    )
                )
        if document_has_text:
            documents_with_text.add(pdf_path.name)

    if not chunks:
        raise KnowledgeBaseIngestionError(
            "None of the PDF documents contained selectable text. OCR is required."
        )

    return KnowledgeBaseArtifact(
        source_document_count=len(pdf_paths),
        document_count=len(documents_with_text),
        chunk_count=len(chunks),
        chunks=chunks,
        issues=issues,
    )


def save_knowledge_base(artifact: KnowledgeBaseArtifact, output_path: Path) -> None:
    """Persist a validated artifact atomically enough for local development."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    temporary_path.write_text(artifact.model_dump_json(indent=2), encoding="utf-8")
    temporary_path.replace(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the local RAG knowledge-base artifact.")
    parser.add_argument("--docs-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chunk-size", type=int, default=DEFAULT_CHUNK_SIZE)
    parser.add_argument("--chunk-overlap", type=int, default=DEFAULT_CHUNK_OVERLAP)
    args = parser.parse_args()

    artifact = build_knowledge_base(
        args.docs_dir,
        max_chars=args.chunk_size,
        overlap_chars=args.chunk_overlap,
    )
    save_knowledge_base(artifact, args.output)
    print(
        f"Built {artifact.chunk_count} chunks from "
        f"{artifact.document_count}/{artifact.source_document_count} PDF documents "
        f"at {args.output}"
    )
    for issue in artifact.issues:
        print(f"WARNING: {issue.source_filename}: {issue.reason}")


if __name__ == "__main__":
    main()
