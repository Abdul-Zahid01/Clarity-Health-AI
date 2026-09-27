import asyncio
import json

import pytest

from app.rag_assistant import RagAssistantFailed, _quote_is_in_evidence, answer_rag_question
from app.rag_retriever import BM25Retriever
from app.schemas import (
    GroundedClaim,
    GroundingCitation,
    KnowledgeChunk,
    LabResult,
    RagModelResponse,
    RagQuestionRequest,
)


def knowledge_chunk(chunk_id: str, text: str) -> KnowledgeChunk:
    return KnowledgeChunk(
        chunk_id=chunk_id,
        source_filename="reference.pdf",
        source_page=4,
        chunk_number=1,
        text=text,
        document_sha256="a" * 64,
        text_sha256="b" * 64,
    )


def confirmed_glucose_request() -> RagQuestionRequest:
    return RagQuestionRequest(
        results=[LabResult(
            name="Glucose",
            value_numeric=105,
            unit="mg/dL",
            reference_min=70,
            reference_max=99,
            calculated_status="high",
            source_page=1,
            source_text="Glucose 105 70 - 99 mg/dL",
            review_status="confirmed",
        )],
        question="What does glucose mean in my report?",
    )


def test_bm25_retrieves_relevant_medical_chunk() -> None:
    glucose = knowledge_chunk("glucose", "Glucose is a sugar used by the body for energy.")
    thyroid = knowledge_chunk("thyroid", "Thyroid stimulating hormone is produced by the pituitary.")

    results = BM25Retriever([thyroid, glucose]).retrieve("What is glucose?", limit=1)

    assert [chunk.chunk_id for chunk in results] == ["glucose"]


def test_bm25_can_require_the_report_test_name() -> None:
    generic = knowledge_chunk("generic", "The body depends on many important laboratory measurements.")
    creatinine = knowledge_chunk("creatinine", "Creatinine is used when evaluating renal function.")

    results = BM25Retriever([generic, creatinine]).retrieve(
        "Why is this important for my body? Creatinine",
        limit=1,
        required_terms={"creatinine"},
    )

    assert [chunk.chunk_id for chunk in results] == ["creatinine"]


def test_quote_verification_tolerates_only_pdf_typography_changes() -> None:
    source = "The listed reference interval is 0.6�1.3 mg/dL and indicates kidney dis- ease."

    assert _quote_is_in_evidence("reference interval is 0.6–1.3 mg/dL", source)
    assert _quote_is_in_evidence("indicates kidney disease", source)
    assert not _quote_is_in_evidence("Creatinine treats kidney disease", source)


def test_rag_answer_requires_real_source_and_exact_quote(monkeypatch) -> None:
    captured = {}
    retrieved = knowledge_chunk("kb-glucose", "Glucose is a sugar used by the body for energy.")
    model_answer = RagModelResponse(
        answerable=True,
        claims=[GroundedClaim(
            text="Glucose is used by the body for energy.",
            citations=[GroundingCitation(
                source_id="kb-glucose",
                evidence_quote="Glucose is a sugar used by the body for energy.",
            )],
        )],
    )

    class FakeRetriever:
        def retrieve(self, query, *, limit, required_terms=None):
            captured["query"] = query
            captured["required_terms"] = required_terms
            return [retrieved]

    class FakeModels:
        async def generate_content(self, **kwargs):
            captured.update(kwargs)
            return type("Response", (), {"text": model_answer.model_dump_json()})()

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            captured["closed"] = True

    class FakeClient:
        def __init__(self, api_key):
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.rag_assistant.get_retriever", lambda: FakeRetriever())
    monkeypatch.setattr("app.rag_assistant.genai.Client", FakeClient)

    answer = asyncio.run(answer_rag_question(confirmed_glucose_request()))

    assert answer.answerable is True
    assert answer.answer == "Glucose is used by the body for energy."
    assert [source.source_id for source in answer.sources] == ["kb-glucose"]
    assert captured["config"].temperature == 0
    assert "SOURCE ID: kb-glucose" in captured["contents"]
    assert captured["required_terms"] == {"glucose"}
    assert captured["closed"] is True


@pytest.mark.parametrize(
    ("source_id", "quote"),
    [
        ("invented-source", "Glucose is a sugar"),
        ("kb-glucose", "A quote that is absent"),
    ],
)
def test_rag_rejects_fabricated_evidence_without_exposing_a_red_error(monkeypatch, source_id, quote) -> None:
    retrieved = knowledge_chunk("kb-glucose", "Glucose is a sugar used by the body for energy.")
    payload = {
        "answerable": True,
        "claims": [{
            "text": "Glucose is used for energy.",
            "citations": [{"source_id": source_id, "evidence_quote": quote}],
        }],
    }

    class FakeRetriever:
        def retrieve(self, query, *, limit, required_terms=None):
            return [retrieved]

    class FakeModels:
        async def generate_content(self, **kwargs):
            return type("Response", (), {"text": json.dumps(payload)})()

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            return None

    class FakeClient:
        def __init__(self, api_key):
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.rag_assistant.get_retriever", lambda: FakeRetriever())
    monkeypatch.setattr("app.rag_assistant.genai.Client", FakeClient)

    answer = asyncio.run(answer_rag_question(confirmed_glucose_request()))

    assert answer.answerable is False
    assert "could not verify every claim" in answer.answer


def test_rag_returns_fixed_refusal_when_evidence_is_insufficient(monkeypatch) -> None:
    model_answer = RagModelResponse(answerable=False)

    class FakeRetriever:
        def retrieve(self, query, *, limit, required_terms=None):
            return []

    class FakeModels:
        async def generate_content(self, **kwargs):
            return type("Response", (), {"text": model_answer.model_dump_json()})()

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            return None

    class FakeClient:
        def __init__(self, api_key):
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.rag_assistant.get_retriever", lambda: FakeRetriever())
    monkeypatch.setattr("app.rag_assistant.genai.Client", FakeClient)

    answer = asyncio.run(answer_rag_question(confirmed_glucose_request()))

    assert answer.answerable is False
    assert "couldn't find enough information" in answer.answer
    assert answer.claims == []
    assert answer.sources == []
