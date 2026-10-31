import json

import pymupdf
import pytesseract
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import LabResult, ReportAnswer, ResultAnswer, StructuredReport

client = TestClient(app)


def create_pdf(page_texts: list[str]) -> bytes:
    document = pymupdf.open()
    for text in page_texts:
        page = document.new_page()
        if text:
            page.insert_text((72, 72), text)
    contents = document.tobytes()
    document.close()
    return contents


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_extracts_text_with_page_numbers() -> None:
    response = client.post(
        "/api/reports/extract",
        files={"file": ("sample.pdf", create_pdf(["Hemoglobin: 13.4 g/dL", "Glucose: 92 mg/dL"]), "application/pdf")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["filename"] == "sample.pdf"
    assert payload["page_count"] == 2
    assert payload["pages"][0]["page_number"] == 1
    assert payload["pages"][0]["text"] == "Hemoglobin: 13.4 g/dL"
    assert payload["pages"][0]["extraction_method"] == "native"
    assert payload["pages"][0]["needs_review"] is False
    assert payload["pages"][1]["page_number"] == 2
    assert payload["warnings"] == []


def test_rejects_non_pdf_upload() -> None:
    response = client.post(
        "/api/reports/extract",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )

    assert response.status_code == 415
    assert response.json()["detail"] == "Only PDF files are supported."


@pytest.mark.parametrize(
    ("contents", "expected_status", "message"),
    [
        (b"not PDF content", 400, "valid PDF signature"),
        (b"%PDF-1.4 corrupt synthetic fixture", 400, "not a readable PDF"),
        (b"%PDF-" + b"0" * (10 * 1024 * 1024), 413, "10 MB or smaller"),
    ],
    ids=["invalid-signature", "corrupt-pdf", "oversized-pdf"],
)
def test_rejects_invalid_and_oversized_pdf(contents, expected_status, message) -> None:
    response = client.post(
        "/api/reports/extract",
        files={"file": ("synthetic-invalid.pdf", contents, "application/pdf")},
    )
    assert response.status_code == expected_status
    assert message in response.json()["detail"]


def test_rejects_password_protected_pdf() -> None:
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), "Synthetic laboratory fixture")
    contents = document.tobytes(
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        owner_pw="synthetic-owner", user_pw="synthetic-reader",
    )
    document.close()
    response = client.post(
        "/api/reports/extract",
        files={"file": ("synthetic-protected.pdf", contents, "application/pdf")},
    )
    assert response.status_code == 400
    assert "Password-protected" in response.json()["detail"]


def test_missing_ocr_executable_returns_actionable_error(monkeypatch) -> None:
    def unavailable(_image):
        raise pytesseract.TesseractNotFoundError()
    monkeypatch.setattr("app.pdf_parser.pytesseract.image_to_string", unavailable)
    response = client.post(
        "/api/reports/extract",
        files={"file": ("synthetic-scan.pdf", create_pdf([""]), "application/pdf")},
    )
    assert response.status_code == 400
    assert "Install the Tesseract OCR executable" in response.json()["detail"]


def test_explains_when_pdf_has_no_selectable_text() -> None:
    response = client.post(
        "/api/reports/extract",
        files={"file": ("scan.pdf", create_pdf([""]), "application/pdf")},
    )

    assert response.status_code == 400
    assert "No readable text" in response.json()["detail"]


def test_uses_tesseract_for_empty_pages(monkeypatch) -> None:
    monkeypatch.setattr("app.pdf_parser.pytesseract.image_to_string", lambda image: "Glucose 92 mg/dL")
    response = client.post(
        "/api/reports/extract",
        files={"file": ("scan.pdf", create_pdf([""]), "application/pdf")},
    )

    assert response.status_code == 200
    page = response.json()["pages"][0]
    assert page["text"] == "Glucose 92 mg/dL"
    assert page["extraction_method"] == "tesseract"
    assert page["needs_review"] is True
    assert "Tesseract OCR was used" in response.json()["warnings"][0]


def test_structure_requires_cloud_processing_confirmation() -> None:
    response = client.post(
        "/api/reports/structure",
        files={"file": ("sample.pdf", create_pdf(["Glucose: 92 mg/dL"]), "application/pdf")},
    )

    assert response.status_code == 400
    assert "synthetic or de-identified" in response.json()["detail"]


def test_structure_returns_pending_results(monkeypatch) -> None:
    async def fake_structured_extraction(filename, pages):
        return StructuredReport(
            filename=filename,
            results=[
                LabResult(
                    category="Biochemistry",
                    name="Glucose",
                    value_numeric=92,
                    unit="mg/dL",
                    reference_min=70,
                    reference_max=99,
                    calculated_status="normal",
                    source_page=pages[0].page_number,
                    source_text="Glucose 92 70 - 99 mg/dL",
                )
            ],
        )

    monkeypatch.setattr("app.main.extract_structured_report", fake_structured_extraction)
    response = client.post(
        "/api/reports/structure",
        files={"file": ("sample.pdf", create_pdf(["Glucose 92 70 - 99 mg/dL"]), "application/pdf")},
        data={
            "cloud_processing_allowed": "true",
            "privacy_review_confirmed": "true",
            "reviewed_pages": json.dumps([{"page_number": 1, "text": "Glucose 92 70 - 99 mg/dL"}]),
        },
    )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["calculated_status"] == "normal"
    assert result["review_status"] == "pending"
    assert result["source_page"] == 1


