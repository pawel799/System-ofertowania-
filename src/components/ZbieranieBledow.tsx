"use client";

/*
 * Błędy JavaScript z przeglądarek do podglądu w panelu administratora (functions/api/bledy.ts).
 * Wysyłamy tylko komunikat, stos i ścieżkę strony (bez ?query i #hash – tam bywają tokeny i projekty klientów).
 * Najwyżej 5 różnych błędów na wejście; pomijamy szum (rozszerzenia przeglądarki, „Script error.”, ResizeObserver).
 */
import { useEffect } from "react";

const SZUM = [/^Script error\.?$/i, /ResizeObserver loop/i, /chrome-extension:|moz-extension:|safari-extension:/i, /Non-Error promise rejection captured/i];

export default function ZbieranieBledow() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const wyslane = new Set<string>();
    const wyslij = (msg: string, stack: string) => {
      if (!msg || SZUM.some((re) => re.test(msg) || re.test(stack)) || wyslane.has(msg) || wyslane.size >= 5) return;
      wyslane.add(msg);
      try {
        void fetch("/api/bledy", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ msg: msg.slice(0, 300), stack: stack.slice(0, 2000), sciezka: window.location.pathname }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* bez zgłoszenia */
      }
    };
    const onError = (e: ErrorEvent) => wyslij(e.message || String(e.error ?? ""), e.error instanceof Error ? (e.error.stack ?? "") : `${e.filename}:${e.lineno}:${e.colno}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      wyslij(r instanceof Error ? r.message : typeof r === "string" ? r : "", r instanceof Error ? (r.stack ?? "") : "");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
