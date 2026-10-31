import type { Language } from "../types/report";

export const speechLanguages: Record<Language, string> = { en: "en-US", es: "es-ES", ar: "ar-SA", te: "te-IN" };

export function speechErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "not-allowed": "Microphone permission was denied. Allow it in your browser settings, or keep typing.",
    "service-not-allowed": "Your browser blocked the speech service. Keep typing instead.",
    "audio-capture": "No microphone is available. Check your device and browser settings.",
    "no-speech": "No speech was detected. Try again, or type your question.",
    network: "The browser speech service could not connect. Keep typing or try again later.",
    "language-not-supported": "Speech recognition is unavailable for this language. Keep typing instead.",
    "synthesis-unavailable": "Read-aloud is unavailable on this device.",
  };
  return messages[code] ?? "Voice could not complete. Please try again or use text.";
}

export function speechChunks(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let chunk = "";
  for (const word of words) {
    if (chunk && chunk.length + word.length + 1 > 220) {
      chunks.push(chunk);
      chunk = "";
    }
    // Break unusually long tokens without losing text.
    let remaining = word;
    while (remaining.length > 220) {
      if (chunk) { chunks.push(chunk); chunk = ""; }
      chunks.push(remaining.slice(0, 220));
      remaining = remaining.slice(220);
    }
    chunk = [chunk, remaining].filter(Boolean).join(" ");
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
