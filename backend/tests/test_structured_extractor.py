import asyncio

import pytest
from google.genai import errors

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


def test_source_evidence_corrects_unique_wrong_page() -> None:
    draft = create_draft(2, "Glucose 92")
    validate_source_evidence(
        draft,
        [ExtractedPage(page_number=1, text="Glucose 92 70 - 99 mg/dL"), ExtractedPage(page_number=2, text="Other test")],
    )

    assert draft.results[0].source_page == 1


def test_source_evidence_rejects_ambiguous_page() -> None:
    with pytest.raises(StructuredExtractionFailed, match="matched multiple pages"):
        validate_source_evidence(
            create_draft(3, "Glucose 92"),
            [
                ExtractedPage(page_number=1, text="Glucose 92 70 - 99 mg/dL"),
                ExtractedPage(page_number=2, text="Glucose 92 70 - 99 mg/dL"),
            ],
        )


def test_source_evidence_rejects_fabricated_excerpt() -> None:
    with pytest.raises(StructuredExtractionFailed, match="Glucose"):
        validate_source_evidence(
            create_draft(1, "Glucose 192"),
            [ExtractedPage(page_number=1, text="Glucose 92")],
        )


def test_source_evidence_prefers_selected_page_and_ignores_related_test_name() -> None:
    draft = StructuredReportDraft(
        patient=PatientMetadataDraft(age_years=None, sex=None),
        results=[
            LabResultDraft(
                category="Biochemistry",
                name="BUN",
                value_numeric=15,
                value_text=None,
                unit="mg/dL",
                reference_min=8.87,
                reference_max=20.50,
                reported_flag=None,
                source_page=1,
                source_text="BUN 15.00 mg/dL",
            )
        ],
    )

    validate_source_evidence(
        draft,
        [
            ExtractedPage(
                page_number=1,
                text="Blood Urea Nitrogen (BUN)\n15.00\n8.87 - 20.50 mg/dL",
            ),
            ExtractedPage(
                page_number=2,
                text="BUN Creatinine Ratio\n15.00\n8.87 - 20.50",
            ),
        ],
    )

    assert draft.results[0].source_page == 1


def test_source_evidence_handles_repeated_pdf_text_without_losing_exact_excerpt() -> None:
    draft = create_draft(3, "Serum Bilirubin (Indirect) 1.1 mg/dL 0 - 0.9")
    draft.results[0] = draft.results[0].model_copy(update={
        "name": "Serum Bilirubin (Indirect)",
        "value_numeric": 1.1,
        "reference_min": 0.0,
        "reference_max": 0.9,
    })
    text = "\n".join([
        *(["Serum Bilirubin (Indirect)"] * 4),
        "Sample: Serum",
        "Method: Calculated",
        *(["1.10"] * 4),
        "H",
        "mg/dL",
        "0.00 - 0.90",
        "Next test",
    ])

    validate_source_evidence(draft, [ExtractedPage(page_number=3, text=text)])

    result = draft.results[0]
    assert result.source_page == 3
    assert result.source_text in text
    assert "0.00 - 0.90" in result.source_text
    assert "Next test" not in result.source_text


def test_recovered_source_evidence_is_contiguous_and_can_be_revalidated() -> None:
    draft = create_draft(1, "Glucose: 92 mg/dL; range 70-99")
    text = "Other marker 92\nGlucose\nSample: Serum\n92.00\nmg/dL\n70 - 99"
    pages = [ExtractedPage(page_number=1, text=text)]

    validate_source_evidence(draft, pages)

    assert draft.results[0].source_text in text
    assert draft.results[0].source_text.startswith("Glucose")
    validate_source_evidence(draft, pages)


def test_source_evidence_does_not_match_numbers_inside_other_numbers() -> None:
    with pytest.raises(StructuredExtractionFailed, match="Glucose"):
        validate_source_evidence(
            create_draft(1, "Glucose 92"),
            [ExtractedPage(page_number=1, text="Glucose\n192\n170 - 199")],
        )


