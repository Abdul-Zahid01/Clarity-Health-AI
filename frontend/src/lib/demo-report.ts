import type { LabResult, StructuredReport } from "@/types/report";

export function createDemoReport(): StructuredReport {
  // These rows mirror scripts/generate_sample.py; they are authored fixtures, not AI output.
  const rows: Array<[string, number, string, number, number, string]> = [
    ["Hemoglobin", 11.2, "g/dL", 12, 16, "Hemoglobin\n11.2 g/dL\n12.0 - 16.0 g/dL"],
    ["White Blood Cells", 7.4, "x10^9/L", 4, 11, "White Blood Cells\n7.4 x10^9/L\n4.0 - 11.0 x10^9/L"],
    ["Platelets", 268, "x10^9/L", 150, 450, "Platelets\n268 x10^9/L\n150 - 450 x10^9/L"],
    ["Glucose", 105, "mg/dL", 70, 99, "Glucose\n105 mg/dL\n70 - 99 mg/dL"],
  ];
  return {
    filename: "synthetic-blood-report.pdf",
    patient: { display_name: null, age_years: null, sex: null },
    requires_review: true,
    results: rows.map(([name, value, unit, min, max, source]): LabResult => ({
      category: null,
      name,
      value_numeric: value,
      value_text: null,
      unit,
      reference_min: min,
      reference_max: max,
      reported_flag: null,
      calculated_status: value < min ? "low" : value > max ? "high" : "normal",
      source_page: 1,
      source_text: source,
      review_status: "pending",
    })),
  };
}
