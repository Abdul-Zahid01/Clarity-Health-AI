"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, Volume2 } from "lucide-react";

import { speechChunks, speechErrorMessage, speechLanguages } from "@/lib/voice";
import type { Language } from "@/types/report";

type RecognitionEvent = { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

const noSubscription = () => () => {};
function subscribeVoices(callback: () => void) {
  window.speechSynthesis?.addEventListener("voiceschanged", callback);
  return () => window.speechSynthesis?.removeEventListener("voiceschanged", callback);
}
function localVoiceSnapshot() {
  return window.speechSynthesis?.getVoices().filter((voice) => voice.localService).map((voice) => `${voice.lang}:${voice.name}`).join("|") ?? "";
}

export function RagVoiceControls({ language, draft, onDraftChange, answer, busy, onListeningChange }: {
  language: Language; draft: string; onDraftChange: (text: string) => void;
  answer: string; busy: boolean; onListeningChange: (listening: boolean) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = useSyncExternalStore(noSubscription, () => Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition) && window.isSecureContext, () => false);
  const localVoices = useSyncExternalStore(subscribeVoices, localVoiceSnapshot, () => "");
  const voice = localVoices ? window.speechSynthesis.getVoices().find((candidate) => candidate.localService && candidate.lang.split("-")[0] === language) : undefined;
  const onListeningRef = useRef(onListeningChange);
  useEffect(() => { onListeningRef.current = onListeningChange; }, [onListeningChange]);

  function stopSpeaking() {
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current = null;
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  function abortListening() {
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.onend = null;
      recognition.current.abort();
      recognition.current = null;
    }
    setListening(false);
    onListeningRef.current(false);
  }

  useEffect(() => {
    function release() {
      const currentRecognition = recognition.current;
      recognition.current = null;
      if (currentRecognition) {
        currentRecognition.onresult = null;
        currentRecognition.onerror = null;
        currentRecognition.onend = null;
        currentRecognition.abort();
      }
      if (utterance.current) {
        utterance.current.onend = null;
        utterance.current.onerror = null;
        utterance.current = null;
        window.speechSynthesis.cancel();
      }
      onListeningRef.current(false);
    }
    function visibilityChanged() {
      if (document.visibilityState === "hidden") {
        release();
        setListening(false);
        setSpeaking(false);
        setNotice("Voice stopped while this tab is hidden.");
      }
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => { document.removeEventListener("visibilitychange", visibilityChanged); release(); };
  }, []);

  function startListening() {
    const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Constructor || !consent || busy) return;
    stopSpeaking();
    setNotice("");
    const instance = new Constructor();
    recognition.current = instance;
    const originalDraft = draft.trim();
    instance.lang = speechLanguages[language];
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onresult = (event) => {
      const parts: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        if (event.results[index].isFinal) parts.push(event.results[index][0].transcript);
      }
      const text = [originalDraft, ...parts].filter(Boolean).join(" ").trim();
      if (text.length > 1000) {
        setNotice("The spoken draft exceeds 1,000 characters. Shorten your question and try again. Your original draft was kept.");
        return;
      }
      onDraftChange(text);
      setNotice("Transcript added to your draft. Check it, remove identifiers, then press Send.");
    };
    instance.onerror = (event) => {
      setNotice(speechErrorMessage(event.error));
      abortListening();
    };
    instance.onend = () => {
      recognition.current = null;
      setListening(false);
      onListeningRef.current(false);
    };
    try {
      instance.start();
      setListening(true);
      onListeningRef.current(true);
    } catch (error) {
      console.error("Browser speech recognition could not start.", error instanceof Error ? error.name : "UnknownError");
      abortListening();
      setNotice("Voice input could not start. Check microphone permissions, or keep typing.");
    }
  }

  function readAnswer() {
    if (!voice || !consent || !answer || busy) return;
    abortListening();
    stopSpeaking();
    const chunks = speechChunks(answer);
    setNotice("");
    setSpeaking(true);
    function next(index: number) {
      if (index >= chunks.length) { utterance.current = null; setSpeaking(false); return; }
      const speech = new SpeechSynthesisUtterance(chunks[index]);
      speech.voice = voice ?? null;
      speech.lang = speechLanguages[language];
      speech.rate = 0.95;
      speech.onend = () => next(index + 1);
      speech.onerror = () => { utterance.current = null; window.speechSynthesis.cancel(); setSpeaking(false); setNotice("Read-aloud failed. The complete answer is still available as text."); };
      utterance.current = speech;
      try { window.speechSynthesis.speak(speech); }
      catch (error) {
        console.error("Browser read-aloud could not start.", error instanceof Error ? error.name : "UnknownError");
        stopSpeaking();
        setNotice("Read-aloud could not start. Use the text answer instead.");
      }
    }
    next(0);
  }

  return <section aria-label="RAG voice options" className="mb-2 rounded-xl border border-teal-100 bg-teal-50/60 p-2.5">
    <details><summary className="cursor-pointer text-xs font-semibold text-teal-900">Voice options / {speechLanguages[language]}</summary>
      <p className="mt-2 text-[11px] leading-5 text-zinc-600">Optional browser dictation may send microphone audio to your browser&apos;s speech provider. Use only synthetic or de-identified speech. This app does not store audio. Read-aloud uses only a local device voice; never plays automatically.</p>
      <label className="mt-2 flex items-start gap-2 text-[11px] leading-5"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); if (!event.target.checked) { abortListening(); stopSpeaking(); } }} className="mt-1 accent-teal-700" />I understand and enable voice for this chat session.</label>
      {!supported && <p className="mt-2 text-[11px] text-amber-900">Dictation is unavailable here. Use a supported browser on HTTPS or localhost, or type instead.</p>}
      {!voice && <p className="mt-2 text-[11px] text-amber-900">No local read-aloud voice for this language. Install an operating-system voice or use text.</p>}
    </details>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={!consent || !supported || busy || speaking} onClick={() => { if (listening) { recognition.current?.stop(); } else startListening(); }} aria-pressed={listening} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-xs font-semibold text-teal-900 disabled:opacity-40">{listening ? <Square className="size-3" /> : <Mic className="size-3" />}{listening ? "Finish dictation" : "Dictate question"}</button>
      <button type="button" disabled={!consent || !voice || !answer || busy || listening} onClick={() => speaking ? stopSpeaking() : readAnswer()} aria-pressed={speaking} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-xs font-semibold text-teal-900 disabled:opacity-40">{speaking ? <Square className="size-3" /> : <Volume2 className="size-3" />}{speaking ? "Stop read-aloud" : "Read latest answer"}</button>
      {listening && <button type="button" onClick={abortListening} className="text-xs font-semibold text-zinc-700 underline">Cancel</button>}
    </div>
    <p role="status" className="mt-1 text-[11px] leading-4 text-zinc-600">{listening ? "Listening… finish or cancel. Nothing is sent to RAG until you press Send." : notice}</p>
  </section>;
}
