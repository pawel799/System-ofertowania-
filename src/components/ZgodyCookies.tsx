"use client";

/*
 * Baner zgód na pliki cookies (Google Consent Mode v2 – logika w src/lib/zgody.ts).
 * Kwadrat na środku ekranu. „Akceptuj wszystkie” i „Odrzuć wszystkie” mają ten sam wygląd i są na pierwszym ekranie
 * (odmowa tak łatwa jak zgoda – wytyczne EDPB 03/2022 i UODO); „Ustawienia” – wybór kategorii. Panel otwiera też link „Ustawienia cookies”
 * w stopce i w polityce cookies (zmiana i wycofanie zgody w każdej chwili, art. 7 ust. 3 RODO).
 * Bez banera: strony z stronaBezZgod() – tam nie ładujemy żadnych tagów.
 */
import { useEffect, useRef, useState } from "react";
import { otworzUstawieniaZgod, stronaBezZgod, usePanelZgod, useZgody, zaladujTagi, zamknijUstawieniaZgod, zapiszZgody, type Zgody } from "@/lib/zgody";

const KATEGORIE: { klucz: keyof Zgody | "niezbedne"; nazwa: string; opis: string }[] = [
  {
    klucz: "niezbedne",
    nazwa: "Niezbędne",
    opis: "Logowanie do panelu, ochrona przed botami (Cloudflare), zapamiętanie Twoich ustawień i tego wyboru. Bez nich serwis nie działa – nie wymagają zgody.",
  },
  {
    klucz: "analityczne",
    nazwa: "Analityczne",
    opis: "Statystyki odwiedzin (Google Analytics 4): które strony są oglądane i jak działa serwis. Pomagają nam go ulepszać.",
  },
  {
    klucz: "marketingowe",
    nazwa: "Marketingowe",
    opis: "Pomiar skuteczności reklam i dopasowanie reklam (Google Ads): przekazanie danych o wizycie do Google w celach reklamowych.",
  },
];

