import type { ChatMessage, LabResult, Language, ReportAnswer, ReportExtraction, ResultAnswer, StructuredReport } from "@/types/report";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function extractReport(file: File): Promise<ReportExtraction> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/reports/extract`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(error?.detail ?? "The report could not be processed.");
  }

  return response.json() as Promise<ReportExtraction>;
}

export async function structureReport(file: File): Promise<StructuredReport> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("cloud_processing_allowed", "true");

  const response = await fetch(`${API_URL}/api/reports/structure`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(error?.detail ?? "Structured extraction could not be completed.");
  }

  return response.json() as Promise<StructuredReport>;
}

export async function askAboutResult(result: LabResult, question: string, history: ChatMessage[], language: Language): Promise<ResultAnswer> {
  const response = await fetch(`${API_URL}/api/results/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ result, question, history: history.slice(-8), language }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(error?.detail ?? "The assistant could not answer right now.");
  }

  return response.json() as Promise<ResultAnswer>;
}

export async function askAboutReport(results: LabResult[], question: string, history: ChatMessage[], language: Language): Promise<ReportAnswer> {
  const response = await fetch(`${API_URL}/api/reports/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results, question, history: history.slice(-8), language }),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(error?.detail ?? "The report assistant could not answer right now.");
  }

  return response.json() as Promise<ReportAnswer>;
}

export async function translateTexts(texts: string[], language: Language): Promise<string[]> {
  if (language === "en") return texts;
  const response = await fetch(`${API_URL}/api/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, language }),
  });
  if (!response.ok) throw new Error("Translation is temporarily unavailable.");
  const payload = await response.json() as { texts: string[] };
  return payload.texts;
}