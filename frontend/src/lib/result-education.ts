export type ResultEducation = {
  image: string;
  imageAlt: string;
  overview: string;
  purpose: string;
  outsideRange: string;
};

const education: Record<string, ResultEducation> = {
  hemoglobin: {
    image: "/medical/hemoglobin.png",
    imageAlt: "Illustration of red blood cells that contain hemoglobin",
    overview: "Hemoglobin is an iron-containing protein inside red blood cells. It picks up oxygen in the lungs and carries it to tissues throughout the body.",
    purpose: "The test helps show how well the blood may carry oxygen and is commonly reviewed when checking for anemia, blood loss, or changes in red blood cell production.",
    outsideRange: "A low value can occur for many reasons, including some nutrient deficiencies or blood loss. A high value can occur with dehydration or when the body makes more red blood cells. The cause cannot be determined from this result alone.",
  },
  "white blood cells": {
    image: "/medical/white-blood-cells.png",
    imageAlt: "Illustration of white blood cells among other blood cells",
    overview: "White blood cells are part of the immune system. Different types help recognize and respond to infection, inflammation, and other changes in the body.",
    purpose: "The count gives clinicians a broad view of immune activity and bone marrow production. It is interpreted with the differential count, symptoms, medicines, and recent illness.",
    outsideRange: "A high or low count has many possible explanations, from temporary stress or infection to medication effects. The direction and size of the change do not identify a cause on their own.",
  },
  platelets: {
    image: "/medical/platelets.png",
    imageAlt: "Illustration showing small platelets among red blood cells",
    overview: "Platelets are small blood components that gather at an injured blood vessel and help form a clot.",
    purpose: "The count helps assess whether the body has an expected number of platelets available for clotting and is considered alongside bleeding symptoms and other blood tests.",
    outsideRange: "Low counts can be associated with easier bruising or bleeding, while high counts may be temporary or linked with increased production. The clinical meaning depends on the degree, trend, and wider health picture.",
  },
  glucose: {
    image: "/medical/glucose.png",
    imageAlt: "Educational illustration of a glucose molecule",
    overview: "Glucose is a sugar carried in the blood and used by cells as a major source of energy. Insulin and other hormones help keep it within a workable range.",
    purpose: "Glucose testing helps assess how the body is managing blood sugar. Interpretation depends strongly on whether the sample was fasting, random, or taken after a meal.",
    outsideRange: "A single high or low result can have temporary or longer-term causes. Timing, food, exercise, illness, medicines, symptoms, and repeat measurements all matter before drawing conclusions.",
  },
};

const fallback: ResultEducation = {
  image: "/medical/generic-lab.png",
  imageAlt: "Educational illustration of a laboratory sample and result sheet",
  overview: "This laboratory test measures a specific feature of the submitted sample. Its meaning depends on why the test was ordered and how it relates to other findings.",
  purpose: "Clinicians use laboratory results as one part of a broader assessment that can include symptoms, medical history, examination, and other tests.",
  outsideRange: "Being outside a listed interval does not by itself establish a diagnosis. Reference intervals vary by laboratory and an individual result should be interpreted in context.",
};

function redCellEducation(overview: string, purpose: string): ResultEducation {
  return {
    image: "/medical/hemoglobin.png",
    imageAlt: "Illustration of red blood cells",
    overview,
    purpose,
    outsideRange: "Red-cell measurements are interpreted together. Values outside range can reflect changes in cell number, size, hemoglobin content, hydration, nutrition, or production, but one marker alone cannot identify the cause.",
  };
}

function whiteCellEducation(cellType: string, role: string): ResultEducation {
  return {
    image: "/medical/white-blood-cells.png",
    imageAlt: "Illustration of white blood cells among other blood cells",
    overview: `${cellType} are white blood cells. ${role}`,
    purpose: `The ${cellType.toLowerCase()} result helps show the balance of immune-cell types and is interpreted with the total white-cell count, symptoms, medicines, and recent illness.`,
    outsideRange: "Higher or lower levels can have temporary or longer-term causes, including infection, inflammation, medicines, stress, or changes in blood-cell production. The count alone does not identify which cause applies.",
  };
}

function organEducation(image: string, imageAlt: string, overview: string, purpose: string, outsideRange: string): ResultEducation {
  return { image, imageAlt, overview, purpose, outsideRange };
}

