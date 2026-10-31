"use client";

import { useEffect, useRef, useState } from "react";

export function useAssistantRequest() {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => () => { active.current?.abort(); }, []);
  function begin() {
    if (active.current) return null;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setNotice("");
    return controller;
  }
  function finish(controller: AbortController) {
    if (active.current !== controller) return;
    active.current = null;
    setBusy(false);
  }
  function cancel() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setNotice("Request stopped. No late answer will be added. Processing already started on the server may still finish.");
  }
  return { busy, notice, begin, finish, cancel };
}
