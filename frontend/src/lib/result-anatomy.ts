import type { LabResult } from "@/types/report";

export type BodyRegion =
  | "blood"
  | "bone-marrow"
  | "immune"
  | "brain"
  | "muscles"
  | "liver"
  | "kidneys"
  | "thyroid"
  | "pancreas"
  | "urinary";

export type ResultAnatomy = {
  regions: BodyRegion[];
  label: string;
  explanation: string;
};

export function getResultAnatomy(result: LabResult): ResultAnatomy {
  const name = result.name.toLowerCase();
  const category = result.category?.toLowerCase() ?? "";

  if (category.includes("urine") || category.includes("clinical pathology")) {
    return { regions: ["kidneys", "urinary"], label: "Kidneys & urinary tract", explanation: "Urine is produced by the kidneys, carried through the urinary tract, and stored in the bladder." };
  }
  if (name.includes("tsh") || name.includes("thyroid")) {
    return { regions: ["brain", "thyroid"], label: "Pituitary–thyroid pathway", explanation: "The pituitary gland in the brain releases TSH, which signals the thyroid gland in the neck." };
  }
  if (name.includes("glucose")) {
    return { regions: ["pancreas", "liver", "brain", "muscles", "blood"], label: "Whole-body energy pathway", explanation: "Glucose travels in blood, is regulated by the pancreas and liver, and supplies energy to the brain and muscles." };
  }
  if (name.includes("bilirubin")) {
    return { regions: ["blood", "liver"], label: "Red-cell breakdown & liver", explanation: "Bilirubin forms as old red blood cells break down and is then processed by the liver." };
  }
  if (name.includes("sgot") || name.includes("sgpt") || /\bast\b/.test(name) || /\balt\b/.test(name)) {
    return { regions: name.includes("ast") || name.includes("sgot") ? ["liver", "muscles"] : ["liver"], label: "Liver and related tissues", explanation: "These enzymes are reviewed mainly with the liver; AST is also present in muscle and other tissues." };
  }
  if (name.includes("creatinine") || name.includes("urea") || /\bbun\b/.test(name)) {
    return { regions: name.includes("creatinine") ? ["muscles", "kidneys"] : ["liver", "kidneys"], label: "Waste production & kidney filtering", explanation: "Waste products enter the blood and are filtered by the kidneys; creatinine is linked with normal muscle activity." };
  }
  if (name.includes("platelet") || name.includes("mpv")) {
    return { regions: ["bone-marrow", "blood"], label: "Bone marrow & circulation", explanation: "Platelets are produced in bone marrow and circulate throughout blood vessels to help form clots." };
  }
  if (name.includes("white blood") || name.includes("wbc") || name.includes("tlc") || name.includes("neutrophil") || name.includes("lymphocyte") || name.includes("eosinophil") || name.includes("monocyte") || name.includes("basophil")) {
    return { regions: ["bone-marrow", "blood", "immune"], label: "Immune system & circulation", explanation: "White blood cells develop in marrow and immune tissues, then move through blood and tissues around the body." };
  }
  if (name.includes("hemoglobin") || name.includes("haemoglobin") || name.includes("rbc") || name.includes("hematocrit") || name.includes("haematocrit") || name.includes("pcv") || name.includes("mcv") || name.includes("mch") || name.includes("rdw")) {
    return { regions: ["bone-marrow", "blood"], label: "Red blood cells throughout the body", explanation: "Red blood cells form in bone marrow and circulate everywhere, carrying oxygen from the lungs to body tissues." };
  }
  return { regions: ["blood"], label: "Circulating laboratory marker", explanation: "This marker was measured in a laboratory sample and may relate to several body systems depending on the clinical context." };
}