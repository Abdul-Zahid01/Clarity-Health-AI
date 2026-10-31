import { getResultAnatomy, normalizeMarkerName } from "./result-anatomy";
import type { LabResult } from "../types/report";

export type LessonKind = "thyroid" | "red-cells" | "immune" | "platelets" | "kidney" | "glucose" | "liver" | "heart" | "lipids" | "bone" | "nerves" | "sample";
export type ResultLesson = {
  kind: LessonKind;
  title: string;
  steps: [string, string, string];
  captions: [string, string, string];
};

const lessons: Record<LessonKind, Omit<ResultLesson, "kind">> = {
  thyroid: {
    title: "A hormone signal, not a picture of the gland",
    steps: ["Pituitary signal", "Thyroid response", "Blood measurement"],
    captions: ["The pituitary at the base of the brain releases TSH into blood.", "TSH signals the butterfly-shaped thyroid in the neck to make T4 and T3.", "The lab measures the named hormone. TSH is the signal; T4 and T3 are thyroid hormones. Interpret them together."],
  },
  "red-cells": {
    title: "Inside a red blood cell",
    steps: ["Cells are made", "Oxygen is carried", "A feature is measured"],
    captions: ["Bone marrow produces red blood cells, using nutrients including iron, folate, and vitamin B12.", "Hemoglobin inside those cells binds oxygen in the lungs and transports it to tissues.", "Hemoglobin, cell count, cell size, iron stores, and HbA1c are different measurements. Read the definition of this specific test below."],
  },
  immune: {
    title: "Meet the cells of immune defense",
    steps: ["Marrow production", "Circulating cells", "Count and balance"],
    captions: ["Many immune cells originate in bone marrow before maturing in marrow or other immune tissues.", "Different white-cell types move between blood and tissues and have different roles.", "A count or percentage describes sampled cells, not the location or cause of an illness. Percentages and absolute counts differ."],
  },
  platelets: {
    title: "Small fragments with a clotting role",
    steps: ["Marrow production", "Platelet circulation", "Count or size"],
    captions: ["Large marrow cells release small cell fragments called platelets.", "Platelets circulate and help form a plug at a damaged vessel. This diagram illustrates normal function, not an injury in your body.", "Platelet count measures number; MPV describes average size. Neither alone identifies why a result changed."],
  },
  kidney: {
    title: "Follow blood through a kidney filter",
    steps: ["Blood arrives", "Filtering and return", "Waste leaves"],
    captions: ["Blood carries dissolved substances to tiny kidney filters called glomeruli.", "Water and small substances enter the tubules. The kidneys return much of what the body needs to blood.", "Waste and excess water leave as urine. Blood creatinine, BUN, estimated GFR, and urine tests describe different parts of this process."],
  },
  glucose: {
    title: "From circulating sugar to cell energy",
    steps: ["Glucose in blood", "Hormone signaling", "Cell uptake"],
    captions: ["Glucose circulates in blood. The liver helps store and release it.", "Insulin from the pancreas helps many cells take up glucose; other hormones also participate.", "Cells use glucose for energy. A glucose test samples one time point; HbA1c reflects a longer-term pattern and has additional limitations."],
  },
  liver: {
    title: "A processing organ with several lab markers",
    steps: ["Blood reaches liver", "Processing in cells", "Different lab signals"],
    captions: ["Blood brings nutrients and other substances to the liver.", "Liver cells process substances, make proteins, and help prepare some waste for removal.", "Enzymes, proteins, and bilirubin describe different processes. Some markers also come from other tissues; no single result shows where damage is present."],
  },
  heart: {
    title: "A pump and the signals measured in blood",
    steps: ["Heart muscle", "Blood circulation", "Marker measurement"],
    captions: ["Heart muscle contracts to move blood through the lungs and body.", "Oxygen and other substances travel through circulation. This motion is illustrative, not your measured heartbeat.", "Troponin and BNP-related tests answer different questions about heart muscle or workload. The named test, timing, and clinical context matter."],
  },
  lipids: {
    title: "How fats travel through blood",
    steps: ["Liver processing", "Transport particles", "Lipid measurement"],
    captions: ["The liver helps produce, package, and clear fats.", "Lipoprotein particles carry cholesterol and triglycerides through blood.", "LDL, HDL, cholesterol, and triglycerides measure different aspects of transport. They do not identify a blocked vessel or locate disease."],
  },
  bone: {
    title: "Mineral balance is a moving process",
    steps: ["Mineral supply", "Bone exchange", "Blood measurement"],
    captions: ["Calcium supply and vitamin D participate in mineral balance.", "Bone is living tissue that stores and exchanges minerals.", "A blood value is not a direct measurement of bone strength. Muscle function, kidney handling, and hormones also matter."],
  },
  nerves: {
    title: "Vitamin support for blood and nerves",
    steps: ["Vitamin availability", "Nerve support", "Blood measurement"],
    captions: ["Vitamin B12 is absorbed from food or supplements through a multistep digestive process.", "B12 supports nerve function as well as blood-cell production.", "A B12 blood result does not show whether nerves are injured. Symptoms and related measurements provide additional context."],
  },
  sample: {
    title: "What this laboratory result can tell you",
    steps: ["A sample is taken", "A test is measured", "Context is reviewed"],
    captions: ["Blood, urine, and other samples answer different questions. Check the sample and named test.", "The lab reports a numeric or qualitative result using its own method and reference information.", "This marker has no dedicated animation yet. No organ association is inferred. Read the source evidence and discuss questions with a clinician."],
  },
};

export function getResultLesson(result: LabResult): ResultLesson {
  const name = normalizeMarkerName(result.name);
  const { regions } = getResultAnatomy(result);
  let kind: LessonKind = "sample";
  if (regions.includes("thyroid")) kind = "thyroid";
  else if (regions.includes("urinary") || regions.includes("kidneys")) kind = "kidney";
  else if (/hba1c|glycated|glycosylated/.test(name)) kind = "red-cells";
  else if (/glucose|\b(?:fbs|rbs|ppbs)\b|blood sugar/.test(name)) kind = "glucose";
  else if (regions.includes("nerves")) kind = "nerves";
  else if (regions.includes("bones") && !regions.includes("liver")) kind = "bone";
  else if (regions.includes("heart")) kind = regions.includes("liver") ? "lipids" : "heart";
  else if (regions.includes("immune")) kind = "immune";
  else if (/platelet|\b(?:mpv|plt)\b/.test(name)) kind = "platelets";
  else if (regions.includes("liver")) kind = "liver";
  else if (regions.includes("bone-marrow")) kind = "red-cells";
  return { kind, ...lessons[kind] };
}
