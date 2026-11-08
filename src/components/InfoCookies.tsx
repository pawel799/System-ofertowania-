"use client";

/*
 * Informacja o plikach cookies (nie zgoda): serwis używa wyłącznie niezbędnych plików (sesja, ochrona przed botami,
 * ustawienia wybrane przez użytkownika) – art. 399 ust. 3 Prawa komunikacji elektronicznej nie wymaga zgody,
 * ale użytkownik ma być poinformowany. Zamknięcie zapamiętuje wpis „oprzut:cookies-info” (opisany w polityce).
 * Bez paska: kuchnia osadzona w ramce na stronie firmy (/osadz) i podgląd maila.
 * Gdyby kiedyś doszła analityka albo reklamy – potrzebny będzie baner ZGODY (opt-in), nie ta informacja.
 */
import { useEffect, useState } from "react";

const KLUCZ = "oprzut:cookies-info";

export default function InfoCookies() {
  const [widoczna, setWidoczna] = useState(false);
  useEffect(() => {
    const sciezka = window.location.pathname;
    if (sciezka.startsWith("/osadz") || sciezka.startsWith("/podglad-maila") || sciezka.startsWith("/polityka-cookies")) return;
    try {
      if (localStorage.getItem(KLUCZ) === "1") return;
    } catch {
      /* bez pamięci przeglądarki – pokazujemy informację */
    }
    setWidoczna(true);
  }, []);
  if (!widoczna) return null;
  const zamknij = () => {
    setWidoczna(false);
    try {
      localStorage.setItem(KLUCZ, "1");
    } catch {
      /* trudno – pokaże się przy następnej wizycie */
    }
  };
  return (
    <div
      role="region"
      aria-label="Informacja o plikach cookies"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        zIndex: 2147483000,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: 560,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px 10px 16px",
          borderRadius: 12,
          background: "rgba(28,25,23,0.94)",
          color: "#e7e5e4",
          fontSize: 13,
          lineHeight: 1.45,
          boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(8px)",
        }}
      >
        <p style={{ margin: 0 }}>
          Używamy tylko niezbędnych plików cookies – do logowania, ochrony przed botami i zapamiętania Twoich ustawień. Bez reklam i śledzenia.{" "}
          <a href="/polityka-cookies" style={{ color: "#fafaf9", textDecoration: "underline", textUnderlineOffset: 2 }}>
            Polityka cookies
          </a>
        </p>
        <button
          type="button"
          onClick={zamknij}
          style={{ flex: "none", padding: "7px 14px", borderRadius: 8, border: 0, background: "#fafaf9", color: "#1c1917", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Rozumiem
        </button>
      </div>
    </div>
  );
}