const markerEducation: Array<{ matches: (name: string) => boolean; content: ResultEducation }> = [
  {
    matches: (name) => name.includes("hematocrit") || name.includes("haematocrit") || name.includes("pcv"),
    content: redCellEducation("Hematocrit, also called packed cell volume, is the percentage of blood volume made up of red blood cells.", "It helps assess the concentration of red blood cells and is usually interpreted beside hemoglobin and the red blood cell count."),
  },
  {
    matches: (name) => name.includes("rbc count") || name === "rbc",
    content: redCellEducation("The red blood cell count estimates how many oxygen-carrying red blood cells are present in a given volume of blood.", "It helps evaluate oxygen-carrying capacity and patterns that can occur with anemia, hydration changes, or altered red-cell production."),
  },
  {
    matches: (name) => name.includes("mcv"),
    content: redCellEducation("Mean corpuscular volume, or MCV, estimates the average size of red blood cells.", "Cell size helps clinicians group different patterns of anemia and decide which related results or tests may be useful."),
  },
  {
    matches: (name) => name.includes("mchc"),
    content: redCellEducation("Mean corpuscular hemoglobin concentration, or MCHC, estimates how concentrated hemoglobin is inside red blood cells.", "It adds context to hemoglobin, MCV, and other red-cell indices when reviewing an anemia pattern."),
  },
  {
    matches: (name) => name.includes("mch"),
    content: redCellEducation("Mean corpuscular hemoglobin, or MCH, estimates the average amount of hemoglobin in each red blood cell.", "It is interpreted with cell size and hemoglobin concentration to describe the overall red-cell pattern."),
  },
  {
    matches: (name) => name.includes("rdw") || name.includes("red cell distribution"),
    content: redCellEducation("Red cell distribution width, or RDW, describes how much red blood cell sizes vary from one another.", "It can add context when red cells are unusually small or large and is interpreted with MCV and the rest of the blood count."),
  },
  {
    matches: (name) => name.includes("neutrophil"),
    content: whiteCellEducation("Neutrophils", "They respond quickly to many infections and tissue injuries, especially bacterial infections."),
  },
  {
    matches: (name) => name.includes("lymphocyte"),
    content: whiteCellEducation("Lymphocytes", "They include cells involved in antibodies, viral responses, and immune memory."),
  },
  {
    matches: (name) => name.includes("eosinophil"),
    content: whiteCellEducation("Eosinophils", "They can participate in allergic responses and defense against some parasites."),
  },
  {
    matches: (name) => name.includes("monocyte"),
    content: whiteCellEducation("Monocytes", "They help remove damaged material and can develop into tissue cells that support longer immune responses."),
  },
  {
    matches: (name) => name.includes("basophil"),
    content: whiteCellEducation("Basophils", "They are uncommon cells involved in allergic and inflammatory signaling."),
  },
  {
    matches: (name) => name.includes("mpv") || name.includes("mean platelet volume"),
    content: {
      ...education.platelets,
      overview: "Mean platelet volume, or MPV, estimates the average size of platelets. Newer platelets are often larger than older ones.",
      purpose: "MPV is interpreted with the platelet count to add context about platelet production and turnover.",
    },
  },
  {
    matches: (name) => name.includes("ast / alt") || name.includes("ast/alt"),
    content: organEducation("/medical/liver.png", "Illustration of the liver", "The AST-to-ALT ratio compares two enzymes that can be released when cells are stressed or injured.", "Clinicians interpret the ratio only alongside the individual AST and ALT values, symptoms, medicines, and other liver-related tests.", "A ratio by itself does not diagnose liver disease, and it can be misleading when either underlying enzyme is within range or affected by non-liver tissues."),
  },
  {
    matches: (name) => name.includes("sgot") || /\bast\b/.test(name),
    content: organEducation("/medical/liver.png", "Illustration of the liver", "AST is an enzyme found in the liver, muscles, heart, and several other tissues.", "The test helps detect cell stress or injury but is not specific to one organ, so it is commonly compared with ALT and the wider clinical picture.", "A raised AST can have liver and non-liver explanations. A normal or low value is usually considered with the rest of the panel rather than alone."),
  },
  {
    matches: (name) => name.includes("sgpt") || /\balt\b/.test(name),
    content: organEducation("/medical/liver.png", "Illustration of the liver", "ALT is an enzyme found mainly in liver cells and can enter the blood when those cells are stressed or injured.", "It is commonly used with AST, bilirubin, and other findings to look for a pattern rather than to make a diagnosis by itself.", "ALT can change with many conditions, medicines, exercise, and temporary illness. The size and trend of a change matter."),
  },
  {
    matches: (name) => name.includes("bilirubin"),
    content: organEducation("/medical/liver.png", "Illustration of the liver", "Bilirubin is a yellow pigment produced when old red blood cells are broken down. The liver processes it so it can leave the body.", "Total, direct, and indirect bilirubin help show where bilirubin processing may be changing and are interpreted together.", "Values can change because of red-cell breakdown, liver processing, or bile flow. The pattern across the bilirubin fractions and other tests is more informative than one value."),
  },
  {
    matches: (name) => name.includes("bun creatinine") || name.includes("bun/creatinine"),
    content: organEducation("/medical/kidneys.png", "Illustration of the kidneys and urinary tract", "The BUN-to-creatinine ratio compares two waste-related blood measurements.", "It can provide context about hydration, protein breakdown, and kidney-related patterns, but it must be read with the individual BUN and creatinine results.", "A high or low ratio can result from changes in either component. It does not independently measure kidney function or establish a diagnosis."),
  },
  {
    matches: (name) => name.includes("blood urea nitrogen") || /\bbun\b/.test(name),
    content: organEducation("/medical/kidneys.png", "Illustration of the kidneys and urinary tract", "Blood urea nitrogen, or BUN, measures nitrogen from urea, a waste product created as the body processes protein.", "The kidneys remove urea, so BUN is reviewed with creatinine, hydration, diet, and other clinical information.", "BUN may change with hydration, protein intake or breakdown, bleeding, medicines, and kidney handling. It is not a stand-alone kidney diagnosis."),
  },
  {
    matches: (name) => name === "urea" || name.includes("blood urea"),
    content: organEducation("/medical/kidneys.png", "Illustration of the kidneys and urinary tract", "Urea is a waste product formed when the body processes protein and is largely removed by the kidneys.", "It contributes to assessing waste removal and hydration when interpreted with creatinine and the rest of the clinical picture.", "Levels can vary with hydration, diet, protein breakdown, and kidney handling. One result does not identify the cause."),
  },
  {
    matches: (name) => name.includes("creatinine"),
    content: organEducation("/medical/kidneys.png", "Illustration of the kidneys and urinary tract", "Creatinine is a waste product produced by normal muscle activity and filtered from blood by the kidneys.", "It is commonly used to estimate kidney filtration, often through a calculated eGFR, while considering age, muscle mass, and trends over time.", "A high value can suggest reduced filtration in the right context; a low value may reflect lower muscle mass or other factors. Interpretation depends on the person and trend."),
  },
  {
    matches: (name) => name.includes("tsh") || name.includes("thyroid stimulating"),
    content: organEducation("/medical/thyroid.png", "Illustration of the thyroid gland", "TSH is a hormone made by the pituitary gland that signals the thyroid to make thyroid hormones.", "It is a common first-line test of thyroid regulation and is often interpreted with free T4, symptoms, medicines, and pregnancy status where relevant.", "High or low TSH can reflect several thyroid and non-thyroid situations. A boundary value or single measurement usually needs clinical context and sometimes repeat testing."),
  },
];

