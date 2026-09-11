import asyncio

import pytest

from app.schemas import (
    ExtractedPage,
    LabResultDraft,
    PatientMetadataDraft,
    StructuredReportDraft,
)
from app.structured_extractor import (
    StructuredExtractionFailed,
    build_report_text,
    extract_structured_report,
    validate_source_evidence,
)


def create_draft(source_page: int, source_text: str) -> StructuredReportDraft:
    return StructuredReportDraft(
        patient=PatientMetadataDraft(age_years=None, sex=None),
        results=[
            LabResultDraft(
                category="Biochemistry",
                name="Glucose",
                value_numeric=92,
                value_text=None,
                unit="mg/dL",
                reference_min=70,
                reference_max=99,
                reported_flag=None,
                source_page=source_page,
                source_text=source_text,
            )
        ],
    )


def test_build_report_text_preserves_page_markers() -> None:
    text = build_report_text([
        ExtractedPage(page_number=1, text="Hemoglobin 13.0"),
        ExtractedPage(page_number=2, text="Glucose 92"),
    ])

    assert "[PAGE 1]\nHemoglobin 13.0" in text
    assert "[PAGE 2]\nGlucose 92" in text


def test_source_evidence_accepts_whitespace_variation() -> None:
    validate_source_evidence(
        create_draft(3, "Glucose 92 70 - 99 mg/dL"),
        [ExtractedPage(page_number=3, text="Glucose  92\n70 - 99 mg/dL")],
    )


def test_source_evidence_rejects_wrong_page() -> None:
    with pytest.raises(StructuredExtractionFailed, match="not found on page 2"):
        validate_source_evidence(
            create_draft(2, "Glucose 92"),
            [ExtractedPage(page_number=1, text="Glucose 92")],
        )


def test_source_evidence_rejects_fabricated_excerpt() -> None:
    with pytest.raises(StructuredExtractionFailed, match="Glucose"):
        validate_source_evidence(
            create_draft(1, "Glucose 192"),
            [ExtractedPage(page_number=1, text="Glucose 92")],
        )


def test_gemini_provider_returns_validated_report(monkeypatch) -> None:
    captured = {}

    class FakeModels:
        async def generate_content(self, **kwargs):
            captured.update(kwargs)
            return type(
                "Response",
                (),
                {"text": create_draft(1, "Glucose 92 70 - 99 mg/dL").model_dump_json()},
            )()

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
    monkeypatch.setattr("app.structured_extractor.genai.Client", FakeClient)

    report = asyncio.run(
        extract_structured_report(
            "sample.pdf",
            [ExtractedPage(page_number=1, text="Glucose 92 70 - 99 mg/dL")],
        )
    )

    assert captured["model"] == "gemini-test-model"
    assert captured["api_key_configured"] is True
    assert captured["closed"] is True
    assert captured["config"].response_mime_type == "application/json"
    assert report.results[0].calculated_status == "normal"
    assert report.results[0].review_status == "pending"