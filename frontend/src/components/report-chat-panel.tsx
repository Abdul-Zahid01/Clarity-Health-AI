"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, FileCheck2, LoaderCircle, Maximize2, Minimize2, Send, ShieldAlert, X } from "lucide-react";

import { askAboutReport, askRagAssistant } from "@/lib/api";
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
  const conversationEnd = useRef<HTMLDivElement>(null);
  const activeState = assistantStates[assistantMode];

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (activeState.messages.length > 0) conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
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
    if (!nextQuestion || isAsking) return;
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
      <aside dir={languageDirection(language)} role="dialog" aria-modal="false" aria-labelledby="report-chat-title" style={isFullscreen ? { width: "100vw", height: "100vh" } : undefined} className={`pointer-events-auto flex flex-col border border-[var(--line)] bg-[var(--background)] shadow-2xl transition-all ${isFullscreen ? "h-full w-full" : "absolute bottom-4 right-4 h-[min(680px,calc(100vh-2rem))] w-[min(440px,calc(100vw-2rem))]"}`}>
        <header className="flex items-center justify-between border-b border-[var(--line)] bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center bg-[var(--ink)] text-white"><Bot className="size-5" /></span><div><p className="text-xs font-bold uppercase text-[var(--teal)]">{assistantMode === "report" ? translate(language, "reportAssistant") : "RAG assistant"}</p><h2 id="report-chat-title" className="font-display text-2xl font-semibold text-[var(--ink)]">{translate(language, "askClarity")}</h2></div></div>
          <div className="flex gap-1"><button type="button" onClick={() => setIsFullscreen((current) => !current)} title={isFullscreen ? "Restore chat size" : "Open chat full screen"} className="grid size-10 place-items-center border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50">{isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}<span className="sr-only">{isFullscreen ? "Restore chat size" : "Open chat full screen"}</span></button><button type="button" onClick={onClose} title="Close report assistant" className="grid size-10 place-items-center border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"><X className="size-5" /><span className="sr-only">Close report assistant</span></button></div>
        </header>

        <div className="border-b border-[var(--line)] bg-white px-5 py-3">
          <div className="mb-3 grid grid-cols-2 border border-zinc-300 p-1" role="group" aria-label="Choose chatbot">
            <button type="button" aria-pressed={assistantMode === "report"} onClick={() => setAssistantMode("report")} className={`px-3 py-2 text-xs font-semibold ${assistantMode === "report" ? "bg-[var(--ink)] text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>My report assistant</button>
            <button type="button" aria-pressed={assistantMode === "rag"} onClick={() => setAssistantMode("rag")} className={`px-3 py-2 text-xs font-semibold ${assistantMode === "rag" ? "bg-teal-700 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>RAG assistant</button>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600"><FileCheck2 className="size-4 text-teal-700" /><strong>{results.length} {translate(language, "confirmedResults")}</strong><span>·</span><span>{outsideRange} {translate(language, "outsideListed")}</span></div>
        </div>

        <div aria-live="polite" className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {activeState.messages.length === 0 && <div className="border border-dashed border-zinc-300 bg-white px-4 py-5"><p className="text-sm leading-6 text-zinc-700">{translate(language, "reportIntro")}</p></div>}
          {activeState.messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-auto max-w-[90%] bg-[var(--ink)] px-4 py-3 text-sm leading-6 text-white" : "max-w-[95%] border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-700"}>
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.citedResultNames && message.citedResultNames.length > 0 && <div className="mt-3 flex flex-wrap gap-1 border-t border-zinc-100 pt-3">{message.citedResultNames.map((citation) => <span key={citation} className="bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800">{citation}</span>)}</div>}
              {message.references && message.references.length > 0 && <div className="mt-3 space-y-1">{message.references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"><ExternalLink className="size-3" />{reference.source}: {reference.title}</a>)}</div>}
              {message.sources && message.sources.length > 0 && <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3"><p className="text-[11px] font-bold uppercase tracking-wide text-teal-800">Grounded sources</p>{message.sources.map((source) => <div key={source.source_id} className="bg-teal-50 px-2 py-2 text-[11px] leading-4 text-teal-900"><strong>{source.source_type === "report" ? `${source.title} · report page ${source.page}` : source.title}</strong><p className="mt-1">&quot;{source.excerpt}&quot;</p></div>)}</div>}
            </div>
          ))}
          {isAsking && <div className="inline-flex items-center gap-2 border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />Reviewing confirmed results…</div>}
          <div ref={conversationEnd} />
        </div>

        <div className="border-t border-[var(--line)] bg-white p-5">
          {activeState.error && <p role="alert" className="mb-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{activeState.error}</p>}
          <div className="mb-3 flex flex-wrap gap-2">{activeState.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void submitQuestion(undefined, suggestion)} className="border border-zinc-300 px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:border-teal-700">{suggestion}</button>)}</div>
          <form onSubmit={(event) => void submitQuestion(event)} className="flex gap-2"><label htmlFor="report-question" className="sr-only">Ask about your confirmed report</label><textarea id="report-question" value={questions[assistantMode]} onChange={(event) => setQuestions((current) => ({ ...current, [assistantMode]: event.target.value }))} placeholder="Ask about patterns, individual values, or what to discuss with a clinician…" rows={3} maxLength={1000} className="min-h-20 flex-1 resize-none border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-teal-700" /><button type="submit" disabled={!questions[assistantMode].trim() || isAsking} title="Send report question" className="grid w-12 place-items-center bg-[var(--ink)] text-white hover:bg-teal-700 disabled:opacity-40"><Send className="size-4" /><span className="sr-only">Send report question</span></button></form>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-500"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" />{activeState.safetyNote}</p>
        </div>
      </aside>
    </div>
  );
}