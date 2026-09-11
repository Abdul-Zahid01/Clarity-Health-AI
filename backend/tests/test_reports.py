import pymupdf
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
    assert payload["pages"][0] == {
        "page_number": 1,
        "text": "Hemoglobin: 13.4 g/dL",
    }
    assert payload["pages"][1]["page_number"] == 2
    assert payload["warnings"] == []


def test_rejects_non_pdf_upload() -> None:
    response = client.post(
        "/api/reports/extract",
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )

    assert response.status_code == 415
    assert response.json()["detail"] == "Only PDF files are supported."


def test_explains_when_pdf_has_no_selectable_text() -> None:
    response = client.post(
        "/api/reports/extract",
        files={"file": ("scan.pdf", create_pdf([""]), "application/pdf")},
    )

    assert response.status_code == 400
    assert "No selectable text" in response.json()["detail"]


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
        data={"cloud_processing_allowed": "true"},
    )

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert result["calculated_status"] == "normal"
    assert result["review_status"] == "pending"
    assert result["source_page"] == 1


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
