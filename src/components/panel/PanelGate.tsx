"use client";

/*
 * Ekrany pomocnicze panelu przy pracy z API: wczytywanie, błąd, pusta lista
 * i okno tokenu. Używają tych samych klas co reszta panelu (panel.css).
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { PanelMode } from "./usePanelOffers";

export function PanelState({
  mode,
  error,
  onRetry,
  onNew,
  children,
}: {
  mode: PanelMode;
  error: string;
  onRetry: () => void;
  onNew: () => void;
  children?: ReactNode;
}) {
  // „Wczytywanie…” dopiero po chwili – szybkie wczytanie (albo okno logowania) bez mignięcia napisu.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (mode !== "loading") return setSlow(false);
    const t = setTimeout(() => setSlow(true), 700);
    return () => clearTimeout(t);
  }, [mode]);
  const [title, desc] =
    mode === "loading"
      ? ["Wczytywanie ofert…", "Chwilka, pobieramy oferty z serwera."]
      : mode === "auth"
        ? ["Panel wymaga logowania", "Wpisz kod dostępu, żeby zobaczyć oferty."]
        : mode === "error"
          ? ["Nie udało się wczytać ofert", error || "Spróbuj ponownie za chwilę."]
          : ["Nie ma jeszcze ofert", "Dodaj pierwszą ofertę, a pojawi się tutaj."];

  return (
    <div className="pnl" data-view="list">
      <header className="top">
        <div className="logo">
          <span className="logo-mark" aria-hidden>
            SK
          </span>
          Studio Kuchnie
        </div>
        <span className="grow" />
        {mode === "api" || mode === "local" ? (
          <button type="button" className="btn btn-ink" onClick={onNew}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span>Nowa</span>
          </button>
        ) : null}
      </header>
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: 24, visibility: mode === "loading" && !slow ? "hidden" : undefined }}>
        <div className="surface" role="status" aria-live="polite" style={{ padding: "28px 32px", maxWidth: 440, textAlign: "center" }}>
          <h2 style={{ fontSize: 15, marginBottom: 6 }}>{title}</h2>
          <p className="faint" style={{ margin: 0 }}>
            {desc}
          </p>
          {mode === "error" ? (
            <button type="button" className="btn btn-ghost" style={{ marginTop: 16 }} onClick={onRetry}>
              Spróbuj ponownie
            </button>
          ) : null}
          {mode === "api" || mode === "local" ? (
            <button type="button" className="btn btn-ink" style={{ marginTop: 16 }} onClick={onNew}>
              Dodaj ofertę
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function TokenDialog({ error, onSubmit }: { error: string; onSubmit: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [local, setLocal] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    ref.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setLocal("Wpisz kod dostępu.");
      return;
    }
    onSubmit(value);
  };

  return (
    <div className="overlay" data-open={open ? "" : undefined}>
      <div className="backdrop" />
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="token-title" onSubmit={submit} noValidate>
        <div className="m-pad">
          <div className="m-top">
            <h2 id="token-title" style={{ fontSize: 15 }}>
              Logowanie do panelu
            </h2>
          </div>
          <div className="field">
            <label htmlFor="t-token">Kod dostępu</label>
            <input
              id="t-token"
              ref={ref}
              className="input"
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setLocal("");
              }}
            />
          </div>
          <p className="faint" style={{ margin: 0, fontSize: 12 }}>
            Wpisujesz go raz – zostaje zapamiętany w tej przeglądarce.
          </p>
          {local || error ? <p className="err">{local || error}</p> : null}
        </div>
        <div className="m-foot">
          <button type="submit" className="btn btn-ink">
            Zaloguj
          </button>
        </div>
      </form>
    </div>
  );
}
