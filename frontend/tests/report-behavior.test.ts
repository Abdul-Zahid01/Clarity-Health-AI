import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDemoReport } from "../src/lib/demo-report";
import { calculateHealthRating } from "../src/lib/health-rating";
import { calculateResultStatus, confirmedResults, resultValidationError } from "../src/lib/result-review";
import { getResultEducation } from "../src/lib/result-education";
import { getResultAnatomy } from "../src/lib/result-anatomy";
import { getResultLesson } from "../src/lib/result-lesson";
import { speechChunks, speechErrorMessage, speechLanguages } from "../src/lib/voice";
import type { LabResult } from "../src/types/report";

function glucose(changes: Partial<LabResult> = {}): LabResult {
  return { ...createDemoReport().results[3], review_status: "confirmed", ...changes };
}

describe("educational range summary", () => {
  it("does not invent a perfect rating when no usable ranges exist", () => {
    assert.equal(calculateHealthRating([]), null);
    assert.equal(calculateHealthRating([glucose({ reference_min: null, reference_max: null })]), null);
    assert.equal(calculateHealthRating([glucose({ reference_min: 99, reference_max: 70 })]), null);
    assert.equal(calculateHealthRating([glucose({ value_numeric: Infinity })]), null);
  });
  it("uses only confirmed numeric results", () => {
    const report = [glucose({ value_numeric: 84.5 }), glucose({ review_status: "excluded", value_numeric: 200 })];
    assert.equal(calculateHealthRating(report), 100);
    assert.equal(calculateHealthRating([glucose({ review_status: "pending" })]), null);
    assert.equal(calculateHealthRating([glucose({ value_numeric: null, value_text: "Not detected" })]), null);
  });
  it("preserves the existing numeric scoring behavior", () => {
    assert.equal(calculateHealthRating([glucose({ value_numeric: 70 })]), 90);
    assert.equal(calculateHealthRating([glucose({ value_numeric: 105 })]), 78);
  });
});

describe("human review", () => {
  it("requires a real numeric or qualitative value before confirmation", () => {
    assert.match(resultValidationError(glucose({ value_numeric: null, value_text: "  " }))!, /Enter a result/);
    assert.equal(resultValidationError(glucose({ value_numeric: 0 })), null);
    assert.equal(resultValidationError(glucose({ value_numeric: null, value_text: "Not detected" })), null);
  });
  it("rejects non-finite numbers and reversed intervals", () => {
    assert.match(resultValidationError(glucose({ reference_min: NaN }))!, /finite/);
    assert.match(resultValidationError(glucose({ reference_min: 110, reference_max: 99 }))!, /maximum/);
    assert.equal(calculateResultStatus(glucose({ reference_min: 110, reference_max: 99 })), "unknown");
  });
  it("keeps missing fields unknown and treats interval endpoints inclusively", () => {
    assert.equal(calculateResultStatus(glucose({ reference_min: null })), "unknown");
    assert.equal(calculateResultStatus(glucose({ value_numeric: 70 })), "normal");
    assert.equal(calculateResultStatus(glucose({ value_numeric: 99 })), "normal");
    assert.equal(calculateResultStatus(glucose({ value_numeric: 69 })), "low");
    assert.equal(calculateResultStatus(glucose()), "high");
  });
  it("filters assistant/dashboard inputs without discarding review rows", () => {
    const rows = [glucose(), glucose({ review_status: "excluded" }), glucose({ review_status: "pending" })];
    assert.equal(confirmedResults(rows).length, 1);
    assert.equal(rows.length, 3);
    assert.equal(rows[1].review_status, "excluded");
  });
});

