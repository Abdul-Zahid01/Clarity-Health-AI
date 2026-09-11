from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from app.pdf_parser import PDFExtractionError, extract_pages
from app.result_assistant import (
    ResultAssistantFailed,
    ResultAssistantUnavailable,
    answer_report_question,
    answer_result_question,
    translate_education,
)
from app.schemas import (
    ReportAnswer,
    ReportExtractionResponse,
    ReportQuestionRequest,
    ResultAnswer,
    ResultQuestionRequest,
    StructuredReport,
    TranslationRequest,
    TranslationResponse,
)
from app.structured_extractor import (
    StructuredExtractionFailed,
    StructuredExtractionUnavailable,
    extract_structured_report,
)

MAX_FILE_SIZE = 10 * 1024 * 1024

app = FastAPI(
    title="Health Report Analyser API",
    description="Extracts page-level text from synthetic health report PDFs.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/reports/extract", response_model=ReportExtractionResponse)
async def extract_report(
    file: Annotated[UploadFile, File(description="A text-based PDF health report")],
) -> ReportExtractionResponse:
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are supported.",
        )

    contents = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="The PDF must be 10 MB or smaller.",
        )

    if not contents.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file does not have a valid PDF signature.",
        )

    try:
        pages, warnings = extract_pages(contents)
    except PDFExtractionError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    return ReportExtractionResponse(
        filename=file.filename or "report.pdf",
        page_count=len(pages),
        pages=pages,
        warnings=warnings,
    )


@app.post("/api/reports/structure", response_model=StructuredReport)
async def structure_report(
    file: Annotated[UploadFile, File(description="A synthetic or de-identified PDF")],
    cloud_processing_allowed: Annotated[bool, Form()] = False,
) -> StructuredReport:
    if not cloud_processing_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm that this report is synthetic or de-identified before AI processing.",
        )

    extraction = await extract_report(file)
    try:
        return await extract_structured_report(extraction.filename, extraction.pages)
    except StructuredExtractionUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except StructuredExtractionFailed as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error


@app.post("/api/results/ask", response_model=ResultAnswer)
async def ask_about_result(request: ResultQuestionRequest) -> ResultAnswer:
    if request.result.review_status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only confirmed results can be discussed.",
        )
    try:
        return await answer_result_question(request)
    except ResultAssistantUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except ResultAssistantFailed as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error


@app.post("/api/reports/ask", response_model=ReportAnswer)
async def ask_about_report(request: ReportQuestionRequest) -> ReportAnswer:
    if any(result.review_status != "confirmed" for result in request.results):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only confirmed results can be discussed.",
        )
    try:
        return await answer_report_question(request)
    except ResultAssistantUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except ResultAssistantFailed as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error


@app.post("/api/translate", response_model=TranslationResponse)
async def translate_content(request: TranslationRequest) -> TranslationResponse:
    try:
        return await translate_education(request)
    except ResultAssistantUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ResultAssistantFailed as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
