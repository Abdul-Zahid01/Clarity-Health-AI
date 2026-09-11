"use client";

import { Ban, Check, CheckCheck, ChevronLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type { LabResult, ResultStatus, StructuredReport } from "@/types/report";

type NumericField = "value_numeric" | "reference_min" | "reference_max";

function calculateStatus(result: LabResult): ResultStatus {
  if (result.value_numeric === null || result.reference_min === null || result.reference_max === null) return "unknown";
  if (result.value_numeric < result.reference_min) return "low";
  if (result.value_numeric > result.reference_max) return "high";
  return "normal";
}

function statusStyle(status: ResultStatus) {
  if (status === "high") return "bg-amber-100 text-amber-900";
  if (status === "low") return "bg-sky-100 text-sky-900";
  if (status === "normal") return "bg-emerald-100 text-emerald-900";
  return "bg-zinc-100 text-zinc-600";
}

function hasFlagMismatch(result: LabResult) {
  const expected = result.reported_flag === "H" ? "high" : result.reported_flag === "L" ? "low" : result.reported_flag === "N" ? "normal" : null;
  return expected !== null && expected !== result.calculated_status;
}

export function ReportReview({ report, onBack, onComplete }: { report: StructuredReport; onBack: () => void; onComplete: (results: LabResult[]) => void }) {
  const [results, setResults] = useState(report.results);
  const confirmedCount = results.filter((result) => result.review_status === "confirmed").length;
  const excludedCount = results.filter((result) => result.review_status === "excluded").length;
  const reviewedCount = confirmedCount + excludedCount;
  const reviewComplete = confirmedCount > 0 && reviewedCount === results.length;

  function updateResult(index: number, changes: Partial<LabResult>) {
    setResults((current) => current.map((result, resultIndex) => {
      if (resultIndex !== index) return result;
      const updated = { ...result, ...changes };
      return { ...updated, calculated_status: calculateStatus(updated), review_status: "pending" };
    }));
  }

  function updateNumber(index: number, field: NumericField, value: string) {
    updateResult(index, { [field]: value === "" ? null : Number(value) });
  }

  function confirmResult(index: number) {
    setResults((current) => current.map((result, resultIndex) => resultIndex === index ? { ...result, review_status: "confirmed" } : result));
  }

  function confirmAll() {
    setResults((current) => current.map((result) => result.review_status === "excluded" ? result : { ...result, review_status: "confirmed" }));
  }

  function toggleExcluded(index: number) {
    setResults((current) => current.map((result, resultIndex) => resultIndex === index ? { ...result, review_status: result.review_status === "excluded" ? "pending" : "excluded" } : result));
  }

  return (
    <section data-workspace-full className="min-w-0 lg:col-span-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--teal)]">Phase 2 · Human review</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-[var(--ink)]">Verify extracted results</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{reviewedCount} of {results.length} reviewed · {confirmedCount} confirmed · {excludedCount} excluded.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={confirmAll} className="inline-flex h-10 items-center gap-2 border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"><CheckCheck className="size-4" /> Confirm all</button>
          <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-2 border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"><ChevronLeft className="size-4" /> Back to report</button>
        </div>
      </div>

      {reviewComplete && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><span className="flex items-center gap-3"><ShieldCheck className="size-5" />Review complete. Only confirmed values will continue.</span><button type="button" onClick={() => onComplete(results.filter((result) => result.review_status === "confirmed"))} className="h-9 bg-emerald-900 px-4 text-xs font-semibold text-white hover:bg-emerald-800">Finalize review</button></div>}

      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr><th className="px-4 py-3">Test</th><th className="px-3 py-3">Value</th><th className="px-3 py-3">Range</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Evidence</th><th className="px-4 py-3">Review</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {results.map((result, index) => (
              <tr key={`${result.name}-${result.source_page}-${index}`} className={`align-top ${result.review_status === "excluded" ? "bg-zinc-50 opacity-60" : ""}`}>
                <td className="px-4 py-4"><p className="font-semibold text-zinc-900">{result.name}</p><p className="mt-1 text-xs text-zinc-500">{result.category ?? "Uncategorized"}</p></td>
                <td className="px-3 py-4"><input aria-label={`${result.name} value`} type={result.value_numeric === null ? "text" : "number"} step="any" value={result.value_numeric ?? result.value_text ?? ""} onChange={(event) => result.value_numeric === null ? updateResult(index, { value_text: event.target.value || null }) : updateNumber(index, "value_numeric", event.target.value)} className="h-9 w-24 border border-zinc-300 px-2" /></td>
                <td className="px-3 py-4"><div className="flex items-center gap-1"><input aria-label={`${result.name} minimum`} type="number" step="any" value={result.reference_min ?? ""} onChange={(event) => updateNumber(index, "reference_min", event.target.value)} className="h-9 w-20 border border-zinc-300 px-2" /><span>–</span><input aria-label={`${result.name} maximum`} type="number" step="any" value={result.reference_max ?? ""} onChange={(event) => updateNumber(index, "reference_max", event.target.value)} className="h-9 w-20 border border-zinc-300 px-2" /></div></td>
                <td className="px-3 py-4"><input aria-label={`${result.name} unit`} value={result.unit ?? ""} onChange={(event) => updateResult(index, { unit: event.target.value || null })} className="h-9 w-24 border border-zinc-300 px-2" /></td>
                <td className="px-3 py-4"><span className={`inline-flex px-2 py-1 text-xs font-semibold capitalize ${statusStyle(result.calculated_status)}`}>{result.calculated_status}</span>{result.reported_flag && <p className="mt-2 text-xs text-zinc-500">Lab flag: {result.reported_flag}</p>}{hasFlagMismatch(result) && <p className="mt-1 text-xs font-semibold text-amber-700">Flag mismatch · check source</p>}</td>
                <td className="max-w-52 px-3 py-4"><details><summary className="inline-flex cursor-pointer items-center gap-1 font-semibold text-teal-700">Page {result.source_page}<ExternalLink className="size-3" /></summary><p className="mt-2 text-xs leading-5 text-zinc-600">{result.source_text}</p></details></td>
                <td className="px-4 py-4"><div className="flex flex-col gap-2"><button type="button" disabled={result.review_status === "excluded"} onClick={() => confirmResult(index)} className={`inline-flex h-9 items-center justify-center gap-2 px-3 text-xs font-semibold ${result.review_status === "confirmed" ? "bg-emerald-100 text-emerald-900" : "bg-zinc-900 text-white hover:bg-teal-700 disabled:bg-zinc-200 disabled:text-zinc-500"}`}><Check className="size-3.5" />{result.review_status === "confirmed" ? "Confirmed" : "Confirm"}</button><button type="button" onClick={() => toggleExcluded(index)} className="inline-flex h-8 items-center justify-center gap-2 border border-zinc-300 px-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"><Ban className="size-3.5" />{result.review_status === "excluded" ? "Restore" : "Exclude"}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}