const urineEducation: Record<string, ResultEducation> = {
  colour: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine colour is a physical observation influenced mainly by concentration and pigments in the sample.", "It offers a quick clue about hydration and whether unusual pigment, blood, medicines, or foods may be present.", "Colour varies widely with hydration, food, supplements, and medicines. It should be considered with appearance, chemical tests, and symptoms."),
  color: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine color is a physical observation influenced mainly by concentration and pigments in the sample.", "It offers a quick clue about hydration and whether unusual pigment, blood, medicines, or foods may be present.", "Color varies widely with hydration, food, supplements, and medicines. It should be considered with appearance, chemical tests, and symptoms."),
  appearance: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine appearance describes whether the sample looks clear or cloudy.", "Cloudiness can guide closer microscopic or chemical review of cells, crystals, mucus, or microorganisms.", "A cloudy sample can have harmless or clinically relevant causes, and collection quality matters. Appearance alone cannot diagnose an infection."),
  "specific gravity": organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine specific gravity estimates how concentrated or dilute the urine is.", "It helps provide context about hydration and the kidneys' ability to concentrate urine.", "Fluid intake, sweating, medicines, and kidney handling can affect it. One measurement varies throughout the day."),
  ph: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine pH describes how acidic or alkaline the sample is.", "It can support interpretation of urinary symptoms, crystals, diet-related changes, and some treatments.", "Food, medicines, sample timing, infection, and handling can change urine pH; it is not diagnostic by itself."),
  glucose: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine glucose checks whether detectable sugar has passed into urine.", "It can add context when evaluating blood sugar or kidney handling, but blood glucose testing is usually more direct.", "Detected glucose can have several explanations and should be interpreted with blood results, medicines, pregnancy status, and symptoms."),
  protein: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine protein checks for proteins that are usually kept in the bloodstream by the kidney filters.", "It is used as a screening signal and may lead to a more specific urine protein measurement when clinically appropriate.", "Temporary detection can occur with exercise, fever, or concentrated urine, while persistent findings may need further assessment."),
  ketones: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Ketones are produced when the body uses fat as a major energy source instead of glucose.", "Urine ketones can provide context during fasting, vomiting, low-carbohydrate intake, or diabetes-related assessment.", "Detected ketones vary in significance. With diabetes and feeling unwell, prompt professional advice may be important."),
  blood: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "The urine blood pad reacts to red blood cells or their oxygen-carrying pigment, hemoglobin.", "It screens for blood-related material that may need confirmation with microscopy and clinical context.", "Detection can have urinary, menstrual, exercise-related, collection, or other causes. It does not identify the source by itself."),
  bilirubin: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine bilirubin checks for a water-soluble form of bilirubin that can pass into urine.", "It may provide context about liver processing and bile flow when interpreted with blood bilirubin and liver tests.", "A detected result needs confirmation and clinical interpretation; sample handling and medicines can affect dipstick results."),
  urobilinogen: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urobilinogen is formed in the intestine from bilirubin, and a small amount can normally appear in urine.", "It can add context to liver, bile-flow, and red-cell breakdown patterns when reviewed with other results.", "Higher or lower readings are nonspecific and can be affected by timing and sample storage. They are not diagnostic alone."),
  nitrite: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "The urine nitrite test looks for a chemical produced by some bacteria.", "It is one part of screening for a possible urinary infection and is interpreted with symptoms, white cells, and sometimes a culture.", "A positive result can support bacterial presence, while a negative result does not rule out infection because not all bacteria produce nitrite."),
  "pus cells": organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Pus cells usually refer to white blood cells seen during urine microscopy.", "They help assess whether inflammation may be present in the urinary tract and are interpreted with symptoms, nitrite, bacteria, and culture results.", "Increased cells can occur with infection, inflammation, or sample contamination. The finding alone does not prove infection."),
  rbc: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine RBC reports red blood cells seen under the microscope.", "Microscopy can confirm and estimate red cells after a dipstick blood result or when urinary symptoms are being assessed.", "Detected cells can have many urinary or collection-related causes. Persistence, quantity, symptoms, and collection timing guide follow-up."),
  epithelial: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Epithelial cells line the urinary tract and surrounding skin, and small numbers may enter a urine sample.", "Their type and quantity can help assess sample quality and, less commonly, urinary-tract changes.", "Higher numbers often reflect collection contamination, but interpretation depends on the cell type and other urine findings."),
  casts: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Casts are tube-shaped microscopic structures that can form inside kidney tubules.", "Their presence and type can provide clues about what is occurring within the kidneys.", "Different cast types have very different meanings. A simple detected/not-detected value must be interpreted with microscopy details and kidney findings."),
  crystals: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine crystals are mineral structures that can form as urine concentration, pH, temperature, and dissolved substances change.", "Their shape and type may help assess stone risk or explain a microscopic finding.", "Some crystals are common and harmless; others matter in a particular clinical context. Hydration and sample storage can change what is seen."),
  bacteria: organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "Urine microscopy may report bacteria seen in the sample.", "The finding is interpreted with urinary symptoms, white cells, nitrite, and sample collection quality.", "Bacteria can reflect infection or contamination during collection. A urine culture may be needed to distinguish them."),
};

