"use client";

/*
 * Cloudflare Turnstile (anty-bot) w formularzach logowania i rejestracji.
 * Klucz witryny (publiczny) z NEXT_PUBLIC_TURNSTILE_SITE_KEY w czasie budowania – bez niego nic się nie
 * pokazuje, a serwer (bez TURNSTILE_SECRET_KEY) nie wymaga tokenu. Token sprawdza wyłącznie serwer.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TS = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TS;
  }
}

let loading: Promise<TS> | null = null;
function load(): Promise<TS> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? ok(window.turnstile) : fail(new Error("turnstile")));
    s.onerror = () => {
      loading = null;
      fail(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Zwraca [widżet, token, reset]. Bez klucza witryny: widżet = null, token = "" (formularz działa jak dotąd). */
export function useTurnstile(theme: "dark" | "light" = "dark") {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let alive = true;
    load()
      .then((ts) => {
        if (!alive || !box.current) return;
        id.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          language: "pl",
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [theme]);

  const reset = useCallback(() => {
    setToken("");
    if (id.current) window.turnstile?.reset(id.current);
  }, []);

  const widget = TURNSTILE_SITE_KEY ? <div ref={box} className="min-h-[65px]" data-testid="turnstile" /> : null;
  return [widget, token, reset] as const;
}
