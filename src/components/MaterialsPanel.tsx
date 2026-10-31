"use client";

import { setCountertop, useCountertop } from "./countertopStore";
import { FRONTS, setFront, useFront } from "./frontStore";
import { setHardware, useHardware } from "./hardwareStore";
import { usePalettes } from "./paletteStore";
import { findMaterial, opcjeMaterialu, type Material } from "./katalogFirmy";
import { useKatalogStan } from "./katalogStore";
import { formatPln, totalPrice } from "./pricing";
import { CENA_ZAKRES, CENA_ZAKRES_MEBLE } from "@/lib/plans";
import { WSZYSTKIE_GRUPY, type GrupyMaterialow } from "@/lib/opcjeProjektu";
import RequestDialog, { openRequest } from "./RequestDialog";

type Option = { id: string; name: string; delta: number };

const GROUP_LABEL = "text-[11px] uppercase tracking-[0.2em] text-stone-500";

function OptionGroup({
  title,
  options,
  value,
  onChange,
  showDelta = true,
}: {
  title: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  /** false, gdy oferta ukrywa ceny – wtedy bez dopłat przy opcjach. */
  showDelta?: boolean;
}) {
  return (
    <div>
      <p className={`mb-2 ${GROUP_LABEL}`}>{title}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={title}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={`flex items-baseline gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 ${
                selected
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-black/15 text-stone-700 hover:border-black/50 hover:text-stone-950"
              }`}
            >
              {option.name}
              {/* Dopłaty tylko tam, gdzie są – „w cenie” przy każdej opcji zaśmieca pasek. */}
              {showDelta && option.delta !== 0 && (
                <span
                  className={`text-xs tabular-nums ${
                    selected ? "text-white/60" : "text-stone-500"
                  }`}
                >
                  {`${option.delta > 0 ? "+" : ""}${formatPln(option.delta)}`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MaterialsPanel({
  className = "",
  base,
  showPrice = true,
  code,
  grupy = WSZYSTKIE_GRUPY,
  agd = true,
}: {
  className?: string;
  /** Które materiały oferta ma (opcjeProjektu.ts): szafa bez blatu, regał bez uchwytów… Te same co w kreatorze. */
  grupy?: GrupyMaterialow;
  /** W projekcie są urządzenia AGD – dopisek „Bez AGD…” przy cenie. */
  agd?: boolean;
  /** Numer oferty – trafia do zgłoszenia wyceny/pomiaru. */
  code?: string;
  /** Cena bazowa zabudowy; domyślnie cennik demo (BASE_PRICE). */
  base?: number;
  /** false = zamiast kwoty informacja, że cena będzie po pomiarze. */
  showPrice?: boolean;
}) {
  // Front, blat i okucia są wspólne z modelem 3D (osobne magazyny stanu).
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  // Kolory z pakietów RAL i katalog materiałów firmy (puste = zestaw startowy z catalog.ts).
  const palettes = usePalettes();
  const { katalog, snapshot } = useKatalogStan();
  const ctx = { palettes, katalog, snapshot };
  const wszystkieFronty = opcjeMaterialu("front", ctx, front);
  const plyty = wszystkieFronty.filter((f) => f.zrodlo !== "ral");
  const ralFronts = wszystkieFronty.filter((f) => f.zrodlo === "ral");
  const blaty = opcjeMaterialu("countertop", ctx, countertop);
  const okucia = opcjeMaterialu("hardware", ctx, hardware);

  const brak = (id: string): Material => ({ id, name: "—", delta: 0, zrodlo: "katalog" });
  const selectedFront = findMaterial("front", front, ctx) ?? plyty[0] ?? { ...FRONTS[0], zrodlo: "wbudowany" as const };
  const total = totalPrice({ front, countertop, hardware }, base, palettes, { katalog, snapshot, grupy });
  const selectedCountertop = findMaterial("countertop", countertop, ctx) ?? blaty[0] ?? brak(countertop);
  const selectedHardware = findMaterial("hardware", hardware, ctx) ?? okucia[0] ?? brak(hardware);
  const summary = [
    grupy.front ? `front ${selectedFront.name}` : null,
    grupy.blat ? `blat ${selectedCountertop.name}` : null,
    grupy.okucia ? `okucia ${selectedHardware.name}` : null,
    showPrice ? `szacunek ${formatPln(total)} netto` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    // relative: inaczej gradient nakładki (pozycjonowany) maluje się nad paskiem
    <aside
      id="wycena"
      className={`pointer-events-auto relative border-t border-black/10 bg-white text-stone-900 desk:max-h-none desk:overflow-visible ${className}`}
    >
      <h2 className="sr-only">Materiały</h2>

      <div className="flex flex-col gap-5 px-5 py-5 desk:flex-row desk:items-end desk:gap-8 desk:px-10 desk:py-5">
        {/* Gdy pasek się nie mieści, grupy schodzą do drugiego rzędu. */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 desk:gap-x-8">
          {grupy.front ? (
            <fieldset>
              <legend className={`mb-2 flex items-baseline gap-2 ${GROUP_LABEL}`}>
                Fronty
                <span className="text-sm normal-case tracking-normal text-stone-900">
                  {selectedFront.name}
                  {showPrice && selectedFront.delta ? (
                    <span className="ml-1.5 text-xs tabular-nums text-stone-500">+{formatPln(selectedFront.delta)}</span>
                  ) : null}
                </span>
              </legend>
              <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Fronty">
                {plyty.map((swatch) => {
                  const selected = swatch.id === front;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Front: ${swatch.name}${showPrice && swatch.delta ? `, dopłata ${formatPln(swatch.delta)}` : ""}`}
                      title={`${swatch.name}${showPrice && swatch.delta ? ` (+${formatPln(swatch.delta)})` : ""}`}
                      onClick={() => setFront(swatch.id)}
                      className={`h-9 w-9 rounded-full border transition ${
                        selected
                          ? "border-stone-900 ring-2 ring-stone-900/30 ring-offset-2 ring-offset-white"
                          : "border-black/20 hover:border-black/50"
                      }`}
                      style={{ backgroundColor: swatch.color }}
                    />
                  );
                })}
              </div>
              {ralFronts.length ? (
                <div className="mt-2.5 flex max-w-md flex-wrap gap-2" role="radiogroup" aria-label="Kolory RAL">
                  {ralFronts.map((swatch) => {
                    const selected = swatch.id === front;
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={swatch.name}
                        title={`${swatch.name}${showPrice && swatch.delta ? ` (+${formatPln(swatch.delta)})` : ""}`}
                        onClick={() => setFront(swatch.id)}
                        className={`h-7 w-7 rounded-full border transition ${
                          selected
                            ? "border-stone-900 ring-2 ring-stone-900/30 ring-offset-2 ring-offset-white"
                            : "border-black/20 hover:border-black/50"
                        }`}
                        style={{ backgroundColor: swatch.color }}
                      />
                    );
                  })}
                </div>
              ) : null}
            </fieldset>
          ) : null}

          {grupy.blat ? (
            <OptionGroup
              title="Blat"
              options={blaty}
              value={countertop}
              onChange={setCountertop}
              showDelta={showPrice}
            />
          ) : null}

          {grupy.okucia ? (
            <OptionGroup
              title="Okucia"
              options={okucia}
              value={hardware}
              onChange={setHardware}
              showDelta={showPrice}
            />
          ) : null}
        </div>

        {/* Telefon: cena i przycisk przyklejone do dołu ekranu. */}
        <div className="oferta-cena fixed inset-x-0 bottom-0 z-20 flex shrink-0 items-center justify-between gap-4 border-t border-black/10 bg-white px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] desk:static desk:ml-auto desk:justify-end desk:border-0 desk:p-0">
          <div className="desk:text-right">
            <p className={GROUP_LABEL}>Szacunek netto</p>
            <p
              className="text-2xl leading-tight tabular-nums text-stone-900"
              aria-live="polite"
            >
              {showPrice ? formatPln(total) : "Po pomiarze"}
            </p>
            <p className="text-[11px] text-stone-500">
              {agd ? CENA_ZAKRES : CENA_ZAKRES_MEBLE}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openRequest("wycena")}
            className="shrink-0 rounded-full bg-stone-900 px-5 py-3 text-sm text-white transition-colors hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Poproś o wycenę
          </button>
        </div>
      </div>
      <RequestDialog code={code} summary={summary} />
    </aside>
  );
}
