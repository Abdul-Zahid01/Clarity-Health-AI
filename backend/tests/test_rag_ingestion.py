import hashlib
from pathlib import Path

import pymupdf
import pytest
from pydantic import ValidationError

from app.rag_ingestion import (
    KnowledgeBaseIngestionError,
    build_knowledge_base,
    chunk_page_text,
    normalize_text,
)
from app.schemas import KnowledgeBaseArtifact, KnowledgeChunk


def create_pdf(path: Path, page_texts: list[str]) -> None:
    document = pymupdf.open()
    for text in page_texts:
        page = document.new_page()
        if text:
            page.insert_textbox((72, 72, 520, 760), text)
    document.save(path)
    document.close()


def test_normalizes_pdf_whitespace() -> None:
    assert normalize_text("Glucose\n\t 92\x00 mg/dL") == "Glucose 92 mg/dL"


def test_chunks_are_bounded_and_overlap() -> None:
    text = " ".join(f"word-{index:03d}" for index in range(100))

    chunks = chunk_page_text(text, max_chars=200, overlap_chars=40)

    assert len(chunks) > 1
    assert all(len(chunk) <= 200 for chunk in chunks)
    assert set(chunks[0].split()) & set(chunks[1].split())


def test_builds_page_traceable_validated_chunks(tmp_path: Path) -> None:
    create_pdf(
        tmp_path / "blood-reference.pdf",
        ["Hemoglobin carries oxygen through the blood.", "Glucose is used for energy."],
    )

    artifact = build_knowledge_base(tmp_path)

    assert artifact.source_document_count == 1
    assert artifact.document_count == 1
    assert artifact.chunk_count == 2
    assert [chunk.source_page for chunk in artifact.chunks] == [1, 2]
    assert all(chunk.source_filename == "blood-reference.pdf" for chunk in artifact.chunks)
    assert all(len(chunk.document_sha256) == 64 for chunk in artifact.chunks)
    assert artifact.chunks[0].text_sha256 == hashlib.sha256(
        artifact.chunks[0].text.encode("utf-8")
    ).hexdigest()


def test_ignores_non_pdf_files(tmp_path: Path) -> None:
    create_pdf(tmp_path / "reference.pdf", ["A supported medical reference."])
    (tmp_path / "project-notes.md").write_text("Not part of the corpus.", encoding="utf-8")

    artifact = build_knowledge_base(tmp_path)

    assert artifact.document_count == 1
    assert {chunk.source_filename for chunk in artifact.chunks} == {"reference.pdf"}


def test_requires_at_least_one_pdf(tmp_path: Path) -> None:
    with pytest.raises(KnowledgeBaseIngestionError, match="No PDF documents"):
        build_knowledge_base(tmp_path)


def test_reports_scanned_pdf_instead_of_silently_ignoring_it(tmp_path: Path) -> None:
    create_pdf(tmp_path / "readable.pdf", ["Selectable medical evidence."])
    create_pdf(tmp_path / "scan.pdf", [""])

    artifact = build_knowledge_base(tmp_path)

    assert artifact.source_document_count == 2
    assert artifact.document_count == 1
    assert len(artifact.issues) == 1
    assert artifact.issues[0].source_filename == "scan.pdf"
    assert artifact.issues[0].needs_ocr is True


def test_pydantic_rejects_tampered_provenance() -> None:
    with pytest.raises(ValidationError):
        KnowledgeChunk(
            chunk_id="unsafe",
            source_filename="source.pdf",
            source_page=0,
            chunk_number=1,
            text="Evidence",
            document_sha256="not-a-hash",
            text_sha256="not-a-hash",
        )


def test_artifact_rejects_incorrect_counts() -> None:
    with pytest.raises(ValidationError, match="chunk_count"):
        KnowledgeBaseArtifact(
            source_document_count=0,
            document_count=0,
            chunk_count=1,
            chunks=[],
        )
