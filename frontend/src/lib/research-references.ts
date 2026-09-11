import type { LabResult, ReferenceLink } from "@/types/report";

export function researchReferences(result: LabResult): ReferenceLink[] {
  const name = result.name.toLowerCase();
  let query = `${result.name} laboratory test clinical interpretation`;
  if (name.includes("hemoglobin") || name.includes("haemoglobin") || name.includes("mcv")) query = "hemoglobin red blood cell indices clinical interpretation";
  else if (name.includes("wbc") || name.includes("white blood") || name.includes("neutrophil")) query = "white blood cell differential clinical interpretation";
  else if (name.includes("platelet") || name.includes("mpv")) query = "platelet count mean platelet volume interpretation";
  else if (name.includes("glucose")) query = "blood glucose testing clinical interpretation";
  else if (name.includes("bilirubin") || name.includes("ast") || name.includes("alt")) query = "liver enzymes bilirubin clinical interpretation";
  else if (name.includes("creatinine") || name.includes("urea") || name.includes("bun")) query = "creatinine blood urea nitrogen kidney function interpretation";
  else if (name.includes("tsh")) query = "thyroid stimulating hormone clinical interpretation";
  else if ((result.category ?? "").toLowerCase().includes("urine")) query = "urinalysis clinical interpretation";
  return [
    { title: `${result.name} research`, source: "PubMed", url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}` },
    { title: `${result.name} patient information`, source: "MedlinePlus", url: `https://medlineplus.gov/search/?query=${encodeURIComponent(result.name)}` },
  ];
}