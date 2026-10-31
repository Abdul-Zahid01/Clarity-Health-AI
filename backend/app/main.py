from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import TypeAdapter, ValidationError

from app.pdf_parser import PDFExtractionError, extract_pages
from app.report_privacy import is_deletion_only, redact_report_pages
from app.rag_assistant import (
    RagAssistantFailed,
    RagAssistantUnavailable,
    answer_rag_question,
)
from app.result_assistant import (
    ResultAssistantFailed,
    ResultAssistantUnavailable,
    answer_report_question,
    answer_result_question,
    translate_education,
)
from app.schemas import (
    ExtractedPage,
    ReportAnswer,
    ReportExtractionResponse,
    ReportQuestionRequest,
    RagAnswer,
    RagQuestionRequest,
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

    cloud_pages, removed_lines = redact_report_pages(pages)
    return ReportExtractionResponse(
        filename=file.filename or "report.pdf",
        page_count=len(pages),
        pages=pages,
        warnings=warnings,
        cloud_pages=cloud_pages,
        privacy_removed_lines=removed_lines,
    )


@app.post("/api/reports/structure", response_model=StructuredReport)
async def structure_report(
    file: Annotated[UploadFile, File(description="A synthetic or de-identified PDF")],
    cloud_processing_allowed: Annotated[bool, Form()] = False,
    privacy_review_confirmed: Annotated[bool, Form()] = False,
    reviewed_pages: Annotated[str | None, Form()] = None,
) -> StructuredReport:
    if not cloud_processing_allowed:
        await file.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm that this report is synthetic or de-identified before AI processing.",
        )

    if not privacy_review_confirmed or reviewed_pages is None:
        await file.close()
        raise HTTPException(
            status_code=400,
            detail="Review the cloud text preview and confirm identifiers have been removed before AI processing.",
        )
    try:
        selected_pages = TypeAdapter(list[ExtractedPage]).validate_json(reviewed_pages)
    except ValidationError as error:
        await file.close()
        raise HTTPException(status_code=400, detail="The cloud text preview is invalid.") from error

    extraction = await extract_report(file)
    originals = {page.page_number: page for page in extraction.cloud_pages}
    if (
        len(selected_pages) != len(originals)
        or {page.page_number for page in selected_pages} != set(originals)
        or any(not is_deletion_only(originals[page.page_number].text, page.text) for page in selected_pages)
        or not any(page.text.strip() for page in selected_pages)
    ):
        raise HTTPException(
            status_code=400,
            detail="Only remove text from the cloud preview; keep page numbers and laboratory values unchanged.",
        )
    try:
        return await extract_structured_report(extraction.filename, selected_pages)
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


@app.post("/api/rag/ask", response_model=RagAnswer)
async def ask_rag_assistant(request: RagQuestionRequest) -> RagAnswer:
    if any(result.review_status != "confirmed" for result in request.results):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only confirmed results can be discussed.",
        )
    try:
        return await answer_rag_question(request)
    except RagAssistantUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error
    except RagAssistantFailed as error:
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
