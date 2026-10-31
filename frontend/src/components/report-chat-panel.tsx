"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, FileCheck2, LoaderCircle, Maximize2, Minimize2, Send, ShieldAlert, X } from "lucide-react";

import { askAboutReport, askRagAssistant } from "@/lib/api";
import { RagVoiceControls } from "@/components/rag-voice-controls";
import { languageDirection, translate } from "@/lib/ui-language";
import type { ChatMessage, LabResult, Language, RagAnswer, RagSource, ReferenceLink, ReportAnswer } from "@/types/report";

type AssistantMode = "report" | "rag";
type DisplayMessage = ChatMessage & { citedResultNames?: string[]; references?: ReferenceLink[]; sources?: RagSource[] };
type AssistantState = {
  messages: DisplayMessage[];
  suggestions: string[];
  safetyNote: string;
  error: string | null;
};

const initialSuggestions: Record<Language, string[]> = {
  en: ["What stands out in my report?", "How do these results relate to each other?", "What questions should I ask a clinician?"],
  es: ["¿Qué destaca en mi informe?", "¿Cómo se relacionan estos resultados?", "¿Qué debería preguntarle a un médico?"],
  ar: ["ما أبرز ما في تقريري؟", "كيف ترتبط هذه النتائج ببعضها؟", "ما الأسئلة التي أطرحها على الطبيب؟"],
  te: ["నా నివేదికలో ముఖ్యంగా ఏముంది?", "ఈ ఫలితాలు ఒకదానితో ఒకటి ఎలా సంబంధించాయి?", "వైద్యుడిని ఏ ప్రశ్నలు అడగాలి?"],
};