const przycisk = (glowny: boolean): React.CSSProperties => ({
  flex: "1 1 0",
  minWidth: 0,
  padding: "10px 14px",
  borderRadius: 10,
  border: glowny ? "1px solid #fafaf9" : "1px solid rgba(255,255,255,0.28)",
  background: glowny ? "#fafaf9" : "transparent",
  color: glowny ? "#1c1917" : "#fafaf9",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export default function ZgodyCookies() {
  const zgody = useZgody();
  const panel = usePanelZgod();
  const [gotowe, setGotowe] = useState(false);
  const [bezZgod, setBezZgod] = useState(true);
  const [wybor, setWybor] = useState<Zgody>({ analityczne: false, marketingowe: false });
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBezZgod(stronaBezZgod(window.location.pathname));
    setGotowe(true);
  }, []);
  // Zapisana zgoda z poprzedniej wizyty → tagi (Consent Mode ustawił już 'update' w <head>).
  useEffect(() => {
    if (zgody && (zgody.analityczne || zgody.marketingowe)) zaladujTagi();
  }, [zgody]);
  useEffect(() => {
    if (!panel) return;
    setWybor({ analityczne: zgody?.analityczne ?? false, marketingowe: zgody?.marketingowe ?? false });
    dialog.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && zamknijUstawieniaZgod();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [panel, zgody]);

  if (!gotowe || bezZgod) return null;
  const wszystkie = (tak: boolean) => zapiszZgody({ analityczne: tak, marketingowe: tak });

  if (panel)
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 2147483000, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,0.55)" }}>
        <div
          ref={dialog}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="zgody-tytul"
          style={{ width: "min(560px, 100%)", maxHeight: "calc(100dvh - 32px)", overflow: "auto", borderRadius: 16, background: "#1c1917", color: "#e7e5e4", padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", outline: "none", fontSize: 14, lineHeight: 1.5 }}
        >
          <h2 id="zgody-tytul" style={{ margin: 0, fontSize: 18, color: "#fafaf9" }}>
            Ustawienia plików cookies
          </h2>
          <p style={{ margin: "8px 0 16px", color: "#a8a29e" }}>
            Wybierz, na co się zgadzasz. Zgodę możesz w każdej chwili zmienić albo wycofać – link „Ustawienia cookies” jest na dole każdej strony.{" "}
            <a href="/polityka-cookies" style={{ color: "#fafaf9", textDecoration: "underline" }}>
              Polityka cookies
            </a>
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {KATEGORIE.map((k) => {
              const stale = k.klucz === "niezbedne";
              const wl = stale ? true : wybor[k.klucz as keyof Zgody];
              return (
                <label key={k.klucz} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.05)", cursor: stale ? "default" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={wl}
                    disabled={stale}
                    onChange={(e) => setWybor((w) => ({ ...w, [k.klucz]: e.target.checked }))}
                    style={{ marginTop: 3, width: 18, height: 18, accentColor: "#fafaf9", flex: "none" }}
                  />
                  <span>
                    <b style={{ color: "#fafaf9", fontWeight: 600 }}>
                      {k.nazwa}
                      {stale ? <span style={{ color: "#a8a29e", fontWeight: 400 }}> · zawsze aktywne</span> : null}
                    </b>
                    <span style={{ display: "block", color: "#a8a29e", fontSize: 13 }}>{k.opis}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            <button type="button" style={przycisk(true)} onClick={() => wszystkie(false)}>
              Odrzuć wszystkie
            </button>
            <button type="button" style={przycisk(false)} onClick={() => zapiszZgody(wybor)}>
              Zapisz wybór
            </button>
            <button type="button" style={przycisk(true)} onClick={() => wszystkie(true)}>
              Akceptuj wszystkie
            </button>
          </div>
        </div>
      </div>
    );

  if (zgody) return null;
  // Kwadrat na środku ekranu: przyciski „Akceptuj” i „Odrzuć” jednakowe i jeden pod drugim, „Ustawienia” pod nimi.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2147483000, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,0.5)" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="zgody-baner-tytul"
        aria-describedby="zgody-baner-opis"
        style={{
          width: "min(420px, 100%)",
          aspectRatio: "1 / 1",
          maxHeight: "calc(100dvh - 32px)",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 16,
          padding: 24,
          borderRadius: 20,
          background: "#1c1917",
          color: "#e7e5e4",
          fontSize: 14,
          lineHeight: 1.5,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div>
          <p id="zgody-baner-tytul" style={{ margin: 0, color: "#fafaf9", fontSize: 18, fontWeight: 600 }}>
            Pliki cookies
          </p>
          <p id="zgody-baner-opis" style={{ margin: "10px 0 0", color: "#d6d3d1" }}>
            Niezbędne pliki służą do logowania, bezpieczeństwa i zapamiętania ustawień. Za Twoją zgodą użyjemy też plików analitycznych (statystyki odwiedzin) i marketingowych (pomiar reklam Google). Zgodę możesz zmienić w każdej chwili.{" "}
            <a href="/polityka-cookies" style={{ color: "#fafaf9", textDecoration: "underline" }}>
              Polityka cookies
            </a>
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" style={przycisk(true)} onClick={() => wszystkie(true)}>
            Akceptuj wszystkie
          </button>
          <button type="button" style={przycisk(true)} onClick={() => wszystkie(false)}>
            Odrzuć wszystkie
          </button>
          <button type="button" style={{ ...przycisk(false), border: 0, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }} onClick={otworzUstawieniaZgod}>
            Ustawienia
          </button>
        </div>
      </div>
    </div>
  );
}

/** Link „Ustawienia cookies” (stopka, polityka cookies) – otwiera panel zgód. */
export function LinkUstawienZgod({ className, children = "Ustawienia cookies" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={otworzUstawieniaZgod} style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer", textAlign: "left" }}>
      {children}
    </button>
  );
}
