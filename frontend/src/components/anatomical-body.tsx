"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, ScanLine } from "lucide-react";

import { bodyRegions, type ResultAnatomy } from "@/lib/result-anatomy";

const BodyScene = dynamic(() => import("@/components/body-atlas-scene").then((module) => module.BodyAtlasScene), {
  ssr: false,
  loading: () => <p role="status" className="atlas-message">Preparing the body atlas...</p>,
});

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function AtlasUnavailable() {
  return <div role="status" className="atlas-message"><ScanLine className="mx-auto mb-3 size-8 text-teal-700" /><p className="font-semibold">3D view unavailable</p><p className="mt-2 text-xs leading-5">Your browser could not load the 3D atlas. The related systems and explanation below remain available.</p></div>;
}

class AtlasBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("The educational body atlas could not render.", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? <AtlasUnavailable /> : this.props.children;
  }
}

export function AnatomicalBody({ anatomy }: { anatomy: ResultAnatomy }) {
  const container = useRef<HTMLDivElement>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resetVersion, setResetVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const pageVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => false);
  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => setContextLost(true), []);
  const animate = !paused && !reducedMotion && pageVisible && inView;

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setHasEntered(true);
    }, { rootMargin: "0px", threshold: 0.05 });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  function resetView() {
    setRotation(0);
    setResetVersion((version) => version + 1);
  }

  return (
    <div className="body-atlas" role="region" aria-label="Educational body atlas">
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-white/80 px-4 py-3">
        <div className="flex items-center gap-2"><ScanLine className="size-4 text-teal-700" /><span className="text-[11px] font-bold uppercase tracking-widest text-teal-800">Body atlas</span></div>
        <span className="text-[10px] text-[var(--muted)]">{reducedMotion ? "Reduced motion" : animate ? "Live view" : "Motion paused"}</span>
      </div>
      <div ref={container} className="atlas-viewport" aria-label={`Illustrative body systems: ${anatomy.regions.map((region) => bodyRegions[region].label).join(", ") || "none selected"}`}>
        <div aria-hidden="true" className="atlas-orbit atlas-orbit-outer" />
        <div aria-hidden="true" className="atlas-orbit atlas-orbit-inner" />
        <span className="pointer-events-none absolute start-4 top-4 text-[9px] font-semibold uppercase tracking-[0.2em] text-teal-800/65">Schematic / 3D</span>
        <span className="pointer-events-none absolute bottom-4 end-4 text-[9px] uppercase tracking-widest text-[var(--muted)]">Illustrative, not diagnostic</span>
        <AtlasBoundary onError={onContextLost}>
          {contextLost ? <AtlasUnavailable /> : hasEntered ? <BodyScene anatomy={anatomy} animate={animate} rotation={rotation} resetVersion={resetVersion} onReady={onReady} onContextLost={onContextLost} /> : <p role="status" className="atlas-message">Body atlas loads when in view.</p>}
        </AtlasBoundary>
        {hasEntered && !ready && !contextLost && <p className="pointer-events-none absolute bottom-12 inset-x-4 text-center text-xs text-teal-800">Loading the local anatomy model...</p>}
      </div>
      <div className="flex items-center justify-between gap-2 border-y border-[var(--line)] bg-white/85 px-3 py-2">
        <div className="flex gap-1">
          <button type="button" className="atlas-control" aria-label="Rotate body left" onClick={() => setRotation((value) => value - Math.PI / 6)}><ArrowLeft className="size-4" /></button>
          <button type="button" className="atlas-control" aria-label="Rotate body right" onClick={() => setRotation((value) => value + Math.PI / 6)}><ArrowRight className="size-4" /></button>
          <button type="button" className="atlas-control" aria-label="Reset body view" onClick={resetView}><RotateCcw className="size-4" /></button>
        </div>
        <button type="button" className="atlas-control gap-2 px-3 text-xs" aria-pressed={paused || reducedMotion} aria-label={paused ? "Play body animation" : "Pause body animation"} disabled={reducedMotion} onClick={() => setPaused((value) => !value)}>{paused || reducedMotion ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}{reducedMotion ? "Motion reduced" : paused ? "Play" : "Pause"}</button>
      </div>
      <div className="bg-white/85 p-4">
        <p className="font-display text-lg font-semibold text-[var(--ink)]">{anatomy.label}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{anatomy.explanation}</p>
        <ul aria-label="Related body systems" className="mt-3 flex flex-wrap gap-1.5">{anatomy.regions.map((region) => <li key={region} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-900"><span aria-hidden="true" className="me-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: bodyRegions[region].color }} />{bodyRegions[region].label}</li>)}</ul>
        <p className="mt-3 text-[10px] leading-4 text-[var(--muted)]">Natural-color schematic: red circulation, ivory bones, gold nerves. Related tissues brighten; other structures remain muted.</p>
        <p className="mt-3 text-[10px] leading-4 text-[var(--muted)]">Drag to explore, or use the rotation buttons. Highlights show educational relationships, not affected or diseased organs. Motion is illustrative, never a measured heartbeat.</p>
        <details className="mt-3 text-[10px] text-[var(--muted)]"><summary className="cursor-pointer">Anatomy model attribution</summary><p className="mt-1">Skin mesh: BodyParts3D, The Database Center for Life Science. <a className="underline" href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">Source</a> · <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Display normalized and recolored; internal shapes are schematic.</p></details>
      </div>
    </div>
  );
}
