"use client";

import { AlertTriangle, BookOpen, Bot, CheckCircle2, ChevronLeft, FileSearch, Languages, MapPin, RotateCcw, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { AnatomicalBody } from "@/components/anatomical-body";
import { ReportChatPanel } from "@/components/report-chat-panel";
import { getResultAnatomy } from "@/lib/result-anatomy";
import { calculateHealthRating } from "@/lib/health-rating";
import { languageDirection, languageNames, translate, type Language } from "@/lib/ui-language";
import type { LabResult, ResultStatus, StructuredReport } from "@/types/report";
import { ResultDetailPanel } from "@/components/result-detail-panel";

type StatusFilter = "all" | ResultStatus;

const statusLabels: Record<ResultStatus, string> = {
  high: "High",
  low: "Low",
  normal: "In range",
  unknown: "No range",
};

function localizedStatus(language: Language, status: ResultStatus) {
  if (status === "normal") return translate(language, "inRange");
  if (status === "high") return translate(language, "high");
  if (status === "low") return translate(language, "low");
  return translate(language, "noRange");
}

function statusColor(status: ResultStatus) {
  if (status === "high") return "#a65d14";
  if (status === "low") return "#277093";
  if (status === "normal") return "#147d73";
  return "#707975";
}

function resultValue(result: LabResult) {
  if (result.value_numeric !== null) return `${result.value_numeric}${result.unit ? ` ${result.unit}` : ""}`;
  return result.value_text ?? "Not available";
}

function RangePlot({ result, language }: { result: LabResult; language: Language }) {
  if (result.value_numeric === null || result.reference_min === null || result.reference_max === null || result.reference_max <= result.reference_min) {
    return <p className="text-xs text-zinc-500">No numeric reference range supplied</p>;
  }

  const span = result.reference_max - result.reference_min;
  const domainMin = Math.min(result.value_numeric, result.reference_min) - span * 0.25;
  const domainMax = Math.max(result.value_numeric, result.reference_max) + span * 0.25;
  const toPercent = (value: number) => ((value - domainMin) / (domainMax - domainMin)) * 100;
  const rangeStart = toPercent(result.reference_min);
  const rangeWidth = toPercent(result.reference_max) - rangeStart;
  const marker = toPercent(result.value_numeric);
  const markerLabel = Math.min(92, Math.max(8, marker));

  return (
    <div className="pt-7">
      <div className="relative h-3 bg-zinc-200" aria-label={`Reference range ${result.reference_min} to ${result.reference_max}`}>
        <span className="absolute h-2 bg-emerald-200" style={{ left: `${rangeStart}%`, width: `${rangeWidth}%` }} />
        <span className="absolute top-0 h-3 w-px bg-emerald-800" style={{ left: `${rangeStart}%` }} />
        <span className="absolute top-0 h-3 w-px bg-emerald-800" style={{ left: `${rangeStart + rangeWidth}%` }} />
        <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold" style={{ left: `${markerLabel}%`, color: statusColor(result.calculated_status) }}>{translate(language, "yourValue")} {result.value_numeric}</span>
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow" style={{ left: `${marker}%`, backgroundColor: statusColor(result.calculated_status) }} />
      </div>
      <div className="relative mt-2 h-8 text-[11px] text-zinc-500"><span className="absolute -translate-x-1/2" style={{ left: `${rangeStart}%` }}>{result.reference_min}</span><span className="absolute -translate-x-1/2" style={{ left: `${rangeStart + rangeWidth}%` }}>{result.reference_max}</span><span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap">{translate(language, "normalRange")} {result.reference_min}–{result.reference_max} {result.unit ?? ""}</span></div>
    </div>
  );
}

export function ReportDashboard({ report, onReview, onReset }: { report: StructuredReport; onReview: () => void; onReset: () => void }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [anatomyResult, setAnatomyResult] = useState<LabResult>(report.results[0]);
  const [reportChatOpen, setReportChatOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const counts = report.results.reduce<Record<ResultStatus, number>>((summary, result) => {
    summary[result.calculated_status] += 1;
    return summary;
  }, { low: 0, normal: 0, high: 0, unknown: 0 });
  const filteredResults = report.results.filter((result) => {
    const matchesStatus = statusFilter === "all" || result.calculated_status === statusFilter;
    const matchesSearch = !deferredSearch || result.name.toLowerCase().includes(deferredSearch) || result.category?.toLowerCase().includes(deferredSearch);
    return matchesStatus && matchesSearch;
  });
  const categories = Array.from(new Set(filteredResults.map((result) => result.category ?? "Other")));
  const outsideRange = counts.high + counts.low;
  const healthRating = calculateHealthRating(report.results);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    localStorage.setItem("clarity-language", nextLanguage);
  }

  function openNearbyCare() {
    localStorage.setItem("clarity-care-context", JSON.stringify({ language, results: report.results.map(({ name, calculated_status }) => ({ name, calculated_status })) }));
    window.open("/nearby-care", "_blank", "noopener,noreferrer");
  }

  return (
    <section dir={languageDirection(language)} data-workspace-full className="min-w-0 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--line)] pb-6">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--teal)]">Phase 3 · {translate(language, "dashboard")}</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-[var(--ink)] sm:text-4xl">{translate(language, "title")}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Compared only with the reference intervals printed in {report.filename}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative inline-flex h-10 items-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700"><Languages className="size-4" /><span className="sr-only">{translate(language, "language")}</span><select value={language} onChange={(event) => changeLanguage(event.target.value as Language)} className="bg-transparent outline-none">{(Object.keys(languageNames) as Language[]).map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}</select></label>
          <button type="button" onClick={openNearbyCare} className="inline-flex h-10 items-center gap-2 border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"><MapPin className="size-4" />{translate(language, "nearbyCare")}</button>
          <button type="button" onClick={onReview} className="inline-flex h-10 items-center gap-2 border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"><ChevronLeft className="size-4" /> {translate(language, "review")}</button>
          <button type="button" onClick={onReset} title="Process another report" className="grid size-10 place-items-center bg-zinc-900 text-white hover:bg-teal-700"><RotateCcw className="size-4" /><span className="sr-only">Process another report</span></button>
        </div>
      </div>

      <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-w-0 w-full max-w-full overflow-hidden lg:sticky lg:top-6 lg:self-start">
          <div className="border-y border-[var(--line)] py-4">
            <p className="text-xs font-bold uppercase text-[var(--teal)]">{translate(language, "bodyMap")}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{translate(language, "selected")}: <strong className="text-[var(--ink)]">{anatomyResult.name}</strong></p>
          </div>
          <div className="relative">
            <div className="absolute left-3 top-3 z-10 border border-[var(--line)] bg-white/90 px-3 py-2 shadow-sm backdrop-blur"><p className="text-[10px] font-bold uppercase text-[var(--muted)]">{translate(language, "healthRating")}</p><p className="mt-0.5 text-2xl font-semibold text-[var(--ink)]">{healthRating}<span className="text-sm text-[var(--muted)]">/100</span></p><p className="max-w-32 text-[9px] leading-3 text-[var(--muted)]">{translate(language, "ratingNote")}</p></div>
          <AnatomicalBody anatomy={getResultAnatomy(anatomyResult)} />
          </div>
        </aside>
        <div className="min-w-0">
          <div className="grid border-y border-[var(--line)] grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-r border-[var(--line)] py-4 xl:border-b-0"><p className="text-2xl font-semibold text-[var(--ink)]">{report.results.length}</p><p className="mt-1 text-[10px] uppercase text-[var(--muted)]">{translate(language, "confirmed")}</p></div>
            <div className="border-b border-[var(--line)] py-4 pl-4 xl:border-b-0 xl:border-r"><p className="text-2xl font-semibold text-emerald-700">{counts.normal}</p><p className="mt-1 text-[10px] uppercase text-[var(--muted)]">{translate(language, "inRange")}</p></div>
            <div className="border-r border-[var(--line)] py-4 xl:pl-4"><p className="text-2xl font-semibold text-amber-700">{outsideRange}</p><p className="mt-1 text-[10px] uppercase text-[var(--muted)]">{translate(language, "outside")}</p></div>
            <div className="py-4 pl-4"><p className="text-2xl font-semibold text-zinc-600">{counts.unknown}</p><p className="mt-1 text-[10px] uppercase text-[var(--muted)]">{translate(language, "withoutRange")}</p></div>
          </div>

          {outsideRange > 0 && <div className="mt-4 flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><strong>{outsideRange} {outsideRange === 1 ? "result is" : "results are"} outside the listed range.</strong> This is not a diagnosis; discuss questions with a qualified healthcare professional.</p></div>}

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-1" aria-label="Filter results by status">
              {(["all", "normal", "high", "low", "unknown"] as StatusFilter[]).map((filter) => (
                <button key={filter} type="button" onClick={() => setStatusFilter(filter)} className={`h-9 px-3 text-xs font-semibold ${statusFilter === filter ? "bg-[var(--ink)] text-white" : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"}`}>{filter === "all" ? translate(language, "all") : localizedStatus(language, filter)}{filter !== "all" && ` (${counts[filter]})`}</button>
              ))}
            </div>
            <label className="relative block xl:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><span className="sr-only">{translate(language, "search")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={translate(language, "search")} className="h-10 w-full border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-700" /></label>
          </div>

          <div className="mt-7 space-y-8">
          {categories.map((category) => {
          const categoryResults = filteredResults.filter((result) => (result.category ?? "Other") === category);
          return (
            <section key={category}>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-[var(--ink)]">{category}</h2><span className="text-xs text-[var(--muted)]">{categoryResults.length} {categoryResults.length === 1 ? "test" : "tests"}</span></div>
              <div className="grid gap-3 md:grid-cols-2">
                {categoryResults.map((result, index) => (
                  <article key={`${result.name}-${result.source_page}-${index}`} role="button" tabIndex={0} aria-label={`Show ${result.name} on body map`} onClick={() => setAnatomyResult(result)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setAnatomyResult(result); } }} className={`cursor-pointer border bg-white p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700 ${anatomyResult === result ? "border-teal-700 ring-1 ring-teal-700" : "border-zinc-200 hover:border-zinc-400"}`}>
                    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-zinc-900">{result.name}</h3><p className="mt-1 text-xl font-semibold" style={{ color: statusColor(result.calculated_status) }}>{resultValue(result)}</p></div><span className="px-2 py-1 text-xs font-semibold" style={{ color: statusColor(result.calculated_status), backgroundColor: `${statusColor(result.calculated_status)}18` }}>{statusLabels[result.calculated_status]}</span></div>
                    <div className="mt-4"><RangePlot result={result} language={language} /></div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3"><details onClick={(event) => event.stopPropagation()}><summary className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-teal-700"><FileSearch className="size-3.5" />{translate(language, "evidence")} · page {result.source_page}</summary><p className="mt-2 text-xs leading-5 text-zinc-600">{result.source_text}</p></details><button type="button" onClick={(event) => { event.stopPropagation(); setAnatomyResult(result); setSelectedResult(result); }} className="inline-flex h-8 shrink-0 items-center gap-2 bg-[var(--ink)] px-3 text-xs font-semibold text-white hover:bg-teal-700"><BookOpen className="size-3.5" />{translate(language, "learn")}</button></div>
                  </article>
                ))}
              </div>
            </section>
          );
          })}
          {filteredResults.length === 0 && <div className="border border-dashed border-zinc-300 bg-white px-5 py-12 text-center"><CheckCircle2 className="mx-auto size-6 text-zinc-400" /><p className="mt-3 text-sm text-zinc-600">No confirmed results match this filter.</p></div>}
          </div>
        </div>
      </div>
      {selectedResult && <ResultDetailPanel result={selectedResult} language={language} onClose={() => setSelectedResult(null)} />}
      <button type="button" onClick={() => setReportChatOpen(true)} className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 bg-[var(--ink)] px-4 text-sm font-semibold text-white shadow-xl hover:bg-teal-700 sm:bottom-8 sm:right-8"><Bot className="size-5" />{translate(language, "askReport")}</button>
      {reportChatOpen && <ReportChatPanel results={report.results} language={language} onClose={() => setReportChatOpen(false)} />}
    </section>
  );
}