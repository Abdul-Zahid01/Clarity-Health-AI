import type { BodyRegion } from "./result-anatomy";

export type AtlasFrame = { centerY: number; height: number; width: number };
const wholeBody: AtlasFrame = { centerY: 0, height: 4.8, width: 2.3 };

export function atlasFrame(region: BodyRegion | null): AtlasFrame {
  switch (region) {
    case "thyroid": return { centerY: 1.25, height: 1.3, width: 1.2 };
    case "pituitary": case "brain": return { centerY: 1.7, height: 1.3, width: 1.2 };
    case "heart": return { centerY: 0.75, height: 1.7, width: 1.5 };
    case "liver": case "stomach": case "pancreas": case "kidneys":
      return { centerY: 0.25, height: 1.8, width: 1.7 };
    case "urinary": return { centerY: -0.2, height: 2.0, width: 1.7 };
    default: return wholeBody;
  }
}
