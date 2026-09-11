import asyncio

import pytest

from app.result_assistant import (
    ResultAssistantFailed,
    answer_report_question,
    answer_result_question,
)
from app.schemas import (
    LabResult,
    ReportAnswer,
    ReportQuestionRequest,
    ResultAnswer,
    ResultQuestionRequest,
)


def test_gemini_result_assistant_returns_validated_answer(monkeypatch) -> None:
    captured = {}
    expected = ResultAnswer(
        answer="Hemoglobin helps red blood cells carry oxygen.",
        safety_note="This result alone cannot diagnose a condition.",
        suggested_questions=["What else is usually reviewed with hemoglobin?"],
    )

    class FakeModels:
        async def generate_content(self, **kwargs):
            captured.update(kwargs)
            return type("Response", (), {"text": expected.model_dump_json()})()

    class FakeAsyncClient:
        def __init__(self):
            self.models = FakeModels()

        async def aclose(self):
            captured["closed"] = True

    class FakeClient:
        def __init__(self, api_key):
            captured["api_key_configured"] = bool(api_key)
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-test-model")
    monkeypatch.setattr("app.result_assistant.genai.Client", FakeClient)
    request = ResultQuestionRequest(
        result=LabResult(
            name="Hemoglobin",
            value_numeric=11.2,
            unit="g/dL",
            reference_min=12,
            reference_max=16,
            calculated_status="low",
            source_page=1,
            source_text="Hemoglobin 11.2 12 - 16 g/dL",
            review_status="confirmed",
        ),
        question="What does this do?",
    )

    answer = asyncio.run(answer_result_question(request))

    assert answer.answer == expected.answer
    assert answer.safety_note == expected.safety_note
    assert answer.suggested_questions == expected.suggested_questions
    assert {reference.source for reference in answer.references} == {"PubMed", "MedlinePlus"}
    assert captured["model"] == "gemini-test-model"
    assert captured["api_key_configured"] is True
    assert captured["closed"] is True
    assert captured["config"].response_mime_type == "application/json"
    assert "CONFIRMED RESULT DATA" in captured["contents"]


def confirmed_glucose() -> LabResult:
    return LabResult(
        name="Glucose",
        value_numeric=105,
        unit="mg/dL",
        reference_min=70,
        reference_max=99,
        calculated_status="high",
        source_page=1,
        source_text="Glucose 105 70 - 99 mg/dL",
        review_status="confirmed",
    )


def test_report_assistant_validates_cited_results(monkeypatch) -> None:
    expected = ReportAnswer(
        answer="Glucose is above the listed interval.",
        safety_note="This does not establish a diagnosis.",
        cited_result_names=["Glucose"],
        suggested_questions=["Was this sample fasting?"],
    )

    class FakeModels:
        async def generate_content(self, **kwargs):
            return type("Response", (), {"text": expected.model_dump_json()})()

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            return None

    class FakeClient:
        def __init__(self, api_key):
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.result_assistant.genai.Client", FakeClient)
    request = ReportQuestionRequest(
        results=[confirmed_glucose()],
        question="What stands out?",
    )

    answer = asyncio.run(answer_report_question(request))
    assert answer.answer == expected.answer
    assert answer.cited_result_names == expected.cited_result_names
    assert {reference.source for reference in answer.references} == {"PubMed", "MedlinePlus"}


def test_report_assistant_rejects_fabricated_citation(monkeypatch) -> None:
    answer = ReportAnswer(
        answer="A result was cited incorrectly.",
        safety_note="Educational only.",
        cited_result_names=["Vitamin D"],
        suggested_questions=[],
    )

    class FakeModels:
        async def generate_content(self, **kwargs):
            return type("Response", (), {"text": answer.model_dump_json()})()

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            return None

    class FakeClient:
        def __init__(self, api_key):
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.result_assistant.genai.Client", FakeClient)

    with pytest.raises(ResultAssistantFailed, match="not in this report"):
        asyncio.run(answer_report_question(ReportQuestionRequest(
            results=[confirmed_glucose()],
            question="What stands out?",
        )))