import type { ReactNode } from "react";
import KitchenGlbBackground from "./KitchenGlbBackground";
import MaterialsPanel from "./MaterialsPanel";

/*
 * Strona oferty dla klienta: scena 3D w tle, nagłówek i pasek materiałów.
 * Używa jej /oferta/demo (stałe dane) i /oferta/[slug] (oferta z panelu).
 */
export default function OfferView({
  code,
  title,
  eyebrow,
  base,
  showPrice = true,
}: {
  /** Numer oferty, np. "KUCH-2026/12". */
  code: string;
  title: ReactNode;
  /** Mały napis nad tytułem, np. "Oferta dla: Jan Kowalski". */
  eyebrow?: string;
  /** Cena bazowa zabudowy (domyślnie cennik demo). */
  base?: number;
  showPrice?: boolean;
}) {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0c0b0a] text-stone-100">
      {/* Tło: model 3D kuchni (obracanie myszą, przybliżanie kółkiem). */}
      <KitchenGlbBackground />

      {/* Nakładka z ofertą. Domyślnie nie łapie myszy, żeby nie blokować obracania sceny. */}
      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/0 to-black/55"
        />

        <header className="relative flex items-center justify-between gap-6 px-6 py-5 text-[11px] uppercase tracking-[0.25em] text-stone-300 md:px-10 md:py-6">
          <span className="text-stone-100">STUDIO / KUCHNIE</span>
          <span className="hidden tabular-nums text-stone-300 sm:inline">{code}</span>
          <a
            href="#wycena"
            className="pointer-events-auto rounded-full border border-white/25 px-4 py-2 text-stone-100 transition-colors hover:border-white/60 hover:bg-white/10"
          >
            Umów pomiar
          </a>
        </header>

        <div className="relative flex min-h-0 flex-1 items-end px-6 pb-8 md:px-10 md:pb-10">
          <section className="max-w-xl">
            {eyebrow ? (
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-300">{eyebrow}</p>
            ) : null}
            {/* Nagłówek: docelowo font Sreda – niedostępny w Google Fonts, patrz raport. */}
            <h1 className="mt-4 text-4xl leading-[1.05] text-stone-50 md:text-6xl">{title}</h1>
          </section>
        </div>

        {/* Pasek wyboru materiałów na dole, jak pasek zadań. */}
        <MaterialsPanel className="shrink-0" base={base} showPrice={showPrice} />
      </div>
    </main>
  );
}
