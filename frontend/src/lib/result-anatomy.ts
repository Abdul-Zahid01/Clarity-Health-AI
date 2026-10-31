import type { LabResult } from "@/types/report";

export type BodyRegion =
  | "blood"
  | "heart"
  | "bones"
  | "nerves"
  | "bone-marrow"
  | "immune"
  | "brain"
  | "pituitary"
  | "muscles"
  | "liver"
  | "stomach"
  | "kidneys"
  | "thyroid"
  | "pancreas"
  | "urinary";

export type ResultAnatomy = {
  regions: BodyRegion[];
  label: string;
  explanation: string;
};

export const bodyRegions: Record<BodyRegion, { label: string; color: string }> = {
  blood: { label: "Circulation", color: "#b53c40" },
  heart: { label: "Heart", color: "#aa303c" },
  bones: { label: "Bones", color: "#d9c8a4" },
  nerves: { label: "Nerves", color: "#d7a329" },
  "bone-marrow": { label: "Bone marrow", color: "#b95e61" },
  immune: { label: "Immune tissues", color: "#7b72b1" },
  brain: { label: "Brain", color: "#ce969e" },
  pituitary: { label: "Pituitary gland", color: "#b26391" },
  muscles: { label: "Muscles", color: "#ab514b" },
  liver: { label: "Liver", color: "#854039" },
  stomach: { label: "Stomach", color: "#d39291" },
  kidneys: { label: "Kidneys", color: "#a74b49" },
  thyroid: { label: "Thyroid", color: "#bd7062" },
  pancreas: { label: "Pancreas", color: "#d8ae6d" },
  urinary: { label: "Urinary tract", color: "#c39a62" },
};

export function isUrineResult(name: string, category?: string | null): boolean {
  const urineNames = ["colour", "color", "appearance", "specific gravity", "urobilinogen", "nitrite", "pus cells", "epithelial", "casts", "crystals", "bacteria"];
  return /\b(?:urine|urinary|urinalysis)\b/i.test(`${name} ${category ?? ""}`) || urineNames.includes(name.toLowerCase());
}

