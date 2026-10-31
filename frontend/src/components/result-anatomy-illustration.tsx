import { useId, type ReactNode } from "react";

import { bodyRegions, getResultAnatomy, type BodyRegion } from "@/lib/result-anatomy";
import type { LabResult } from "@/types/report";

const structures: Record<BodyRegion, ReactNode> = {
  brain: <path d="M111 42c-15-20-33 10-17 19-4 14 17 20 25 8 9 12 30 6 25-8 16-9-2-39-17-19-4-7-12-7-16 0Z" />,
  pituitary: <circle cx="123" cy="73" r="4" />,
  thyroid: <path d="M113 88c-17-13-15 17-3 15l9-4 10 4c12 2 14-28-3-15l-7 6Z" />,
  heart: <><path d="M120 124c-14-6-20 8-14 20 4 9 14 17 23 22 10-10 18-21 12-33-4-7-13-11-21-9Z" /><path d="M120 129v-12q0-12 11-11 13 0 11 14m-27 4-6-14" fill="none" strokeWidth="5" /><path d="m122 135 7 22" fill="none" stroke="#f6cebf" strokeWidth="1.5" /></>,
  liver: <path d="M77 170c13-14 40-12 55-4l-5 17-44 10c-12 2-17-13-6-23Z" />,
  stomach: <path d="M145 169c13-7 20 11 12 24-7 12-29 14-27 1 4-9 16-5 11-16Z" />,
  kidneys: <><path d="M98 202c-22-12-25 26-9 30 13 3 16-10 5-12-7-1-2-8 4-9Z" /><path d="M146 202c22-12 25 26 9 30-13 3-16-10-5-12 7-1 2-8-4-9Z" /></>,
  pancreas: <path d="M103 198q30-12 47 0-9 9-45 8Z" />,
  urinary: <><path d="M92 227q0 20 22 30m40-30q0 20-22 30" fill="none" strokeWidth="3" /><path d="M109 255q14-8 28 0 5 21-14 25-18-4-14-25Z" /></>,
  blood: <path d="M119 109v143m0-128-40 12-22 97m62-109 42 12 23 97m-65 19-21 91m21-91 23 91" fill="none" strokeWidth="4" />,
  "bone-marrow": <path d="M100 282v41m42-41v41m-66-175-7 27m97-27 7 27" fill="none" strokeWidth="5" />,
  bones: <><path d="M123 103v146m-3 17-16 63-4 43m24-106 16 63 4 43m-22-251-38 7-16 47-12 54m68-108 38 7 16 47 12 54m-97 24q29 18 58 0" fill="none" strokeWidth="6" /><path d="M122 126q-40-8-38 6 8 20 38 13m0 1q-42-8-35 6 8 18 35 13m1-39q40-8 38 6-8 20-38 13m0 1q42-8 35 6-8 18-35 13" fill="none" strokeWidth="3" /></>,
  nerves: <path d="M125 74v176m0-134-34 7-15 46-13 48m62-101 33 7 15 46 13 48m-61 33-16 37-3 64m19-101 11 37 9 64m-39-64-12 12m51-12 12 12" fill="none" strokeWidth="2.5" />,
  immune: <>{[[88, 123], [158, 123], [105, 252], [141, 252]].map(([cx, cy]) => <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="5" ry="7" />)}</>,
  muscles: <><path d="M85 135q-16 8-12 30l7 6 13-27Zm75 0q16 8 12 30l-7 6-13-27ZM100 275q-14 19-8 43l9 8 12-48Zm42 0q14 19 8 43l-9 8-12-48Z" /></>,
};

export function ResultAnatomyIllustration({ result }: { result: LabResult }) {
  const titleId = useId();
  const anatomy = getResultAnatomy(result);
  return (
    <figure className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <figcaption className="border-b border-[var(--line)] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Anatomy guide / {result.name}</p>
        <h3 className="font-display mt-1 text-xl font-semibold">{anatomy.label}</h3>
      </figcaption>
      <div className="grid items-center sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <svg viewBox="0 0 250 400" role="img" aria-labelledby={titleId} className="mx-auto h-72 w-full bg-[#f7f5ef] sm:h-96">
          <title id={titleId}>{result.name}: {anatomy.regions.map((region) => bodyRegions[region].label).join(", ") || "no specific organ highlighted"}. Schematic front view, not a diagnosis.</title>
          <path d="M106 24q18-15 35 0 15 18-1 51l-2 17 35 17q14 5 18 30l20 94-13 5-30-87-8 80 13 37-9 108-18 2-16-102h-9l-16 102-18-2-9-108 13-37-8-80-30 87-13-5 20-94q4-25 18-30l35-17-2-17q-16-33 0-51Z" fill="#e2bc9e" fillOpacity=".25" stroke="#b68e73" strokeWidth="1.5" />
          <g fill="#cf9b9d" opacity=".23"><ellipse cx="104" cy="142" rx="19" ry="29" /><ellipse cx="146" cy="142" rx="19" ry="29" /></g>
          {(Object.keys(structures) as BodyRegion[]).map((region) => (
            <g key={region} data-region={region} data-highlighted={anatomy.regions.includes(region)} fill={bodyRegions[region].color} stroke={bodyRegions[region].color} strokeLinejoin="round" strokeLinecap="round" opacity={anatomy.regions.includes(region) ? 1 : 0.12}>
              {structures[region]}
            </g>
          ))}
          <text x="125" y="397" textAnchor="middle" fill="#657572" fontSize="9">FRONT VIEW / NOT TO SCALE</text>
        </svg>
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Related structures</p>
          <ul className="mt-3 space-y-3">{anatomy.regions.map((region) => <li key={region} className="flex items-center gap-3 text-sm font-semibold"><span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: bodyRegions[region].color }} />{bodyRegions[region].label}</li>)}</ul>
          <p className="mt-5 text-sm leading-6 text-zinc-600">{anatomy.explanation}</p>
          <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--muted)]">Highlights explain physiology. They do not locate disease or show damage in your body.</p>
        </div>
      </div>
    </figure>
  );
}