def test_structure_requires_privacy_review_before_provider_call(monkeypatch) -> None:
    async def forbidden(*args):
        raise AssertionError("Provider must not be called before privacy review")
    monkeypatch.setattr("app.main.extract_structured_report", forbidden)
    response = client.post(
        "/api/reports/structure",
        files={"file": ("sample.pdf", create_pdf(["Name: Synthetic Person\nGlucose 92"]), "application/pdf")},
        data={"cloud_processing_allowed": "true"},
    )
    assert response.status_code == 400
    assert "cloud text preview" in response.json()["detail"]


def test_cloud_preview_strips_name_and_sends_only_reviewed_text(monkeypatch) -> None:
    pdf = create_pdf(["Patient Name: Synthetic Person\nUnlabeled synthetic header\nGlucose 92"])
    preview = client.post("/api/reports/extract", files={"file": ("synthetic-person.pdf", pdf, "application/pdf")}).json()
    assert "Synthetic Person" in preview["pages"][0]["text"]
    assert "Synthetic Person" not in preview["cloud_pages"][0]["text"]
    assert preview["privacy_removed_lines"] == 1
    captured = []
    async def fake(filename, pages):
        captured.extend(pages)
        return StructuredReport(filename=filename, results=[])
    monkeypatch.setattr("app.main.extract_structured_report", fake)
    response = client.post(
        "/api/reports/structure",
        files={"file": ("synthetic-person.pdf", pdf, "application/pdf")},
        data={"cloud_processing_allowed": "true", "privacy_review_confirmed": "true", "reviewed_pages": json.dumps([{"page_number": 1, "text": "Glucose 92"}])},
    )
    assert response.status_code == 200
    assert captured[0].text == "Glucose 92"


def test_cloud_preview_rejects_invented_text(monkeypatch) -> None:
    async def forbidden(*args):
        raise AssertionError("Provider must not be called for invalid previews")
    monkeypatch.setattr("app.main.extract_structured_report", forbidden)
    for pages in [
        [{"page_number": 1, "text": "Glucose 95"}],
        [{"page_number": 2, "text": "Glucose 92"}],
        [{"page_number": 1, "text": ""}],
    ]:
        response = client.post(
            "/api/reports/structure",
            files={"file": ("sample.pdf", create_pdf(["Glucose 92"]), "application/pdf")},
            data={"cloud_processing_allowed": "true", "privacy_review_confirmed": "true", "reviewed_pages": json.dumps(pages)},
        )
        assert response.status_code == 400


def test_result_question_requires_confirmed_result() -> None:
    response = client.post(
        "/api/results/ask",
        json={
            "result": {
                "name": "Glucose",
                "value_numeric": 92,
                "source_page": 1,
                "source_text": "Glucose 92 mg/dL",
                "review_status": "pending",
            },
            "question": "What does this measure?",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only confirmed results can be discussed."


def test_result_question_returns_educational_answer(monkeypatch) -> None:
    async def fake_answer(request):
        assert request.result.name == "Glucose"
        return ResultAnswer(
            answer="Glucose is a sugar your body uses for energy.",
            safety_note="This result alone cannot diagnose a condition.",
            suggested_questions=["How does timing affect this result?"],
        )

    monkeypatch.setattr("app.main.answer_result_question", fake_answer)
    response = client.post(
        "/api/results/ask",
        json={
            "result": {
                "name": "Glucose",
                "value_numeric": 92,
                "unit": "mg/dL",
                "reference_min": 70,
                "reference_max": 99,
                "calculated_status": "normal",
                "source_page": 1,
                "source_text": "Glucose 92 70 - 99 mg/dL",
                "review_status": "confirmed",
            },
            "question": "What does this measure?",
        },
    )

    assert response.status_code == 200
    assert response.json()["answer"].startswith("Glucose is")
    assert len(response.json()["suggested_questions"]) == 1


def test_report_question_rejects_pending_results() -> None:
    response = client.post(
        "/api/reports/ask",
        json={
            "results": [{
                "name": "Glucose",
                "value_numeric": 105,
                "source_page": 1,
                "source_text": "Glucose 105 mg/dL",
                "review_status": "pending",
            }],
            "question": "What stands out?",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only confirmed results can be discussed."


def test_report_question_returns_grounded_answer(monkeypatch) -> None:
    async def fake_answer(request):
        assert len(request.results) == 1
        assert request.results[0].name == "Glucose"
        return ReportAnswer(
            answer="Glucose is above its listed interval.",
            safety_note="This does not establish a diagnosis.",
            cited_result_names=["Glucose"],
            suggested_questions=["Was this sample fasting?"],
        )

    monkeypatch.setattr("app.main.answer_report_question", fake_answer)
    response = client.post(
        "/api/reports/ask",
        json={
            "results": [{
                "name": "Glucose",
                "value_numeric": 105,
                "unit": "mg/dL",
                "reference_min": 70,
                "reference_max": 99,
                "calculated_status": "high",
                "source_page": 1,
                "source_text": "Glucose 105 70 - 99 mg/dL",
                "review_status": "confirmed",
            }],
            "question": "What stands out?",
        },
    )

    assert response.status_code == 200
    assert response.json()["cited_result_names"] == ["Glucose"]
    assert response.json()["suggested_questions"] == ["Was this sample fasting?"]


def test_english_translation_does_not_require_model_call() -> None:
    response = client.post(
        "/api/translate",
        json={"texts": ["What it is", "Why it is checked"], "language": "en"},
    )

    assert response.status_code == 200
    assert response.json()["texts"] == ["What it is", "Why it is checked"]