describe("educational content routing", () => {
  it("does not confuse common blood markers with urine tests", () => {
    assert.equal(getResultEducation("Glucose").image, "/medical/glucose.png");
    assert.equal(getResultEducation("Glucose", "Biochemistry").image, "/medical/glucose.png");
    assert.equal(getResultEducation("RBC", "Hematology").image, "/medical/hemoglobin.png");
    assert.notEqual(getResultEducation("Bilirubin", "Biochemistry").image, "/medical/urinalysis.png");
  });
  it("keeps explicit urinalysis tests on the urine education path", () => {
    assert.equal(getResultEducation("Glucose", "Urine").image, "/medical/urinalysis.png");
    assert.equal(getResultEducation("Urine glucose").image, "/medical/urinalysis.png");
    assert.equal(getResultEducation("Specific gravity").image, "/medical/urinalysis.png");
  });
  it("maps educational systems deterministically without inferring disease", () => {
    assert.deepEqual(getResultAnatomy(glucose()).regions, ["pancreas", "liver", "brain", "muscles", "blood"]);
    assert.deepEqual(getResultAnatomy(glucose({ name: "Creatinine" })).regions, ["muscles", "kidneys"]);
  });
  it("maps hemoglobin to circulation and marrow, not nerves or the heart", () => {
    for (const name of ["Hemoglobin", "Haemoglobin", "Hb", "Hgb"]) {
      assert.deepEqual(getResultAnatomy(glucose({ name })).regions, ["bone-marrow", "blood"]);
    }
  });
  it("uses explicit cardiac markers without treating nonspecific enzymes as heart disease", () => {
    for (const name of ["Troponin I", "NT-proBNP", "BNP", "CK-MB"]) {
      assert.deepEqual(getResultAnatomy(glucose({ name })).regions, ["heart"]);
      assert.match(getResultEducation(name).overview, /Heart-related/);
    }
    assert.deepEqual(getResultAnatomy(glucose({ name: "AST" })).regions, ["liver", "muscles"]);
    assert.deepEqual(getResultAnatomy(glucose({ name: "Total cholesterol" })).regions, ["blood", "heart", "liver"]);
  });
  it("shows nerve and bone relationships only for mapped markers", () => {
    assert.ok(getResultAnatomy(glucose({ name: "Vitamin B12" })).regions.includes("nerves"));
    assert.ok(getResultAnatomy(glucose({ name: "Vitamin D" })).regions.includes("bones"));
    assert.ok(getResultAnatomy(glucose({ name: "Calcium" })).regions.includes("bones"));
    assert.deepEqual(getResultAnatomy(glucose({ name: "Unmapped test" })).regions, []);
  });
  it("keeps urine and blood anatomy aligned with educational content", () => {
    for (const result of [glucose({ name: "Urine glucose" }), glucose({ category: "Urinalysis" }), glucose({ name: "Specific gravity" })]) {
      assert.deepEqual(getResultAnatomy(result).regions, ["kidneys", "urinary"]);
      assert.equal(getResultEducation(result.name, result.category).image, "/medical/urinalysis.png");
    }
    assert.deepEqual(getResultAnatomy(glucose({ name: "HbA1c" })).regions, getResultAnatomy(glucose()).regions);
    assert.match(getResultEducation("Glycated hemoglobin (HbA1c)").overview, /glucose attached/);
    assert.deepEqual(getResultAnatomy(glucose({ name: "Unmapped test", category: "Clinical Pathology" })).regions, []);
  });
  it("recognizes the exact reported TSH label and thyroid aliases", () => {
    for (const name of ["TSH(THYROID STIMULATING HORMONE)", "TSH (Ultra-sensitive)", "Thyrotropin", "Thyroid-stimulating hormone"]) {
      assert.deepEqual(getResultAnatomy(glucose({ name })).regions, ["thyroid", "pituitary"]);
      assert.match(getResultEducation(name).overview, /pituitary/);
      assert.equal(getResultLesson(glucose({ name })).kind, "thyroid");
    }
    for (const name of ["FT4", "Free T4", "T3", "Thyroxine"]) {
      assert.deepEqual(getResultAnatomy(glucose({ name })).regions, ["thyroid"]);
    }
  });
  it("recognizes common count, chemistry, and punctuation aliases", () => {
    const cases: Array<[string, string]> = [["PLT", "bone-marrow"], ["HCT", "blood"], ["Total Leucocyte Count", "immune"], ["Neut %", "immune"], ["FBS", "pancreas"], ["eGFR", "kidneys"], ["Alkaline phosphatase", "bones"], ["NT–proBNP", "heart"]];
    for (const [name, region] of cases) assert.ok(getResultAnatomy(glucose({ name })).regions.some((item) => item === region), name);
    assert.deepEqual(getResultAnatomy(glucose({ name: "eGFR" })).regions, ["kidneys"]);
  });
  it("chooses distinct explanatory scenes, not one repeated human silhouette", () => {
    const cases = { Hemoglobin: "red-cells", WBC: "immune", Platelets: "platelets", Creatinine: "kidney", Glucose: "glucose", ALT: "liver", TSH: "thyroid", Troponin: "heart", LDL: "lipids", Calcium: "bone", "Vitamin B12": "nerves", "Unmapped test": "sample", HbA1c: "red-cells" };
    for (const [name, kind] of Object.entries(cases)) {
      const lesson = getResultLesson(glucose({ name }));
      assert.equal(lesson.kind, kind);
      assert.equal(lesson.steps.length, 3);
      assert.equal(lesson.captions.length, 3);
    }
  });
});

describe("voice safeguards", () => {
  it("uses explicit language tags and helpful permission/network fallbacks", () => {
    assert.equal(speechLanguages.te, "te-IN");
    assert.match(speechErrorMessage("not-allowed"), /permission was denied/);
    assert.match(speechErrorMessage("network"), /could not connect/);
    assert.match(speechErrorMessage("unknown"), /use text/);
  });
  it("chunks long spoken answers without dropping words", () => {
    const text = "An educational answer with context. ".repeat(80).trim();
    const chunks = speechChunks(text);
    assert.ok(chunks.every((chunk) => chunk.length <= 220));
    assert.equal(chunks.join(" "), text);
    assert.deepEqual(speechChunks("  "), []);
    assert.equal(speechChunks("x".repeat(900)).join(""), "x".repeat(900));
  });
});
describe("local demo", () => {
  it("starts with four pending synthetic results and no inferred metadata", () => {
    const report = createDemoReport();
    assert.equal(report.results.length, 4);
    assert.ok(report.results.every((result) => result.review_status === "pending" && result.source_page === 1 && result.source_text.length > 0));
    assert.deepEqual(report.patient, { display_name: null, age_years: null, sex: null });
    assert.equal(report.requires_review, true);
  });
  it("does not retain changes between separate demo sessions", () => {
    const first = createDemoReport();
    first.results[0].review_status = "excluded";
    assert.equal(createDemoReport().results[0].review_status, "pending");
  });
});
