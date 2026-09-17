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


class KnowledgeChunk(BaseModel):
    """A traceable piece of evidence extracted from the curated knowledge base."""

    chunk_id: str = Field(min_length=1, max_length=120)
    source_filename: str = Field(min_length=1, max_length=255)
    source_page: int = Field(ge=1)
    chunk_number: int = Field(ge=1)
    text: str = Field(min_length=1, max_length=5000)
    document_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    text_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class KnowledgeDocumentIssue(BaseModel):
    """A source that was not fully indexed, surfaced instead of silently ignored."""

    source_filename: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=1, max_length=500)
    needs_ocr: bool = False


class KnowledgeBaseArtifact(BaseModel):
    """Validated, deterministic output of knowledge-base ingestion."""

    schema_version: Literal["1.0"] = "1.0"
    source_document_count: int = Field(ge=0)
    document_count: int = Field(ge=0)
    chunk_count: int = Field(ge=0)
    chunks: list[KnowledgeChunk]
    issues: list[KnowledgeDocumentIssue] = Field(default_factory=list)

    @model_validator(mode="after")
    def counts_must_match_contents(self) -> "KnowledgeBaseArtifact":
        if self.chunk_count != len(self.chunks):
            raise ValueError("chunk_count must match the number of chunks.")
        filenames = {chunk.source_filename for chunk in self.chunks}
        if self.document_count != len(filenames):
            raise ValueError("document_count must match the number of source documents.")
        attempted_filenames = filenames | {issue.source_filename for issue in self.issues}
        if self.source_document_count != len(attempted_filenames):
            raise ValueError(
                "source_document_count must match all indexed and reported source documents."
            )
        return self


class RagQuestionRequest(BaseModel):
    results: list[LabResult] = Field(min_length=1, max_length=100)
    question: str = Field(min_length=2, max_length=1000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)
    language: Language = "en"


class GroundingCitation(BaseModel):
    source_id: str = Field(min_length=1, max_length=120)
    evidence_quote: str = Field(min_length=3, max_length=600)


class GroundedClaim(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    citations: list[GroundingCitation] = Field(min_length=1, max_length=4)


class RagModelResponse(BaseModel):
    """Private model output; the API answer is assembled only after verification."""

    answerable: bool
    claims: list[GroundedClaim] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def answerable_requires_grounded_claims(self) -> "RagModelResponse":
        if self.answerable and not self.claims:
            raise ValueError("An answerable response must contain at least one grounded claim.")
        if not self.answerable and self.claims:
            raise ValueError("A refusal cannot contain claims.")
        return self


class RagSource(BaseModel):
    source_id: str
    source_type: Literal["report", "knowledge_base"]
    title: str
    page: int = Field(ge=1)
    excerpt: str


class RagAnswer(BaseModel):
    answerable: bool
    answer: str
    claims: list[GroundedClaim] = Field(default_factory=list)
    sources: list[RagSource] = Field(default_factory=list, max_length=20)
    safety_note: str
    suggested_questions: list[str] = Field(default_factory=list, max_length=3)
