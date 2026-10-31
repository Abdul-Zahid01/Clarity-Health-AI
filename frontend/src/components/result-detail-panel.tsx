"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, LoaderCircle, Send, ShieldAlert, X } from "lucide-react";

import { ResultAnatomyIllustration } from "@/components/result-anatomy-illustration";
import { ResultProcessLesson } from "@/components/result-process-lesson";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useAssistantRequest } from "@/lib/use-assistant-request";
import { askAboutResult, translateTexts } from "@/lib/api";
import { getResultEducation } from "@/lib/result-education";
import { researchReferences } from "@/lib/research-references";
import { languageDirection, translate } from "@/lib/ui-language";
import type { ChatMessage, LabResult, Language, ReferenceLink } from "@/types/report";

function rangePosition(result: LabResult) {
  if (result.calculated_status === "normal") return "inside";
  if (result.calculated_status === "high") return "above";
  if (result.calculated_status === "low") return "below";
  return "not compared with";
}

const resultSuggestions: Record<Language, (name: string) => string[]> = {
  en: (name) => [`What does ${name} measure?`, "What can affect this result?", "What should I ask my doctor?"],
  es: (name) => [`¿Qué mide ${name}?`, "¿Qué puede afectar este resultado?", "¿Qué debería preguntarle a mi médico?"],
  ar: (name) => [`ماذا يقيس ${name}؟`, "ما الذي قد يؤثر في هذه النتيجة؟", "ماذا أسأل طبيبي؟"],
  te: (name) => [`${name} ఏమి కొలుస్తుంది?`, "ఈ ఫలితాన్ని ఏమి ప్రభావితం చేయవచ్చు?", "నా వైద్యుడిని ఏమి అడగాలి?"],
};

