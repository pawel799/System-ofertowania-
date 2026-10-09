"use client";

import { useState } from "react";
import {
  COUNTERTOPS,
  setCountertop,
  useCountertop,
} from "./countertopStore";
import { FRONTS, setFront, useFront } from "./frontStore";
import { HARDWARE, setHardware, useHardware } from "./hardwareStore";

type Option = { id: string; name: string; delta: number };

const BASE_PRICE = 24_900;

const NBSP = "\u00A0";

// Polski zapis kwot: spacja (nierozdzielająca) co 3 cyfry, np. "24 900 zł", "1 200 zł".
// Intl.NumberFormat("pl-PL") nie grupuje liczb 4-cyfrowych ("1200"), dlatego
// grupujemy ręcznie – tak samo na serwerze i w przeglądarce.
function formatPln(value: number) {
  const digits = Math.abs(Math.round(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${value < 0 ? "\u2212" : ""}${digits}${NBSP}zł`;
}

const GROUP_LABEL = "text-[11px] uppercase tracking-[0.2em] text-stone-500";

function OptionGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
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
              {option.delta !== 0 && (
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
}: {
  className?: string;
}) {
  // Front, blat i okucia są wspólne z modelem 3D (osobne magazyny stanu).
  const front = useFront();
  const countertop = useCountertop();
  const hardware = useHardware();
  const [requested, setRequested] = useState(false);

  const selectedFront = FRONTS.find((f) => f.id === front) ?? FRONTS[0];
  const total =
    BASE_PRICE +
    selectedFront.delta +
    (COUNTERTOPS.find((c) => c.id === countertop)?.delta ?? 0) +
    (HARDWARE.find((h) => h.id === hardware)?.delta ?? 0);

  return (
    // relative: inaczej gradient nakładki (pozycjonowany) maluje się nad paskiem
    <aside
      id="wycena"
      className={`pointer-events-auto relative max-h-[55vh] overflow-y-auto border-t border-black/10 bg-white text-stone-900 md:max-h-none md:overflow-visible ${className}`}
    >
      <h2 className="sr-only">Materiały</h2>

      <div className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-end md:gap-8 md:px-10 md:py-5">
        {/* Gdy pasek się nie mieści, grupy schodzą do drugiego rzędu. */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4 md:gap-x-8">
          <fieldset>
            <legend className={`mb-2 flex items-baseline gap-2 ${GROUP_LABEL}`}>
              Fronty
              <span className="text-sm normal-case tracking-normal text-stone-900">
                {selectedFront.name}
              </span>
            </legend>
            <div className="flex gap-2.5" role="radiogroup" aria-label="Fronty">
              {FRONTS.map((swatch) => {
                const selected = swatch.id === front;
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={swatch.name}
                    title={swatch.name}
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
          </fieldset>

          <OptionGroup
            title="Blat"
            options={COUNTERTOPS}
            value={countertop}
            onChange={setCountertop}
          />

          <OptionGroup
            title="Okucia"
            options={HARDWARE}
            value={hardware}
            onChange={setHardware}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-5 md:ml-auto md:justify-end">
          <div className="md:text-right">
            <p className={GROUP_LABEL}>Szacunek netto</p>
            <p
              className="text-2xl leading-tight tabular-nums text-stone-900"
              aria-live="polite"
            >
              {formatPln(total)}
            </p>
            {requested ? (
              <p className="text-[11px] text-stone-500" role="status">
                Wersja demo: tu podepniemy formularz wyceny.
              </p>
            ) : (
              <p className="text-[11px] text-stone-500">
                Bez AGD. Montaż w wycenie po pomiarze.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRequested(true)}
            className="shrink-0 rounded-full bg-stone-900 px-5 py-3 text-sm text-white transition-colors hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Poproś o wycenę
          </button>
        </div>
      </div>
    </aside>
  );
}
