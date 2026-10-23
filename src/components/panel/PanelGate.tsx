"use client";

/*
 * Ekrany pomocnicze panelu przy pracy z API: wczytywanie, błąd, pusta lista
 * i okno logowania (konto firmy albo kod administratora). Te same klasy co reszta panelu (panel.css).
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { PanelMode } from "./usePanelOffers";
import { initials, useBrand } from "@/lib/brand";
import { ApiError, authApi } from "./offerApi";
import { useMe } from "./AccountTabs";

/** Okres próbny / koniec opłaconego okresu w nagłówku panelu (link do Ustawienia → Plan). */
export function PlanNotice() {
  const [me] = useMe(true);
  const f = me?.firm;
  if (!f) return null;
  const until = f.status === "trial" ? f.trialEnds : f.paidUntil;
  if (!until) return null;
  const days = Math.ceil((Date.parse(until) - Date.now()) / 86400_000);
  if (f.status !== "trial" && days > 7) return null;
  const text =
    days < 0
      ? f.status === "trial"
        ? "Okres próbny minął"
        : "Plan wygasł"
      : f.status === "trial"
        ? `Okres próbny: ${days} ${days === 1 ? "dzień" : "dni"}`
        : `Plan kończy się za ${days} ${days === 1 ? "dzień" : "dni"}`;
  return (
    <a className="sample" href="/panel/ustawienia?tab=plan" style={days < 0 ? { color: "var(--red)" } : undefined} data-tip="Plan i płatności">
      {text}
    </a>
  );
}

/** Kończy sesję (albo usuwa kod administratora z tej przeglądarki) i wraca do okna logowania. */
export function LogoutButton() {
  return (
    <button
      type="button"
      className="btn btn-plain"
      data-tip="Kończy logowanie w tej przeglądarce (np. na cudzym komputerze)"
      onClick={async () => {
        await authApi.logout();
        window.location.reload();
      }}
    >
      Wyloguj
    </button>
  );
}

/** Logo i nazwa firmy w nagłówku panelu (Ustawienia → Firma; zapas: src/content/firma.ts). */
export function PanelBrand() {
  const brand = useBrand();
  return (
    <div className="logo">
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo z KV jako data URL
        <img src={brand.logo} alt="" className="logo-img" />
      ) : (
        <span className="logo-mark" aria-hidden>
          {initials(brand.name)}
        </span>
      )}
      {brand.name}
    </div>
  );
}

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
        ? ["Panel wymaga logowania", "Zaloguj się kontem firmy, żeby zobaczyć oferty."]
        : mode === "error"
          ? ["Nie udało się wczytać ofert", error || "Spróbuj ponownie za chwilę."]
          : ["Nie ma jeszcze ofert", "Dodaj pierwszą ofertę, a pojawi się tutaj. Własne modele 3D i kolory RAL wgrasz w Ustawieniach."];

  return (
    <div className="pnl" data-view="list">
      <header className="top">
<PanelBrand />
        <span className="grow" />
        {mode === "api" ? <PlanNotice /> : null}
        {mode === "api" || mode === "local" ? (
          <>
            <a className="btn btn-plain" href="/panel/zgloszenia">
              Zgłoszenia
            </a>
            <a className="btn btn-plain" href="/panel/ustawienia">
              Ustawienia
            </a>
            <LogoutButton />
          </>
        ) : null}
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
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ink" onClick={onNew}>
                Dodaj ofertę
              </button>
              <a className="btn btn-ghost" href="/panel/ustawienia">
                Ustawienia (modele 3D)
              </a>
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Logowanie do panelu: e-mail i hasło konta firmy; „Kod administratora” dla właściciela systemu.
 * Po udanym logowaniu woła onLoggedIn (strona ponawia wczytanie danych).
 */
export function LoginDialog({ error, onLoggedIn }: { error: string; onLoggedIn: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"account" | "code">("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [local, setLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    ref.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "account" && (!email.trim() || !password)) return setLocal("Wpisz e-mail i hasło.");
    if (mode === "code" && !code.trim()) return setLocal("Wpisz kod dostępu.");
    setBusy(true);
    setLocal("");
    try {
      if (mode === "account") await authApi.login(email.trim(), password);
      else await authApi.loginWithCode(code);
      onLoggedIn();
    } catch (err) {
      setLocal(err instanceof ApiError && err.status === 401 && mode === "code" ? "Ten kod nie pasuje." : err instanceof Error ? err.message : "Nie udało się zalogować.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" data-open={open ? "" : undefined}>
      <div className="backdrop" />
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onSubmit={submit} noValidate>
        <div className="m-pad">
          <div className="m-top">
            <h2 id="login-title" style={{ fontSize: 15 }}>
              {mode === "account" ? "Logowanie do panelu" : "Kod administratora"}
            </h2>
          </div>
          {mode === "account" ? (
            <>
              <div className="field">
                <label htmlFor="l-email">E-mail</label>
                <input
                  id="l-email"
                  ref={ref}
                  className="input"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setLocal("");
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="l-pass">Hasło</label>
                <input
                  id="l-pass"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocal("");
                  }}
                />
              </div>
              <p className="faint" style={{ margin: 0, fontSize: 12 }}>
                <a href="/reset-hasla">Nie pamiętasz hasła?</a> · <a href="/rejestracja">Załóż konto firmy</a>
              </p>
            </>
          ) : (
            <div className="field">
              <label htmlFor="t-token">Kod dostępu</label>
              <input
                id="t-token"
                ref={ref}
                className="input"
                type="password"
                autoComplete="current-password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setLocal("");
                }}
              />
            </div>
          )}
          {local || error ? <p className="err">{local || error}</p> : null}
        </div>
        <div className="m-foot">
          <button
            type="button"
            className="btn btn-plain"
            onClick={() => {
              setMode(mode === "account" ? "code" : "account");
              setLocal("");
            }}
          >
            {mode === "account" ? "Mam kod administratora" : "Logowanie e-mailem"}
          </button>
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? "Logowanie…" : "Zaloguj"}
          </button>
        </div>
      </form>
    </div>
  );
}
