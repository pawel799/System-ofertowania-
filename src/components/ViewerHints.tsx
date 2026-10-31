"use client";

import { useEffect, useState } from "react";

/*
 * Podpowiedzi nad sceną 3D oferty:
 * - „Przeciągnij, aby obrócić” – znika po pierwszym dotknięciu/kliknięciu sceny,
 * - na telefonie w pionie: prośba o obrócenie telefonu (zamknięcie zapamiętane w localStorage).
 */
const ROTATE_KEY = "oferta:obroc-telefon-zamkniete";

export function DragHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const hide = () => setShow(false);
    window.addEventListener("pointerdown", hide, { once: true });
    window.addEventListener("wheel", hide, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", hide);
      window.removeEventListener("wheel", hide);
    };
  }, []);
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-[22%] z-[5] -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-xs text-stone-100 transition-opacity duration-300 md:top-[60%] ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      Przeciągnij, aby obrócić
    </div>
  );
}

export function RotateHint() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(ROTATE_KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, []);
  if (!open) return null;
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(ROTATE_KEY, "1");
    } catch {}
  };
  return (
    // Tylko wąski ekran w pionie; w poziomie i na komputerze ukryte.
    <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-[6] hidden items-center gap-3 rounded-xl border border-white/15 bg-[#0c0b0a]/90 py-2.5 pl-3.5 pr-1.5 text-sm text-stone-100 max-md:portrait:flex">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-6 w-6 flex-none text-stone-300">
        <rect x="7" y="3" width="10" height="16" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
        <path d="M11 16.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M19.5 8.5a6 6 0 0 1 1 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="m21.6 13.2-1.1 1.9-1.9-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="flex-1 leading-snug">Obróć telefon, żeby lepiej zobaczyć projekt w 3D</p>
      <button type="button" onClick={close} aria-label="Zamknij podpowiedź" className="flex-none rounded-full p-2 text-stone-400 hover:text-stone-100">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
