"use client";

import { AlertCircle, CheckCircle2, FileText, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { extractReport, structureReport } from "@/lib/api";
import type { ExtractedPage, ReportExtraction, StructuredReport } from "@/types/report";
import { ReportReview } from "@/components/report-review";
import { confirmedResults } from "@/lib/result-review";
import { createDemoReport } from "@/lib/demo-report";

const ReportDashboard = dynamic(() => import("@/components/report-dashboard").then((module) => module.ReportDashboard), {
  loading: () => <p data-workspace-full role="status" className="p-6 text-sm text-[var(--muted)] lg:col-span-2">Opening your reviewed dashboard...</p>,
});

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEMO_ONLY = process.env.NEXT_PUBLIC_DEMO_ONLY === "true";

function validateFile(file: File): string | null {
  if (file.type !== "application/pdf") return "Choose a PDF file.";
  if (file.size > MAX_FILE_SIZE) return "Choose a PDF smaller than 10 MB.";
  return null;
}

export function ReportUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [cloudProcessingAllowed, setCloudProcessingAllowed] = useState(false);
  const [privacyReviewed, setPrivacyReviewed] = useState(false);
  const [cloudPages, setCloudPages] = useState<ExtractedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [report, setReport] = useState<ReportExtraction | null>(null);
  const [structuredReport, setStructuredReport] = useState<StructuredReport | null>(null);
  const [reviewFinalized, setReviewFinalized] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  async function processFile(file: File) {
    if (processingRef.current) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    processingRef.current = true;
    setIsProcessing(true);
    try {
      const extraction = await extractReport(file);
      setReport(extraction);
      setCloudPages(extraction.cloud_pages);
      setPrivacyReviewed(false);
      setSelectedFile(file);
      setIsDemo(false);
      setCloudProcessingAllowed(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The report could not be processed.");
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file);
  }

  function reset() {
    setReport(null);
    setStructuredReport(null);
    setReviewFinalized(false);
    setSelectedFile(null);
    setCloudProcessingAllowed(false);
    setPrivacyReviewed(false);
    setCloudPages([]);
    setError(null);
    setIsDemo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function createStructuredReport() {
    if (!selectedFile || !cloudProcessingAllowed || !privacyReviewed || !cloudPages.some((page) => page.text.trim())) return;
    setError(null);
    setIsStructuring(true);
    try {
      setStructuredReport(await structureReport(selectedFile, cloudPages));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Structured extraction could not be completed.");
    } finally {
      setIsStructuring(false);
    }
  }

  if (structuredReport) {
    if (reviewFinalized) {
      return <ReportDashboard report={{ ...structuredReport, results: confirmedResults(structuredReport.results) }} onReview={() => setReviewFinalized(false)} onReset={reset} isDemo={isDemo} />;
    }
    return <div data-workspace-full className="lg:col-span-2">{isDemo && <p className="mb-5 border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">Synthetic demo: these are pre-authored sample results, not AI extraction. Review them to explore the dashboard. No report is sent to a provider.</p>}<ReportReview report={structuredReport} onBack={isDemo ? reset : () => setStructuredReport(null)} onComplete={(results) => { setStructuredReport({ ...structuredReport, results, requires_review: false }); setReviewFinalized(true); }} /></div>;
  }

  if (report) {
    return (
      <section className="w-full overflow-hidden border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-teal-700" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900">{report.filename}</p>
              <p className="text-xs text-zinc-500">{report.page_count} {report.page_count === 1 ? "page" : "pages"} extracted</p>
            </div>
          </div>
          <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-2 border border-zinc-300 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50">
            <RotateCcw className="size-3.5" /> New report
          </button>
        </div>
        {report.warnings.length > 0 && <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900">{report.warnings.join(" ")}</div>}
        <div className="max-h-[560px] space-y-4 overflow-y-auto bg-zinc-50 p-4">
          {report.pages.map((page) => (
            <article key={page.page_number} className="border border-zinc-200 bg-white">
              <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-500"><FileText className="size-3.5" /> Page {page.page_number}{page.needs_review && <span className="border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">OCR - verify text</span>}</div>
              <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-zinc-700">{page.text || "No selectable text found on this page."}</pre>
            </article>
          ))}
        </div>
        <div className="border-t border-zinc-200 p-5">
          <section aria-label="Cloud text privacy preview" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-bold text-amber-950">Review the exact report text intended for Gemini</h2>
            <p className="mt-2 text-xs leading-5 text-amber-950">The original extraction above stays in this local workflow. Automatic rules removed {report.privacy_removed_lines} labeled identity/contact lines below. They can miss unlabeled names, addresses, IDs, and OCR mistakes. Delete any remaining identifiers; do not change lab values. The filename is not included in the extraction prompt.</p>
            <div className="mt-3 space-y-3">{cloudPages.map((page, index) => <label key={page.page_number} className="block text-xs font-semibold text-amber-950">Cloud text / page {page.page_number}<textarea value={page.text} disabled={isStructuring} onChange={(event) => { setCloudPages((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item)); setPrivacyReviewed(false); }} rows={7} className="mt-2 block w-full resize-y rounded-lg border border-amber-300 bg-white p-3 font-mono text-xs font-normal leading-5 text-zinc-800" /></label>)}</div>
            <label className="mt-3 flex items-start gap-3 text-xs leading-5 text-amber-950"><input type="checkbox" checked={privacyReviewed} disabled={isStructuring} onChange={(event) => setPrivacyReviewed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-teal-700" /><span>I reviewed every cloud-text page and removed names and other identifiers. This is not a guarantee of automated de-identification.</span></label>
          </section>
          <label className="flex items-start gap-3 text-sm text-zinc-700">
            <input type="checkbox" checked={cloudProcessingAllowed} onChange={(event) => setCloudProcessingAllowed(event.target.checked)} className="mt-0.5 size-4 accent-teal-700" />
            <span>I confirm this report is synthetic or properly de-identified and may be sent to the configured AI provider.</span>
          </label>
          <button type="button" disabled={!cloudProcessingAllowed || !privacyReviewed || !cloudPages.some((page) => page.text.trim()) || isStructuring} onClick={() => void createStructuredReport()} className="mt-4 inline-flex h-11 items-center gap-2 bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40">{isStructuring && <LoaderCircle className="size-4 animate-spin" />}{isStructuring ? "Structuring results..." : "Create review table"}</button>
          {error && <div role="alert" className="mt-4 flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full border border-zinc-200 bg-white p-5">
      {DEMO_ONLY ? <div className="bg-teal-50 p-6"><h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Explore a lab report, safely.</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">This public demo uses synthetic sample data only. Uploads and cloud AI processing are unavailable in this deployment.</p></div> :
      <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`grid min-h-72 place-items-center border border-dashed px-6 py-10 text-center ${isDragging ? "border-teal-700 bg-teal-50" : "border-zinc-300 bg-zinc-50"}`}>
        <div>
          <span className="mx-auto grid size-14 place-items-center bg-teal-50 text-teal-700">{isProcessing ? <LoaderCircle className="size-6 animate-spin" /> : <Upload className="size-6" />}</span>
          <h2 className="mt-5 text-xl font-semibold text-zinc-900">{isProcessing ? "Extracting report" : "Drop your PDF report here"}</h2>
          <p className="mt-2 text-sm text-zinc-500">Text-based PDF, up to 10 MB</p>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" disabled={isProcessing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); }} className="sr-only" aria-label="Choose PDF report" />
          <button type="button" disabled={isProcessing} onClick={() => inputRef.current?.click()} className="mt-6 inline-flex h-11 items-center gap-2 bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-wait disabled:opacity-60"><FileText className="size-4" />{isProcessing ? "Processing..." : "Choose PDF"}</button>
        </div>
      </div>}
      {error && <div role="alert" className="mt-4 flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
      <div className="mt-5 border-t border-[var(--line)] pt-5">
        <button type="button" disabled={isProcessing} onClick={() => { setError(null); setIsDemo(true); setStructuredReport(createDemoReport()); }} className="w-full border border-teal-700 px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40">Explore a synthetic demo</button>
        <p className="mt-2 text-center text-xs leading-5 text-[var(--muted)]">No upload or API key needed. The demo uses authored sample data; AI chat is disabled.</p>
      </div>
    </section>
  );
}