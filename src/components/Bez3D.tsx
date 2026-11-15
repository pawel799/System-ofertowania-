"use client";

import { Component, useEffect, useState, type ReactNode } from "react";

/*
 * Wspólna obsługa podglądu 3D, gdy przeglądarka nie da kontekstu WebGL (wyłączona akceleracja,
 * stary sterownik, część przeglądarek firmowych) albo scena wysypie się w trakcie.
 * Bez tego wyjątek z THREE.WebGLRenderer zrywa całą stronę do „Application error”.
 * Z tym zostaje spokojny komunikat w polu podglądu, a reszta ekranu (rzut, materiały, zapis) działa.
 */

let wynik: boolean | null = null;

/** Czy przeglądarka da kontekst WebGL. Wynik zapamiętany – sprawdzenie tworzy i od razu zwalnia kontekst. */
export function maWebGL(): boolean {
  if (wynik !== null) return wynik;
  if (typeof document === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    wynik = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    wynik = false;
  }
  return wynik;
}

/**
 * Komunikat w miejscu sceny. Stoi u góry pola (pod nagłówkiem), nie na środku, żeby w niskim
 * podglądzie nie nachodził na tytuł i linki ułożone na dole sceny (oferta dla klienta).
 */
export function KomunikatBez3D({ powod = "webgl" }: { powod?: "webgl" | "blad" }) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex justify-center px-4"
      style={{ paddingTop: "max(4.5rem, 12%)" }}
    >
      <div className="max-w-sm rounded-xl border border-stone-500/30 bg-black/40 px-4 py-3 text-center text-[13px] leading-snug text-stone-300 backdrop-blur-sm">
        <p className="font-medium text-stone-100">
          {powod === "webgl" ? "Podgląd 3D jest niedostępny w tej przeglądarce" : "Nie udało się wczytać modelu 3D"}
        </p>
        <p className="mt-1 text-stone-400">
          {powod === "webgl"
            ? "Wymaga WebGL (akceleracji sprzętowej). Pozostałe funkcje działają normalnie."
            : "Odśwież stronę albo spróbuj później. Pozostałe funkcje działają normalnie."}
        </p>
      </div>
    </div>
  );
}

class Granica extends Component<{ children: ReactNode }, { blad: boolean }> {
  state = { blad: false };
  static getDerivedStateFromError() {
    return { blad: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("Podgląd 3D wyłączony:", e);
  }
  render() {
    return this.state.blad ? <KomunikatBez3D powod={maWebGL() ? "blad" : "webgl"} /> : this.props.children;
  }
}

/**
 * Owija scenę 3D (Canvas). Bez WebGL nie próbuje tworzyć renderera, a błąd sceny łapie
 * i zamienia na komunikat. Zawartość renderuje się dopiero po montażu (sprawdzenie wymaga DOM).
 */
export default function Bez3D({ children }: { children: ReactNode }) {
  const [stan, setStan] = useState<"?" | "tak" | "nie">("?");
  useEffect(() => setStan(maWebGL() ? "tak" : "nie"), []);
  if (stan === "?") return null;
  if (stan === "nie") return <KomunikatBez3D />;
  return <Granica>{children}</Granica>;
}
