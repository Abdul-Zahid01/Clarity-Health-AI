"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, LoaderCircle, Send, ShieldAlert, X } from "lucide-react";

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

export function ResultDetailPanel({ result, language, onClose }: { result: LabResult; language: Language; onClose: () => void }) {
  const education = getResultEducation(result.name, result.category);
  const [translatedEducation, setTranslatedEducation] = useState<{ language: Language; content: typeof education } | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(resultSuggestions[language](result.name));
  const [safetyNote, setSafetyNote] = useState("Educational information only — not a diagnosis or treatment recommendation.");
  const [error, setError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [references, setReferences] = useState<ReferenceLink[]>(researchReferences(result));
  const conversationEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (messages.length > 0) {
      conversationEnd.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    if (language !== "en") {
      void translateTexts([education.overview, education.purpose, education.outsideRange], language).then(([overview, purpose, outsideRange]) => {
        if (!cancelled) setTranslatedEducation({ language, content: { ...education, overview, purpose, outsideRange } });
      }).catch(() => undefined);
    }
    return () => { cancelled = true; };
  }, [education, language]);
  const displayedEducation = translatedEducation?.language === language ? translatedEducation.content : education;

  async function submitQuestion(event?: FormEvent, suggestedQuestion?: string) {
    event?.preventDefault();
    const nextQuestion = (suggestedQuestion ?? question).trim();
    if (!nextQuestion || isAsking) return;
    const history = messages;
    setMessages((current) => [...current, { role: "user", content: nextQuestion }]);
    setQuestion("");
    setError(null);
    setIsAsking(true);
    try {
      const response = await askAboutResult(result, nextQuestion, history, language);
      setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
      setSafetyNote(response.safety_note);
      setSuggestions(response.suggested_questions);
      setReferences(response.references);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer right now.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside dir={languageDirection(language)} role="dialog" aria-modal="true" aria-labelledby="result-detail-title" className="h-full w-full overflow-y-auto bg-[var(--background)] shadow-2xl sm:max-w-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-white/95 px-5 py-4 backdrop-blur">
          <div><p className="text-xs font-bold uppercase text-[var(--teal)]">Learn about this result</p><h2 id="result-detail-title" className="font-display mt-1 text-2xl font-semibold text-[var(--ink)]">{result.name}</h2></div>
          <button type="button" onClick={onClose} title="Close result details" className="grid size-10 place-items-center border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"><X className="size-5" /><span className="sr-only">Close result details</span></button>
        </div>

        <div className="p-5 sm:p-7">
          <div className="overflow-hidden border border-[var(--line)] bg-white">
            <Image src={education.image} alt={education.imageAlt} width={1200} height={676} className="aspect-[1200/676] h-auto w-full object-cover" />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <section><h3 className="text-sm font-bold text-[var(--ink)]">{translate(language, "whatItIs")}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{displayedEducation.overview}</p></section>
            <section><h3 className="text-sm font-bold text-[var(--ink)]">{translate(language, "whyChecked")}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{displayedEducation.purpose}</p></section>
            <section className="sm:col-span-2"><h3 className="text-sm font-bold text-[var(--ink)]">{translate(language, "outsideMeaning")}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{displayedEducation.outsideRange}</p></section>
          </div>

          <div className="mt-6 border-l-4 border-teal-700 bg-white px-4 py-3 text-sm text-zinc-700"><strong>Your confirmed result:</strong> {result.value_numeric ?? result.value_text} {result.unit ?? ""} · {rangePosition(result)} the listed range{result.reference_min !== null && result.reference_max !== null ? ` of ${result.reference_min}–${result.reference_max} ${result.unit ?? ""}` : ""}.</div>

          <section className="mt-8 border-t border-[var(--line)] pt-6">
            <div className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-[var(--ink)] text-white"><Bot className="size-4" /></span><div><h3 className="font-display text-xl font-semibold text-[var(--ink)]">Ask about {result.name}</h3><p className="text-xs text-[var(--muted)]">Gemini answers using this confirmed result and your question.</p></div></div>

            <div aria-live="polite" className="mt-5 max-h-80 space-y-3 overflow-y-auto">
              {messages.length === 0 && <p className="border border-dashed border-zinc-300 bg-white px-4 py-5 text-sm text-zinc-500">Choose a suggested question or ask in your own words.</p>}
              {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[90%] px-4 py-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-[var(--ink)] text-white" : "border border-zinc-200 bg-white text-zinc-700"}`}>{message.content}</div>)}
              {isAsking && <div className="inline-flex items-center gap-2 border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" />Preparing a plain-language answer…</div>}
              <div ref={conversationEnd} />
            </div>

            {error && <p role="alert" className="mt-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void submitQuestion(undefined, suggestion)} className="border border-zinc-300 bg-white px-3 py-2 text-left text-xs font-semibold text-zinc-700 hover:border-teal-700">{suggestion}</button>)}</div>

            <form onSubmit={(event) => void submitQuestion(event)} className="mt-4 flex gap-2"><label className="sr-only" htmlFor="result-question">Ask a question</label><textarea id="result-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask what this test means, what can affect it, or what to discuss with a clinician…" rows={2} maxLength={1000} className="min-h-16 flex-1 resize-none border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700" /><button type="submit" disabled={!question.trim() || isAsking} title="Send question" className="grid w-12 place-items-center bg-[var(--ink)] text-white hover:bg-teal-700 disabled:opacity-40"><Send className="size-4" /><span className="sr-only">Send question</span></button></form>
            {references.length > 0 && <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">{references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-semibold text-teal-700 hover:underline"><ExternalLink className="size-3.5" />{reference.source}: {reference.title}</a>)}</div>}
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-zinc-500"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" />{safetyNote || translate(language, "educationalOnly")}</p>
          </section>
        </div>
      </aside>
    </div>
  );
}