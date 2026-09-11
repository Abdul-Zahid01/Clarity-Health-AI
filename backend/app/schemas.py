from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ExtractedPage(BaseModel):
    page_number: int
    text: str


class ReportExtractionResponse(BaseModel):
    filename: str
    page_count: int
    pages: list[ExtractedPage]
    warnings: list[str]


ResultStatus = Literal["low", "normal", "high", "unknown"]
ReviewStatus = Literal["pending", "confirmed", "excluded"]
Language = Literal["en", "es", "ar", "te"]


class LabResult(BaseModel):
    category: str | None = None
    name: str
    value_numeric: float | None = None
    value_text: str | None = None
    unit: str | None = None
    reference_min: float | None = None
    reference_max: float | None = None
    reported_flag: Literal["H", "L", "N"] | None = None
    calculated_status: ResultStatus = "unknown"
    source_page: int = Field(ge=1)
    source_text: str
    review_status: ReviewStatus = "pending"

    @model_validator(mode="after")
    def require_a_value(self) -> "LabResult":
        if self.value_numeric is None and not self.value_text:
            raise ValueError("A numeric or textual result value is required.")
        return self


class PatientMetadata(BaseModel):
    display_name: str | None = None
    age_years: int | None = Field(default=None, ge=0)
    sex: str | None = None


class StructuredReport(BaseModel):
    filename: str
    patient: PatientMetadata = Field(default_factory=PatientMetadata)
    results: list[LabResult]
    requires_review: bool = True


class LabResultDraft(BaseModel):
    category: str | None
    name: str
    value_numeric: float | None
    value_text: str | None
    unit: str | None
    reference_min: float | None
    reference_max: float | None
    reported_flag: Literal["H", "L", "N"] | None
    source_page: int
    source_text: str


class PatientMetadataDraft(BaseModel):
    age_years: int | None
    sex: str | None


class StructuredReportDraft(BaseModel):
    patient: PatientMetadataDraft
    results: list[LabResultDraft]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ResultQuestionRequest(BaseModel):
    result: LabResult
    question: str = Field(min_length=2, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)
    language: Language = "en"


class ReferenceLink(BaseModel):
    title: str
    url: str
    source: str


class ResultAnswer(BaseModel):
    answer: str
    safety_note: str
    suggested_questions: list[str] = Field(max_length=3)
    references: list[ReferenceLink] = Field(default_factory=list, max_length=4)


class ReportQuestionRequest(BaseModel):
    results: list[LabResult] = Field(min_length=1, max_length=100)
    question: str = Field(min_length=2, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)
    language: Language = "en"


class ReportAnswer(BaseModel):
    answer: str
    safety_note: str
    cited_result_names: list[str] = Field(max_length=12)
    suggested_questions: list[str] = Field(max_length=3)
    references: list[ReferenceLink] = Field(default_factory=list, max_length=6)


class TranslationRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=8)
    language: Language


class TranslationResponse(BaseModel):
    texts: list[str]