export function normalizeMarkerName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[‐‑–—]/g, "-").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function getResultAnatomy(result: LabResult): ResultAnatomy {
  const name = normalizeMarkerName(result.name);

  if (isUrineResult(name, result.category)) {
    return { regions: ["kidneys", "urinary"], label: "Kidneys & urinary tract", explanation: "Urine is produced by the kidneys, carried through the urinary tract, and stored in the bladder." };
  }
  if (/troponin|\b(?:nt pro ?bnp|bnp|ck mb)\b/.test(name)) {
    return { regions: ["heart"], label: "Heart-related marker", explanation: "This marker is used when assessing heart muscle or cardiac workload. A result alone does not establish a heart problem." };
  }
  if (/cholesterol|triglyceride|\b(?:hdl|ldl|apob)\b/.test(name)) {
    return { regions: ["blood", "heart", "liver"], label: "Blood fats & cardiovascular context", explanation: "Lipids are transported in blood and processed by the liver. They inform cardiovascular assessment, but do not show where disease is present." };
  }
  if (/vitamin\s*b[- ]?12|\bb12\b/.test(name)) {
    return { regions: ["blood", "bone-marrow", "nerves"], label: "Blood-cell production & nerve function", explanation: "Vitamin B12 supports red blood cell formation and nerve function. Its blood level alone does not show nerve injury." };
  }
  if (/calcium|vitamin\s*d\b|\b25[- ]?(?:oh|hydroxy)/.test(name)) {
    return { regions: ["bones", "muscles", "blood"], label: "Bone mineral & muscle physiology", explanation: "Calcium and vitamin D relate to mineral balance and bone and muscle function. Blood measurements do not directly measure bone strength." };
  }
  if (/\btsh\b|thyroid stimulating|thyrotropin/.test(name)) {
    return { regions: ["thyroid", "pituitary"], label: "Pituitary–thyroid pathway", explanation: "The pituitary gland at the base of the brain releases TSH, which signals the thyroid gland in the front of the neck. TSH measures that signal, not the size or appearance of the thyroid." };
  }
  if (/\b(?:ft3|ft4|t3|t4)\b|free t[34]|thyroxine|triiodothyronine|thyroid/.test(name)) {
    return { regions: ["thyroid"], label: "Thyroid hormones", explanation: "The thyroid in the front of the neck produces T4 and T3. Thyroid results describe hormone regulation, not visible damage to the gland." };
  }
  if (name.includes("glucose") || /hba1c|glycated|glycosylated|\b(?:fbs|rbs|ppbs)\b|blood sugar/.test(name)) {
    return { regions: ["pancreas", "liver", "brain", "muscles", "blood"], label: "Whole-body energy pathway", explanation: "Glucose travels in blood, is regulated by the pancreas and liver, and supplies energy to the brain and muscles." };
  }
  if (name.includes("bilirubin")) {
    return { regions: ["blood", "liver"], label: "Red-cell breakdown & liver", explanation: "Bilirubin forms as old red blood cells break down and is then processed by the liver." };
  }
  if (name.includes("amylase") || name.includes("lipase") || name.includes("gastrin")) {
    return { regions: ["stomach", "pancreas"], label: "Stomach & pancreas", explanation: "Digestive enzymes and hormones are produced across the stomach and pancreas and help process food." };
  }
  if (name.includes("sgot") || name.includes("sgpt") || /\b(?:ast|alt|ggt|alp)\b|alkaline phosphatase|albumin|total protein/.test(name)) {
    return { regions: /\bast\b|sgot/.test(name) ? ["liver", "muscles"] : /\balp\b|alkaline phosphatase/.test(name) ? ["liver", "bones"] : ["liver"], label: "Liver and related tissues", explanation: "These markers are reviewed with liver-related patterns. AST is also present in muscle; alkaline phosphatase also relates to bone. A marker is not specific evidence of organ damage." };
  }
  if (/\begfr\b/.test(name)) return { regions: ["kidneys"], label: "Estimated kidney filtration", explanation: "eGFR is a calculated estimate of how the kidneys filter blood, not a directly measured anatomical image." };
  if (/uric acid|urate|sodium|potassium|chloride|bicarbonate|electrolyte/.test(name)) return { regions: ["kidneys", "blood"], label: "Blood chemistry & kidney handling", explanation: "The kidneys help regulate blood chemistry and remove dissolved waste. These markers also depend on intake, metabolism, medicines, and other factors." };
  if (name.includes("creatinine") || name.includes("urea") || /\bbun\b/.test(name) || /\begfr\b/.test(name)) {
    return { regions: name.includes("creatinine") ? ["muscles", "kidneys"] : ["liver", "kidneys"], label: "Waste production & kidney filtering", explanation: "Waste products enter the blood and are filtered by the kidneys; creatinine is linked with normal muscle activity." };
  }
  if (name.includes("platelet") || /\b(?:mpv|plt)\b/.test(name)) {
    return { regions: ["bone-marrow", "blood"], label: "Bone marrow & circulation", explanation: "Platelets are produced in bone marrow and circulate throughout blood vessels to help form clots." };
  }
  if (name.includes("white blood") || /leu[ck]ocyte/.test(name) || /\b(?:wbc|tlc|neut|lymph|eos|mono|baso|anc|alc)\b/.test(name) || name.includes("neutrophil") || name.includes("lymphocyte") || name.includes("eosinophil") || name.includes("monocyte") || name.includes("basophil")) {
    return { regions: ["bone-marrow", "blood", "immune"], label: "Immune system & circulation", explanation: "White blood cells develop in marrow and immune tissues, then move through blood and tissues around the body." };
  }
  if (name.includes("hemoglobin") || name.includes("haemoglobin") || /\b(?:hb|hgb|rbc|hct|rcc)\b/.test(name) || name.includes("hematocrit") || name.includes("haematocrit") || name.includes("pcv") || name.includes("mcv") || name.includes("mch") || name.includes("rdw") || /\biron\b|ferritin|transferrin/.test(name)) {
    return { regions: ["bone-marrow", "blood"], label: "Red blood cells throughout the body", explanation: "Red blood cells form in bone marrow and circulate everywhere, carrying oxygen from the lungs to body tissues." };
  }
  return { regions: [], label: "No specific body-system mapping", explanation: "This test is not yet mapped to a specific system. Its sample type and clinical context are needed; no organ involvement is inferred." };
}