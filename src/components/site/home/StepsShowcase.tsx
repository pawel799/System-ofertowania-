"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { Media } from "@/content/strona-glowna";
import MediaSlot from "./MediaSlot";
import { nr } from "./Section";

type Step = { title: string; text: string; media: Media };

/*
 * "Jak to działa": na komputerze lista kroków po lewej (zakładki) i podgląd po prawej,
 * który przenika się przy zmianie kroku. Na telefonie kroki jeden pod drugim, każdy ze swoim podglądem.
 */
export default function StepsShowcase({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (active + d + steps.length) % steps.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <>
      {/* Telefon */}
      <ol className="mt-14 space-y-14 md:hidden">
        {steps.map((s, i) => (
          <li key={s.title}>
            <p className="text-[11px] tabular-nums tracking-[0.25em] text-stone-500">{nr(i)}</p>
            <h3 className="mt-3 text-xl text-stone-50">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-400">{s.text}</p>
            <MediaSlot media={s.media} className="mt-6" />
          </li>
        ))}
      </ol>

      {/* Komputer */}
      <div className="mt-16 hidden grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-16 md:grid">
        <div role="tablist" aria-orientation="vertical" aria-label="Kroki" className="flex flex-col" onKeyDown={onKey}>
          {steps.map((s, i) => {
            const on = i === active;
            return (
              <button
                key={s.title}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`krok-${i}`}
                aria-selected={on}
                aria-controls={`krok-podglad-${i}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className="group relative rounded-r-lg py-6 pl-8 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {/* Linia po lewej: jasna przy aktywnym kroku. */}
                <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-white/10" />
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-px origin-top bg-stone-50 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                    on ? "scale-y-100" : "scale-y-0"
                  }`}
                />
                <span className="block text-[11px] tabular-nums tracking-[0.25em] text-stone-500">{nr(i)}</span>
                <span
                  className={`mt-3 block text-2xl transition-colors duration-150 ${
                    on ? "text-stone-50" : "text-stone-500 [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-stone-300"
                  }`}
                >
                  {s.title}
                </span>
                <span
                  className={`mt-2 block text-sm leading-relaxed transition-colors duration-150 ${on ? "text-stone-400" : "text-stone-400/80"}`}
                >
                  {s.text}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid">
          {steps.map((s, i) => (
            <div
              key={s.title}
              role="tabpanel"
              id={`krok-podglad-${i}`}
              aria-labelledby={`krok-${i}`}
              aria-hidden={i !== active}
              className={`[grid-area:1/1] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                i === active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
              }`}
            >
              <MediaSlot media={s.media} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
