import type { LabResult } from "@/types/report";

function resultScore(result: LabResult): number | null {
  if (result.value_numeric === null || result.reference_min === null || result.reference_max === null || result.reference_max <= result.reference_min) return null;
  const span = result.reference_max - result.reference_min;
  if (result.value_numeric >= result.reference_min && result.value_numeric <= result.reference_max) {
    const midpoint = (result.reference_min + result.reference_max) / 2;
    const distance = Math.abs(result.value_numeric - midpoint) / (span / 2);
    return Math.round(100 - Math.min(10, distance * 10));
  }
  const outsideDistance = result.value_numeric < result.reference_min ? result.reference_min - result.value_numeric : result.value_numeric - result.reference_max;
  return Math.max(30, Math.round(90 - (outsideDistance / span) * 60));
}

export function calculateHealthRating(results: LabResult[]): number {
  const scores = results.map(resultScore).filter((score): score is number => score !== null);
  return scores.length === 0 ? 100 : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}