export function ResultDetailPanel({ result, language, onClose, allowAssistant = true }: { result: LabResult; language: Language; onClose: () => void; allowAssistant?: boolean }) {
  const education = getResultEducation(result.name, result.category);
  const [translatedEducation, setTranslatedEducation] = useState<{ language: Language; content: typeof education } | null>(null);
  const [translationFailure, setTranslationFailure] = useState<{ language: Language; message: string } | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(resultSuggestions[language](result.name));
  const [safetyNote, setSafetyNote] = useState("Educational information only — not a diagnosis or treatment recommendation.");
  const [error, setError] = useState<string | null>(null);
  const request = useAssistantRequest();
  const isAsking = request.busy;
  const [references, setReferences] = useState<ReferenceLink[]>(researchReferences(result));
  const conversationEnd = useRef<HTMLDivElement>(null);

  const dialog = useDialogFocus(onClose, true);

  useEffect(() => {
    if (messages.length > 0) {
      conversationEnd.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (language !== "en" && allowAssistant) {
      void translateTexts([education.overview, education.purpose, education.outsideRange], language, controller.signal).then(([overview, purpose, outsideRange]) => {
        if (!cancelled) setTranslatedEducation({ language, content: { ...education, overview, purpose, outsideRange } });
      }).catch((error: unknown) => {
        if (!cancelled) setTranslationFailure({ language, message: error instanceof Error ? error.message : "Translation is unavailable." });
      });
    }
    return () => { cancelled = true; controller.abort(); };
  }, [education, language, allowAssistant]);
  const displayedEducation = translatedEducation?.language === language ? translatedEducation.content : education;

  async function submitQuestion(event?: FormEvent, suggestedQuestion?: string) {
    event?.preventDefault();
    const nextQuestion = (suggestedQuestion ?? question).trim();
    if (!nextQuestion || isAsking || !allowAssistant) return;
    const controller = request.begin();
    if (!controller) return;
    const history = messages;
    setMessages((current) => [...current, { role: "user", content: nextQuestion }]);
    setQuestion(nextQuestion);
    setError(null);
    try {
      const response = await askAboutResult(result, nextQuestion, history, language, controller.signal);
      if (controller.signal.aborted) return;
      setQuestion("");
      setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
      setSafetyNote(response.safety_note);
      setSuggestions(response.suggested_questions);
      setReferences(response.references);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer right now.");
    } finally {
      request.finish(controller);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialog} tabIndex={-1} dir={languageDirection(language)} role="dialog" aria-modal="true" aria-labelledby="result-detail-title" className="h-dvh min-w-0 w-full overflow-y-auto bg-[var(--background)] shadow-2xl [overflow-wrap:anywhere] sm:max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0"><p className="text-xs font-bold uppercase text-[var(--teal)]">Learn about this result</p><h2 id="result-detail-title" className="font-display mt-1 text-xl font-semibold text-[var(--ink)] sm:text-2xl">{result.name}</h2></div>
          <button type="button" onClick={onClose} title="Close result details" className="grid size-10 shrink-0 place-items-center border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"><X className="size-5" /><span className="sr-only">Close result details</span></button>
        </div>

        <div className="p-5 sm:p-7">
          <ResultProcessLesson result={result} />
          {language !== "en" && <p className="mt-2 text-xs text-zinc-600" lang="en" dir="ltr">The process diagram and its teaching captions are currently in English.</p>}
          <details className="mt-4 rounded-xl border border-[var(--line)] bg-white"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-teal-800">Where is this in the body?</summary><ResultAnatomyIllustration result={result} /></details>
          <details className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-teal-800">Additional laboratory illustration</summary>
            <Image src={education.image} alt={education.imageAlt} width={1200} height={676} className="aspect-[1200/676] h-auto w-full object-contain" />
          </details>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {language !== "en" && (!allowAssistant || (translationFailure?.language === language && translatedEducation?.language !== language)) && <p role="status" className="border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 sm:col-span-2">{allowAssistant ? translationFailure?.message : "Cloud translation is disabled in the local demo."} Educational text is shown in English.</p>}
            <section><h3 className="text-sm font-bold text-[var(--ink)]">{translate(language, "whatItIs")}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{displayedEducation.overview}</p></section>
            <section><h3 className="text-sm font-bold text-[var(--ink)]">{translate(language, "whyChecked")}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{displayedEducation.purpose}</p></section>
            <section className="sm:col-span-2"><h3 className="text-sm font-bold text-[var(--ink)]">{translate(language, "outsideMeaning")}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{displayedEducation.outsideRange}</p></section>
          </div>

          <div className="mt-6 border-l-4 border-teal-700 bg-white px-4 py-3 text-sm text-zinc-700"><strong>Your confirmed result:</strong> {result.value_numeric ?? result.value_text} {result.unit ?? ""} · {rangePosition(result)} the listed range{result.reference_min !== null && result.reference_max !== null ? ` of ${result.reference_min}–${result.reference_max} ${result.unit ?? ""}` : ""}.</div>

          {!allowAssistant ? <p className="mt-6 border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">AI chat is disabled in this local demo. The full upload-and-AI workflow requires a separately configured private backend.</p> : <section className="mt-8 border-t border-[var(--line)] pt-6">
            <div className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-[var(--ink)] text-white"><Bot className="size-4" /></span><div><h3 className="font-display text-xl font-semibold text-[var(--ink)]">Ask about {result.name}</h3><p className="text-xs text-[var(--muted)]">Gemini answers using this confirmed result and your question.</p></div></div>

            <div aria-live="polite" className="mt-5 max-h-80 space-y-3 overflow-y-auto">
              {messages.length === 0 && <p className="border border-dashed border-zinc-300 bg-white px-4 py-5 text-sm text-zinc-500">Choose a suggested question or ask in your own words.</p>}
              {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[95%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] ${message.role === "user" ? "ms-auto bg-[var(--ink)] text-white" : "border border-zinc-200 bg-white text-zinc-700"}`}>{message.content}</div>)}
              {isAsking && <div className="inline-flex items-center gap-2 border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />Preparing a plain-language answer…</div>}
              <div ref={conversationEnd} />
            </div>

            {error && <p role="alert" className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            <details className="mt-4 rounded-xl border border-zinc-200 bg-white p-3" open={messages.length === 0}><summary className="cursor-pointer text-xs font-semibold text-teal-800">Suggested questions</summary><div className="mt-3 grid gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={isAsking} onClick={() => void submitQuestion(undefined, suggestion)} className="rounded-lg border border-zinc-200 px-3 py-2 text-start text-xs text-zinc-700 hover:border-teal-700 disabled:opacity-40 [overflow-wrap:anywhere]">{suggestion}</button>)}</div></details>

            {request.notice && <p role="status" className="mt-3 text-xs text-teal-900">{request.notice}</p>}
            <form onSubmit={(event) => void submitQuestion(event)} className="mt-4 flex gap-2"><label className="sr-only" htmlFor="result-question">Ask a question</label><textarea id="result-question" value={question} disabled={isAsking} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this test…" rows={2} maxLength={1000} className="min-h-16 min-w-0 flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700" />{isAsking ? <button key="stop" type="button" onClick={(event) => { event.preventDefault(); request.cancel(); }} className="rounded-xl border border-teal-700 px-3 text-xs font-semibold text-teal-900">Stop request</button> : <button key="send" type="submit" disabled={!question.trim()} title="Send question" className="grid w-12 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-white hover:bg-teal-700 disabled:opacity-40"><Send className="size-4" /><span className="sr-only">Send question</span></button>}</form>
            {references.length > 0 && <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">{references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-semibold text-teal-700 hover:underline"><ExternalLink className="size-3.5" />{reference.source}: {reference.title}</a>)}</div>}
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-500"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" />{safetyNote || translate(language, "educationalOnly")}</p>
          </section>}
        </div>
      </aside>
    </div>
  );
}