const genericUrine = organEducation("/medical/urinalysis.png", "Illustration of a urine sample and test strip", "This is part of a urinalysis, which examines the physical, chemical, or microscopic features of urine.", "Urinalysis helps screen for patterns involving hydration, the urinary tract, kidneys, liver, and metabolism.", "Results can be affected by collection, hydration, medicines, exercise, and contamination. Individual findings should be interpreted together, not in isolation.");

export function getResultEducation(name: string, category?: string | null): ResultEducation {
  const normalized = name.toLowerCase();
  const normalizedCategory = category?.toLowerCase() ?? "";
  const urineNames = ["colour", "color", "appearance", "specific gravity", "ph", "glucose", "protein", "ketones", "blood", "bilirubin", "urobilinogen", "nitrite", "pus cells", "rbc", "epithelial", "casts", "crystals", "bacteria"];
  if (normalizedCategory.includes("clinical pathology") || normalizedCategory.includes("urine") || urineNames.some((item) => normalized === item || normalized.includes(`urine ${item}`))) {
    const specific = Object.entries(urineEducation).find(([key]) => normalized.includes(key));
    return specific?.[1] ?? genericUrine;
  }
  if (normalized.includes("haemoglobin") || normalized.includes("hemoglobin")) return education.hemoglobin;
  if (normalized.includes("white blood") || normalized.includes("wbc") || normalized.includes("tlc")) return education["white blood cells"];
  const marker = markerEducation.find((item) => item.matches(normalized));
  if (marker) return marker.content;
  if (normalized.includes("platelet")) return education.platelets;
  if (normalized.includes("glucose")) return education.glucose;
  return fallback;
}