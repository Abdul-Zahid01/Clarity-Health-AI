"use client";

import { useEffect, useEffectEvent, useRef } from "react";

export function useDialogFocus(onClose: () => void, modal: boolean) {
  const ref = useRef<HTMLElement>(null);
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const fallback: HTMLElement = dialog;
    const previous = document.activeElement;
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]',
    )].filter((element) => element.getClientRects().length > 0);
    (focusable()[0] ?? dialog).focus({ preventScroll: true });
    const inertElements: Array<{ element: HTMLElement; previous: boolean }> = [];
    const overflow = document.body.style.overflow;
    if (modal) {
      document.body.style.overflow = "hidden";
      let branch: HTMLElement = dialog;
      while (branch.parentElement && branch !== document.body) {
        for (const sibling of branch.parentElement.children) {
          if (sibling instanceof HTMLElement && sibling !== branch) {
            inertElements.push({ element: sibling, previous: sibling.inert });
            sibling.inert = true;
          }
        }
        branch = branch.parentElement;
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && (modal || dialog?.contains(document.activeElement))) {
        event.preventDefault();
        close();
      }
      if (event.key !== "Tab" || !modal) return;
      const elements = focusable();
      const first = elements[0] ?? fallback;
      const last = elements.at(-1) ?? fallback;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      for (const { element, previous } of inertElements) element.inert = previous;
      if (modal) document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [modal]);
  return ref;
}
