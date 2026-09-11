export type ExtractedPage = {
  page_number: number;
  text: string;
};

export type ReportExtraction = {
  filename: string;
  page_count: number;
  pages: ExtractedPage[];
  warnings: string[];
};

export type ResultStatus = "low" | "normal" | "high" | "unknown";
export type ReviewStatus = "pending" | "confirmed" | "excluded";

export type LabResult = {
  category: string | null;
  name: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  reported_flag: "H" | "L" | "N" | null;
  calculated_status: ResultStatus;
  source_page: number;
  source_text: string;
  review_status: ReviewStatus;
};

export type StructuredReport = {
  filename: string;
  patient: {
    display_name: string | null;
    age_years: number | null;
    sex: string | null;
  };
  results: LabResult[];
  requires_review: boolean;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Language = "en" | "es" | "ar" | "te";

export type ReferenceLink = {
  title: string;
  url: string;
  source: string;
};

export type ResultAnswer = {
  answer: string;
  safety_note: string;
  suggested_questions: string[];
  references: ReferenceLink[];
};

export type ReportAnswer = {
  answer: string;
  safety_note: string;
  cited_result_names: string[];
  suggested_questions: string[];
  references: ReferenceLink[];
};