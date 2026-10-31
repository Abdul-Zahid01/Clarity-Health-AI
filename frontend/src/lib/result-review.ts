import type { LabResult, ResultStatus } from "@/types/report";

export function resultValidationError(result: LabResult): string | null {
  if (result.value_numeric === null && !result.value_text?.trim()) return "Enter a result value or exclude this test.";
  if ([result.value_numeric, result.reference_min, result.reference_max].some((value) => value !== null && !Number.isFinite(value))) {
    return "Values and reference boundaries must be finite numbers.";
  }
  if (result.reference_min !== null && result.reference_max !== null && result.reference_max < result.reference_min) {
    return "The reference maximum must not be smaller than the minimum.";
  }
  return null;
}

export function calculateResultStatus(result: LabResult): ResultStatus {
  if (resultValidationError(result) || result.value_numeric === null || result.reference_min === null || result.reference_max === null) return "unknown";
  if (result.value_numeric < result.reference_min) return "low";
  if (result.value_numeric > result.reference_max) return "high";
  return "normal";
}

export function confirmedResults(results: LabResult[]): LabResult[] {
  return results.filter((result) => result.review_status === "confirmed");
}