export function ReportChatPanel({ results, language, onClose }: { results: LabResult[]; language: Language; onClose: () => void }) {
  const outsideRange = results.filter((result) => result.calculated_status === "high" || result.calculated_status === "low").length;
  const [questions, setQuestions] = useState<Record<AssistantMode, string>>({ report: "", rag: "" });
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("report");
  const [assistantStates, setAssistantStates] = useState<Record<AssistantMode, AssistantState>>({
    report: {
      messages: [],
      suggestions: initialSuggestions[language],
      safetyNote: "Educational information only — this assistant cannot diagnose or recommend treatment.",
      error: null,
    },
    rag: {
      messages: [],
      suggestions: initialSuggestions[language],
      safetyNote: "Grounded educational information only — not a diagnosis or treatment recommendation.",
      error: null,
    },
  });
  const [isAsking, setIsAsking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const conversation = useRef<HTMLDivElement>(null);
  const activeState = assistantStates[assistantMode];
  const latestAnswer = [...activeState.messages].reverse().find((message) => message.role === "assistant")?.content;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const element = conversation.current;
    if (element && activeState.messages.length > 0) element.scrollTo({ top: element.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [activeState.messages]);

  function evidenceFor(answer: ReportAnswer) {
    return answer.cited_result_names.map((name) => {
      const result = results.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
      return result ? `${result.name} · page ${result.source_page}` : name;
    });
  }

  function sourcesFor(answer: RagAnswer) {
    return answer.sources.filter((source, index, sources) => (
      sources.findIndex((candidate) => candidate.source_id === source.source_id) === index
    ));
  }

  function updateAssistantState(mode: AssistantMode, update: Partial<AssistantState>) {
    setAssistantStates((current) => ({
      ...current,
      [mode]: { ...current[mode], ...update },
    }));
  }

  function appendMessage(mode: AssistantMode, message: DisplayMessage) {
    setAssistantStates((current) => ({
      ...current,
      [mode]: { ...current[mode], messages: [...current[mode].messages, message] },
    }));
  }

  async function submitQuestion(event?: FormEvent, suggestedQuestion?: string) {
    event?.preventDefault();
    const mode = assistantMode;
    const nextQuestion = (suggestedQuestion ?? questions[mode]).trim();
    if (!nextQuestion || isAsking || voiceListening) return;
    const history = assistantStates[mode].messages.map(({ role, content }) => ({ role, content }));
    updateAssistantState(mode, {
      messages: [...assistantStates[mode].messages, { role: "user", content: nextQuestion }],
      error: null,
    });
    setQuestions((current) => ({ ...current, [mode]: "" }));
    setIsAsking(true);
    try {
      if (mode === "report") {
        const response = await askAboutReport(results, nextQuestion, history, language);
        appendMessage(mode, { role: "assistant", content: response.answer, citedResultNames: evidenceFor(response), references: response.references });
        updateAssistantState(mode, {
          suggestions: response.suggested_questions,
          safetyNote: response.safety_note,
        });
      } else {
        const response = await askRagAssistant(results, nextQuestion, history, language);
        appendMessage(mode, { role: "assistant", content: response.answer, sources: sourcesFor(response) });
        updateAssistantState(mode, {
          suggestions: response.suggested_questions,
          safetyNote: response.safety_note,
        });
      }
    } catch (requestError) {
      updateAssistantState(mode, {
        error: requestError instanceof Error ? requestError.message : "The assistant could not answer right now.",
      });
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-50 flex justify-end ${isFullscreen ? "bg-[var(--background)]" : "pointer-events-none bg-transparent"}`} role="presentation">
      <aside dir={languageDirection(language)} role="dialog" aria-modal="false" aria-labelledby="report-chat-title" className={`report-chat pointer-events-auto flex min-h-0 min-w-0 flex-col overflow-hidden border border-[var(--line)] bg-[var(--background)] shadow-2xl ${isFullscreen ? "h-dvh w-full" : "absolute bottom-2 end-2 h-[min(760px,calc(100dvh-1rem))] w-[min(460px,calc(100%_-_1rem))] rounded-2xl sm:bottom-4 sm:end-4 sm:h-[min(760px,calc(100dvh-2rem))] sm:w-[min(460px,calc(100%_-_2rem))]"}`}>
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-white"><Bot className="size-5" /></span><div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-wide text-[var(--teal)]">{assistantMode === "report" ? translate(language, "reportAssistant") : "RAG assistant"}</p><h2 id="report-chat-title" className="font-display text-xl font-semibold text-[var(--ink)]">{translate(language, "askClarity")}</h2></div></div>
          <div className="flex gap-1"><button type="button" onClick={() => setIsFullscreen((current) => !current)} title={isFullscreen ? "Restore chat size" : "Open chat full screen"} className="grid size-10 place-items-center border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50">{isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}<span className="sr-only">{isFullscreen ? "Restore chat size" : "Open chat full screen"}</span></button><button type="button" onClick={onClose} title="Close report assistant" className="grid size-10 place-items-center border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"><X className="size-5" /><span className="sr-only">Close report assistant</span></button></div>
        </header>

        <div className="shrink-0 border-b border-[var(--line)] bg-white px-4 py-2">
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1" role="group" aria-label="Choose chatbot">
            <button type="button" disabled={isAsking} aria-pressed={assistantMode === "report"} onClick={() => setAssistantMode("report")} className={`rounded-lg px-2 py-2 text-xs font-semibold disabled:opacity-60 ${assistantMode === "report" ? "bg-[var(--ink)] text-white" : "text-zinc-600 hover:bg-zinc-200"}`}>My report</button>
            <button type="button" disabled={isAsking} aria-pressed={assistantMode === "rag"} onClick={() => setAssistantMode("rag")} className={`rounded-lg px-2 py-2 text-xs font-semibold disabled:opacity-60 ${assistantMode === "rag" ? "bg-teal-700 text-white" : "text-zinc-600 hover:bg-zinc-200"}`}>Research / RAG</button>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-600"><FileCheck2 className="size-3.5 shrink-0 text-teal-700" /><strong>{results.length} {translate(language, "confirmedResults")}</strong><span>· {outsideRange} {translate(language, "outsideListed")}</span></div>
        </div>

        <div ref={conversation} aria-label="Conversation" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable]">
          <div className="mx-auto max-w-3xl space-y-4">
          {activeState.messages.length === 0 && <div className="border border-dashed border-zinc-300 bg-white px-4 py-5"><p className="text-sm leading-6 text-zinc-700">{translate(language, "reportIntro")}</p></div>}
          {activeState.messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`w-fit max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] ${message.role === "user" ? "ms-auto rounded-se-sm bg-[var(--ink)] text-white" : "rounded-ss-sm border border-zinc-200 bg-white text-zinc-700"}`}>
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.citedResultNames && message.citedResultNames.length > 0 && <div className="mt-3 flex flex-wrap gap-1 border-t border-zinc-100 pt-3">{message.citedResultNames.map((citation) => <span key={citation} className="bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800">{citation}</span>)}</div>}
              {message.references && message.references.length > 0 && <div className="mt-3 space-y-1">{message.references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"><ExternalLink className="size-3" />{reference.source}: {reference.title}</a>)}</div>}
              {message.sources && message.sources.length > 0 && <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3"><p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">Grounded sources</p>{message.sources.map((source) => <div key={source.source_id} className="bg-teal-50 px-2 py-2 text-[11px] leading-4 text-teal-900"><strong>{source.source_type === "report" ? `${source.title} · report page ${source.page}` : source.title}</strong><p className="mt-1">&quot;{source.excerpt}&quot;</p></div>)}</div>}
            </div>
          ))}
          {isAsking && <div className="inline-flex items-center gap-2 border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />Reviewing confirmed results…</div>}
          {!isAsking && activeState.suggestions.length > 0 && <details open={activeState.messages.length === 0} className="rounded-xl border border-[var(--line)] bg-white p-3"><summary className="cursor-pointer text-xs font-semibold text-teal-800">Suggested questions</summary><div className="mt-3 grid gap-2">{activeState.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void submitQuestion(undefined, suggestion)} className="rounded-lg border border-zinc-200 px-3 py-2 text-start text-xs leading-5 text-zinc-700 hover:border-teal-700 [overflow-wrap:anywhere]">{suggestion}</button>)}</div></details>}
          <details className="text-xs leading-5 text-zinc-500"><summary className="cursor-pointer">Educational limits</summary><p className="mt-2 [overflow-wrap:anywhere]">{activeState.safetyNote}</p></details>
          {activeState.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 [overflow-wrap:anywhere]">{activeState.error}</p>}
          {assistantMode === "rag" && <RagVoiceControls key={language} language={language} draft={questions.rag} onDraftChange={(text) => setQuestions((current) => ({ ...current, rag: text }))} answer={latestAnswer ? `${latestAnswer}\n${activeState.safetyNote}` : ""} busy={isAsking} onListeningChange={setVoiceListening} />}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--line)] bg-white p-3">
          <form onSubmit={(event) => void submitQuestion(event)} className="mx-auto flex max-w-3xl items-end gap-2"><label htmlFor="report-question" className="sr-only">Ask about your confirmed report</label><textarea id="report-question" value={questions[assistantMode]} disabled={voiceListening} onChange={(event) => setQuestions((current) => ({ ...current, [assistantMode]: event.target.value }))} placeholder="Ask about your confirmed results…" rows={2} maxLength={1000} className="min-h-16 min-w-0 flex-1 resize-none rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-teal-700 disabled:bg-zinc-50" /><button type="submit" disabled={!questions[assistantMode].trim() || isAsking || voiceListening} title="Send report question" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-white hover:bg-teal-700 disabled:opacity-40"><Send className="size-4" /><span className="sr-only">Send report question</span></button></form>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-zinc-500"><ShieldAlert className="size-3 shrink-0" />Education only. Not a diagnosis or treatment advice.</p>
        </div>
      </aside>
    </div>
  );
}