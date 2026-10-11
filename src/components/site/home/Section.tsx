import type { ReactNode } from "react";

/* Sekcja strony głównej: kotwica (z odstępem na przyklejony pasek) i szerokość treści. */
export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 border-t border-white/10 px-6 py-24 md:px-10 md:py-32 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

/* Nagłówek sekcji: mały napis, tytuł i opcjonalny wstęp. */
export function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <header className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">{eyebrow}</p>
      <h2 className="mt-4 text-balance text-3xl leading-[1.08] text-stone-50 md:text-5xl">{title}</h2>
      {lead ? <p className="mt-5 text-base leading-relaxed text-stone-400">{lead}</p> : null}
    </header>
  );
}

/* Numer porządkowy 01, 02… */
export const nr = (i: number) => String(i + 1).padStart(2, "0");
