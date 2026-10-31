"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";

import { getResultLesson, type LessonKind } from "@/lib/result-lesson";
import type { LabResult } from "@/types/report";

function motionSubscription(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function visibilitySubscription(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function BloodCells({ white = false, platelets = false }: { white?: boolean; platelets?: boolean }) {
  return <g>
    <path d="M225 95q65-30 160 0v100q-80-30-160 0Z" fill="#fbe8e6" stroke="#c26b6b" strokeWidth="3" />
    {[250, 305, 360].map((x, index) => <g key={x} className="lesson-particle" style={{ animationDelay: `${index * -0.7}s` }}><ellipse cx={x} cy={125 + index % 2 * 37} rx="19" ry="12" fill="#c64c55" /><ellipse cx={x} cy={125 + index % 2 * 37} rx="9" ry="5" fill="#e99a9c" /></g>)}
    {white && <g><circle cx="305" cy="145" r="25" fill="#ece7f4" stroke="#9475b6" strokeWidth="2" /><path d="M289 139q6-17 17-3 16-6 14 9-11 19-17 4-16 7-14-10Z" fill="#8b66a8" /></g>}
    {platelets && [260, 295, 340, 365].map((x, index) => <circle key={x} className="lesson-particle" cx={x} cy={170 - index % 2 * 45} r="5" fill="#7a619d" />)}
  </g>;
}

function OrganGraphic({ kind }: { kind: LessonKind }) {
  if (kind === "hba1c") return <g>
    {[60, 100, 140].map((x) => <path key={x} className="lesson-particle" d={`M${x} 125l12 8v14l-12 8-12-8v-14Z`} fill="#deb359" stroke="#9c732b" strokeWidth="2" />)}
    <text x="100" y="218" textAnchor="middle">Glucose</text>
    <path className="lesson-flow" d="M173 140h50m167 0h50" stroke="#a37635" strokeWidth="4" strokeDasharray="8 8" />
    <ellipse cx="300" cy="140" rx="62" ry="39" fill="#b94350" /><ellipse cx="300" cy="140" rx="31" ry="18" fill="#e6a1a3" />
    {[270, 299, 328].map((x) => <circle key={x} cx={x} cy="130" r="7" fill="#edc461" />)}
    <text x="300" y="218" textAnchor="middle">Hemoglobin / magnified</text>
    <circle cx="505" cy="140" r="42" fill="#f3e9d8" stroke="#b48a47" strokeWidth="3" /><text x="505" y="145" textAnchor="middle">HbA1c %</text>
    <text x="505" y="218" textAnchor="middle">Over time</text>
  </g>;
  if (kind === "bilirubin") return <g>
    <ellipse cx="85" cy="115" rx="30" ry="19" fill="#b94350" /><ellipse cx="85" cy="115" rx="14" ry="8" fill="#e6a1a3" />
    {[65, 85, 105].map((x) => <circle key={x} className="lesson-particle" cx={x} cy="167" r="6" fill="#cfaa4c" />)}
    <text x="85" y="228" textAnchor="middle">Heme recycling</text>
    <path className="lesson-flow" d="M137 145h82m161 0h68" stroke="#b89b40" strokeWidth="4" strokeDasharray="8 8" />
    <path d="M240 115q55-65 125-10l-18 65-77 12q-48-4-30-67Z" fill="#985248" stroke="#713e37" strokeWidth="3" />
    <text x="300" y="228" textAnchor="middle">Liver / conjugation</text>
    <path d="M490 90v95q15 22 35 0V90" fill="#e4c770" stroke="#ab8b36" strokeWidth="3" />
    <text x="505" y="228" textAnchor="middle">Bilirubin fractions</text>
  </g>;
  if (kind === "thyroid") return <g>
    <path d="M55 100q-10-42 32-42 44 0 34 40-12 30-33 20-30 12-33-18Z" fill="#dfb1bd" stroke="#ad7688" strokeWidth="2" />
    <circle cx="90" cy="117" r="8" fill="#ad5787" /><text x="90" y="158" textAnchor="middle">Pituitary</text>
    <path d="M285 90v100m20-100v100" stroke="#d6b4a1" strokeWidth="7" />
    <path className="lesson-pulse" d="M290 135c-65-62-70 45-22 32l27-14 27 14c48 13 43-94-22-32Z" fill="#bd7062" stroke="#964b44" strokeWidth="2" />
    <text x="295" y="225" textAnchor="middle">Thyroid / neck</text>
    <circle cx="510" cy="130" r="32" fill="#d9ede3" stroke="#4d9d89" strokeWidth="2" /><text x="510" y="135" textAnchor="middle">T4 / T3</text>
    <path className="lesson-flow" d="M125 120H230M370 140H465" stroke="#b26391" fill="none" strokeWidth="4" strokeDasharray="8 8" />
    <text x="175" y="105" textAnchor="middle">TSH</text><text x="510" y="195" textAnchor="middle">Blood hormones</text>
  </g>;
  if (kind === "red-cells" || kind === "immune" || kind === "platelets") return <g>
    <path d="M50 80q20-25 37 0l-2 90q14 24-10 27-32-3-21-26Z" fill="#e3d3b2" stroke="#b9a17c" strokeWidth="3" />
    <path d="M68 90v75" stroke="#b76771" strokeWidth="12" /><text x="75" y="230" textAnchor="middle">Bone marrow</text>
    <BloodCells white={kind === "immune"} platelets={kind === "platelets"} />
    <path className="lesson-flow" d="M115 145h85m200 0h45" stroke="#b53c40" strokeWidth="4" strokeDasharray="8 8" />
    <circle cx="510" cy="145" r="37" fill={kind === "immune" ? "#ece7f4" : "#f8e2df"} stroke="#b88083" strokeWidth="2" />
    <text x="510" y="150" textAnchor="middle">{kind === "immune" ? "WBC" : kind === "platelets" ? "PLT / MPV" : "Red cells"}</text>
    <text x="305" y="230" textAnchor="middle">Blood vessel / magnified</text>
  </g>;
  if (kind === "kidney") return <g>
    <path d="M100 70c-75-45-100 120-28 130 40 6 50-39 16-42-25-3-12-24 13-27Z" fill="#aa5b58" stroke="#84413f" strokeWidth="3" />
    <text x="80" y="234" textAnchor="middle">Kidney</text>
    <circle cx="285" cy="113" r="43" fill="#fbe8e6" stroke="#bc7773" strokeWidth="3" />
    <path className="lesson-flow" d="M256 100q20-35 45 0t-35 15 35 15" fill="none" stroke="#b53c40" strokeWidth="5" strokeDasharray="8 6" />
    <path d="M280 157v20q65 50 80-5t60 0" fill="none" stroke="#d1ad61" strokeWidth="12" />
    <text x="285" y="55" textAnchor="middle">Tiny blood filter</text><text x="360" y="246" textAnchor="middle">Kidney tubule</text>
    <path className="lesson-flow" d="M120 110h105m208 65h40" stroke="#b53c40" strokeWidth="4" strokeDasharray="8 8" />
    <path d="M500 148q-50 64-1 68 48-4 1-68Z" fill="#e4bd5d" /><text x="505" y="249" textAnchor="middle">Urine</text>
  </g>;
  if (kind === "glucose") return <g>
    {[55, 95, 135].map((x) => <path key={x} className="lesson-particle" d={`M${x} 120l12 8v14l-12 8-12-8v-14Z`} fill="#e1b865" stroke="#aa7d31" />)}<text x="95" y="215" textAnchor="middle">Blood glucose</text>
    <path className="lesson-flow" d="M140 145h74m178 0h53" stroke="#508c7d" strokeWidth="4" strokeDasharray="8 8" />
    <path d="M245 143q40-52 90-14-30 35-84 30Z" fill="#d8ae6d" stroke="#b38b51" strokeWidth="3" />
    <text x="295" y="210" textAnchor="middle">Pancreas / insulin</text>
    <circle cx="505" cy="145" r="45" fill="#dcebe3" stroke="#74a28b" strokeWidth="3" /><path d="M460 122h-12v43h12" fill="none" stroke="#316e60" strokeWidth="5" /><text x="505" y="150" textAnchor="middle">Cell</text>
  </g>;
  if (kind === "liver" || kind === "lipids") return <g>
    <path d="M45 115q50-65 115-10l-18 65-77 12q-48-4-20-67Z" fill="#985248" stroke="#713e37" strokeWidth="3" /><text x="105" y="227" textAnchor="middle">Liver</text>
    <path className="lesson-flow" d="M180 145h45m157 0h58" stroke="#b53c40" strokeWidth="4" strokeDasharray="8 8" />
    {kind === "lipids" ? [260, 305, 350].map((x) => <g key={x} className="lesson-particle"><circle cx={x} cy="145" r="19" fill="#e6c36c" stroke="#bc9446" strokeWidth="2" /><circle cx={x} cy="145" r="9" fill="#f5e6b5" /></g>) : <g><path d="M250 115q55-38 100 8v55q-45 26-100-8Z" fill="#d6a199" stroke="#a76b60" strokeWidth="2" /><circle cx="300" cy="145" r="15" fill="#a96c6c" /></g>}
    <text x="305" y="227" textAnchor="middle">{kind === "lipids" ? "Transport particles" : "Liver cell / magnified"}</text><path d="M475 100v92q25 20 50 0v-92" fill="#e9b8b2" stroke="#b67772" strokeWidth="3" /><text x="500" y="237" textAnchor="middle">Blood sample</text>
  </g>;
  if (kind === "heart") return <g>
    <path className="lesson-pulse" d="M100 90c-50-20-72 25-53 65 15 29 47 53 73 66 40-39 58-75 38-105-14-20-35-32-58-26Z" fill="#aa303c" stroke="#832934" strokeWidth="3" />
    <path d="M100 96V65q0-30 28-28 32 0 26 33" fill="none" stroke="#aa303c" strokeWidth="13" /><text x="110" y="252" textAnchor="middle">Heart muscle</text>
    <BloodCells /><path className="lesson-flow" d="M175 145h35m187 0h57" stroke="#b53c40" strokeWidth="4" strokeDasharray="8 8" />
    <path d="M475 100v92q25 20 50 0v-92" fill="#e9b8b2" stroke="#b67772" strokeWidth="3" /><text x="500" y="240" textAnchor="middle">Marker in blood</text>
  </g>;
  if (kind === "bone" || kind === "nerves") return <g>
    {[70, 105, 140].map((x) => <circle key={x} className="lesson-particle" cx={x} cy={125 + x % 3 * 20} r="12" fill="#dfbd65" />)}<text x="105" y="230" textAnchor="middle">{kind === "bone" ? "Mineral balance" : "Vitamin B12"}</text>
    <path className="lesson-flow" d="M165 145h50m175 0h57" stroke="#a88d47" strokeWidth="4" strokeDasharray="8 8" />
    {kind === "bone" ? <g><path d="M272 90q25-30 47 0l-5 90q20 25-9 30-40-3-24-30Z" fill="#e5d6b4" stroke="#bca57c" strokeWidth="3" /><path d="M295 105v70" stroke="#ba7575" strokeWidth="12" /></g> : <g><path d="M235 145h140m-120 0-22-35m50 35 18 37m35-37 25-35" stroke="#b5942f" fill="none" strokeWidth="5" />{[260, 295, 330].map((x) => <rect key={x} x={x} y="135" width="21" height="20" rx="8" fill="#ead689" stroke="#b5942f" />)}</g>}
    <text x="305" y="252" textAnchor="middle">{kind === "bone" ? "Living bone" : "Nerve / magnified"}</text><circle cx="505" cy="145" r="37" fill="#f5e4d7" stroke="#b88083" /><text x="505" y="150" textAnchor="middle">Lab test</text>
  </g>;
  return <g><path d="M65 85v95q30 30 60 0V85" fill="#edc0b9" stroke="#a96964" strokeWidth="4" /><text x="95" y="235" textAnchor="middle">Sample</text><rect x="250" y="90" width="105" height="105" rx="15" fill="#e2ece5" stroke="#689889" strokeWidth="3" /><text x="302" y="150" textAnchor="middle">Lab method</text><path className="lesson-flow" d="M145 145h80m150 0h60" stroke="#508c7d" strokeWidth="4" strokeDasharray="8 8" /><rect x="460" y="90" width="100" height="110" rx="8" fill="#fff" stroke="#b3c5ba" strokeWidth="3" /><path d="M477 115h65m-65 20h50m-50 20h65m-65 20h45" stroke="#87aa9b" strokeWidth="4" /><text x="510" y="235" textAnchor="middle">Context</text></g>;
}

export function ResultProcessLesson({ result }: { result: LabResult }) {
  const lesson = getResultLesson(result);
  const titleId = useId();
  const container = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inView, setInView] = useState(false);
  const reducedMotion = useSyncExternalStore(motionSubscription, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const visible = useSyncExternalStore(visibilitySubscription, () => document.visibilityState === "visible", () => false);
  const running = playing && !reducedMotion && visible && inView;
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % 3), 4500);
    return () => window.clearInterval(timer);
  }, [running]);
  return <section ref={container} lang="en" dir="ltr" data-lesson={lesson.kind} data-running={running} className="result-lesson overflow-hidden rounded-2xl border border-[var(--line)] bg-white" aria-label={`How ${result.name} relates to the body`}>
    <div className="border-b border-[var(--line)] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Understand the process / {result.name}</p><h3 className="font-display mt-1 text-xl font-semibold">{lesson.title}</h3></div>
    <svg viewBox="0 0 610 285" role="img" aria-labelledby={titleId} className="w-full bg-[#f7f5ef] text-[13px] text-zinc-700"><title id={titleId}>{lesson.title}. {lesson.steps.join(" → ")}. Schematic, not a representation of your body.</title><rect aria-hidden="true" x={[15, 215, 435][step]} y="28" width="165" height="235" rx="18" fill="#147d7309" stroke="#147d7360" strokeDasharray="4 5" /><OrganGraphic kind={lesson.kind} /></svg>
    <div className="p-4">
      <div className="grid gap-2 sm:grid-cols-3" aria-label="Explanation steps">{lesson.steps.map((label, index) => <button key={label} type="button" aria-pressed={step === index} onClick={() => { setStep(index); setPlaying(false); }} className={`flex min-w-0 items-center gap-2 rounded-lg border p-2 text-start text-xs leading-5 [overflow-wrap:anywhere] sm:block ${index === step ? "border-teal-700 bg-teal-50 font-semibold text-teal-900" : "border-zinc-200 text-zinc-600"}`}><span className="block text-[10px] font-bold">0{index + 1}</span>{label}</button>)}</div>
      <p className="mt-4 min-h-20 text-sm leading-6 text-zinc-700" aria-live={running ? "off" : "polite"}>{lesson.captions[step]}</p>
      <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" disabled={reducedMotion} aria-pressed={playing} onClick={() => setPlaying((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">{playing && !reducedMotion ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{reducedMotion ? "Reduced motion: use steps" : playing ? "Pause explanation" : "Play explanation"}</button><p className="text-[10px] text-zinc-500">Illustrative motion, not patient data.</p></div>
    </div>
  </section>;
}