def test_source_evidence_handles_wrapped_test_name() -> None:
    draft = create_draft(3, "Serum Bilirubin (Indirect): 1.1")
    draft.results[0] = draft.results[0].model_copy(update={
        "name": "Serum Bilirubin (Indirect)",
        "value_numeric": 1.1,
        "reference_min": 0.0,
        "reference_max": 0.9,
    })
    text = "Serum Bilirubin\n(Indirect)\nSample: Serum\n1.10\nmg/dL\n0.00 - 0.90"

    validate_source_evidence(draft, [ExtractedPage(page_number=3, text=text)])

    assert draft.results[0].source_text in text


def test_source_evidence_does_not_borrow_values_from_next_result() -> None:
    draft = create_draft(1, "Glucose: 92")
    draft.results.append(draft.results[0].model_copy(update={
        "name": "Other marker",
        "source_text": "Other marker 92 70 - 99",
    }))

    with pytest.raises(StructuredExtractionFailed, match="Glucose"):
        validate_source_evidence(
            draft,
            [ExtractedPage(page_number=1, text="Glucose\n192\nOther marker\n92\n70 - 99")],
        )


@pytest.mark.parametrize("range_text", ["70-99", "70 - 99"])
def test_source_evidence_matches_numeric_formatting_not_substrings(range_text: str) -> None:
    draft = create_draft(1, "Glucose: 92.0")
    text = f"Glucose\n92.00\n{range_text}"

    validate_source_evidence(draft, [ExtractedPage(page_number=1, text=text)])

    assert draft.results[0].source_text in text


def test_source_evidence_does_not_match_opposite_numeric_sign() -> None:
    with pytest.raises(StructuredExtractionFailed, match="Glucose"):
        validate_source_evidence(
            create_draft(1, "Glucose: 92"),
            [ExtractedPage(page_number=1, text="Glucose\n-92\n70 - 99")],
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
            "synthetic-person.pdf",
            [ExtractedPage(page_number=1, text="Name: Synthetic Person\nGlucose 92 70 - 99 mg/dL")],
        )
    )

    assert captured["model"] == "gemini-test-model"
    assert captured["api_key_configured"] is True
    assert captured["closed"] is True
    assert captured["config"].response_mime_type == "application/json"
    assert "Synthetic Person" not in captured["contents"]
    assert "synthetic-person.pdf" not in captured["contents"]
    assert "Glucose 92 70 - 99 mg/dL" in captured["contents"]
    assert report.results[0].calculated_status == "normal"
    assert report.results[0].review_status == "pending"


@pytest.mark.parametrize(
    ("code", "expected_message"),
    [
        (400, "rejected the extraction request"),
        (401, "authentication failed"),
        (403, "access was denied"),
        (404, "configured Gemini model is unavailable"),
        (429, "rate limit or quota"),
        (500, "temporarily unavailable"),
        (503, "temporarily unavailable"),
        (418, "could not process this report"),
    ],
)
def test_gemini_errors_are_actionable_and_do_not_expose_provider_data(
    monkeypatch, caplog, code, expected_message,
) -> None:
    closed = []
    provider_error = errors.APIError(
        code,
        {"error": {"code": code, "message": "private-provider-details"}},
    )

    class FakeModels:
        async def generate_content(self, **kwargs):
            raise provider_error

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            closed.append(True)

    class FakeClient:
        def __init__(self, api_key):
            self.aio = FakeAsyncClient()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.structured_extractor.genai.Client", FakeClient)

    with pytest.raises(StructuredExtractionFailed, match=expected_message) as caught:
        asyncio.run(
            extract_structured_report(
                "synthetic.pdf",
                [ExtractedPage(page_number=1, text="Synthetic report")],
            )
        )

    assert caught.value.__cause__ is provider_error
    assert closed == [True]
    assert f"HTTP {code}" in caplog.text
    assert "private-provider-details" not in str(caught.value)
    assert "private-provider-details" not in caplog.text
    assert "test-key" not in caplog.text