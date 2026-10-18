import type { ReactNode } from "react";
import BrandMark from "./BrandMark";
import CustomModelBackground from "./CustomModelBackground";
import KitchenGlbBackground from "./KitchenGlbBackground";
import MaterialsPanel from "./MaterialsPanel";
import { MeasureButton } from "./RequestDialog";
import { DragHint, RotateHint } from "./ViewerHints";
import type { PublicModel } from "./modelRoles";

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
  actions,
  model,
}: {
  /** Numer oferty, np. "KUCH-2026/12". */
  code: string;
  title: ReactNode;
  /** Mały napis nad tytułem, np. "Oferta dla: Jan Kowalski". */
  eyebrow?: string;
  /** Cena bazowa zabudowy (domyślnie cennik demo). */
  base?: number;
  showPrice?: boolean;
  /** Przyciski pod tytułem (np. uwagi klienta na stronie z linku). */
  actions?: ReactNode;
  /** Wgrany model 3D z panelu; brak = kuchnia demo. */
  model?: PublicModel | null;
}) {
  return (
    // Telefon (pion): scena 3D ~58svh na górze, pod nią tytuł i konfigurator w zwykłym przewijaniu,
    // cena i przycisk przyklejone na dole. Komputer: scena na całym ekranie, nakładka na wierzchu.
    <main className="relative min-h-[100svh] w-full bg-[#0c0b0a] pb-24 text-stone-100 desk:h-screen desk:overflow-hidden desk:pb-0">
      {/* Scena 3D (obracanie palcem/myszą, przybliżanie). */}
      <div className="relative h-[58svh] w-full [@media(orientation:landscape)_and_(max-height:500px)]:h-[82svh] desk:fixed desk:inset-0 desk:h-auto">
        {model ? <CustomModelBackground model={model} /> : <KitchenGlbBackground />}
        <DragHint />
        <RotateHint />
      </div>

      {/* Nakładka z ofertą. Domyślnie nie łapie myszy, żeby nie blokować obracania sceny. */}
      <div className="pointer-events-none relative z-10 flex flex-col desk:fixed desk:inset-0">
        <div
          aria-hidden
          className="absolute inset-0 hidden bg-gradient-to-t from-black/75 via-black/0 to-black/55 desk:block"
        />

        <header className="absolute inset-x-0 top-0 flex -translate-y-[58svh] [@media(orientation:landscape)_and_(max-height:500px)]:-translate-y-[82svh] items-center justify-between gap-4 bg-[#0c0b0a]/70 px-4 py-3 text-[11px] uppercase tracking-[0.25em] text-stone-300 desk:relative desk:translate-y-0 desk:bg-transparent desk:px-10 desk:py-6">
          <BrandMark />
          <span className="hidden tabular-nums text-stone-300 sm:inline">{code}</span>
          <MeasureButton className="pointer-events-auto rounded-full border border-white/25 px-4 py-2 text-stone-100 transition-colors hover:border-white/60 hover:bg-white/10" />
        </header>

        <div className="relative flex min-h-0 flex-1 items-end px-5 pb-6 pt-6 desk:px-10 desk:pb-10 desk:pt-0">
          <section className="max-w-xl">
            {eyebrow ? (
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-300">{eyebrow}</p>
            ) : null}
            {/* Nagłówek: docelowo font Sreda – niedostępny w Google Fonts, patrz raport. */}
            <h1 className="mt-2 text-3xl leading-[1.05] text-stone-50 desk:mt-4 desk:text-6xl">{title}</h1>
            {actions ? <div className="pointer-events-auto mt-5 flex flex-wrap items-center gap-3 desk:mt-6">{actions}</div> : null}
          </section>
        </div>

        {/* Pasek wyboru materiałów na dole, jak pasek zadań. */}
        <MaterialsPanel className="shrink-0" base={base} showPrice={showPrice} code={code} />
      </div>
    </main>
  );
}
