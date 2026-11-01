"use client";

/*
 * Przełącznik „Jasny / Ciemny motyw” (strona, oferta klienta, panel). Pokazuje motyw, na który przełącza.
 * domyslny – jak wygląda to miejsce bez wyboru (strona i oferta: ciemny; panel: według systemu).
 */
import { ustawMotyw, useMotyw, type Motyw } from "@/lib/motyw";
import { useEffect, useState } from "react";

function systemowy(): Motyw {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "ciemny" : "jasny";
}

export default function PrzelacznikMotywu({ className, domyslny = "ciemny" }: { className?: string; domyslny?: Motyw | "system" }) {
  const wybrany = useMotyw();
  // Motyw systemu znany dopiero w przeglądarce (statyczny HTML – bez różnic przy hydracji).
  const [sys, setSys] = useState<Motyw>("ciemny");
  useEffect(() => setSys(systemowy()), []);
  const teraz: Motyw = wybrany ?? (domyslny === "system" ? sys : domyslny);
  const nastepny: Motyw = teraz === "jasny" ? "ciemny" : "jasny";
  return (
    <button
      type="button"
      className={className}
      onClick={() => ustawMotyw(nastepny)}
      aria-label={nastepny === "jasny" ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      title={nastepny === "jasny" ? "Jasny motyw" : "Ciemny motyw"}
      data-motyw-przelacznik
    >
      {nastepny === "jasny" ? (
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden style={{ flex: "none" }}>
          <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden style={{ flex: "none" }}>
          <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
