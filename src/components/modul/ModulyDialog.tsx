"use client";

/*
 * Moduły na wymiar na stronie klienta (oferta z linku) i w widżecie na stronie firmy:
 * przycisk otwiera okno z podglądem 3D szafki i ceną z cennika firmy.
 *  - oferta: lista modułów z oferty (wymiary i ceny policzone przez serwer), tylko podgląd,
 *  - widżet: konfigurator – klient ustawia wymiary, cena liczona z cennika firmy.
 */
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import type { ModulCennik, ModulItem } from "@/lib/modul";
import { formatPln } from "../pricing";

const ModulView = dynamic(() => import("./ModulView"), { ssr: false, loading: () => <p className="p-6 text-sm text-stone-500">Wczytywanie…</p> });

type Props =
  | { mode: "oferta"; moduly: (ModulItem & { cena?: number })[]; etykieta?: string; /** Dodatki do ceny (transport, montaż…) – w sumie. */ dodatki?: { nazwa: string; kwota: number }[] }
  | { mode: "konfigurator"; cennik?: ModulCennik; footer?: (dims: { w: number; h: number; d: number }) => ReactNode };

export default function ModulyDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (props.mode === "oferta" && !props.moduly.length) return null;
  const label = props.mode === "oferta" ? props.etykieta ?? `Szafki na wymiar (${props.moduly.length})` : "Szafka na wymiar";
  const dodatki = props.mode === "oferta" ? (props.dodatki ?? []) : [];
  const suma =
    props.mode === "oferta" && props.moduly.every((m) => m.cena !== undefined)
      ? props.moduly.reduce((s, m) => s + (m.cena ?? 0), 0) + dodatki.reduce((s, d) => s + d.kwota, 0)
      : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-stone-100 backdrop-blur transition-colors hover:bg-white/20"
      >
        {label}
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex flex-col bg-stone-100 text-stone-900">
          <div className="flex items-center justify-between gap-3 border-b border-stone-300 bg-white px-4 py-2">
            {props.mode === "oferta" ? (
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                {props.moduly.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSel(i)}
                    className={`rounded-full border px-3 py-1 ${i === sel ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300"}`}
                  >
                    {m.nazwa}
                    {m.cena !== undefined ? ` · ${formatPln(m.cena)}` : ""}
                  </button>
                ))}
                {dodatki.map((d, i) => (
                  <span key={`d${i}`} className="rounded-full border border-dashed border-stone-300 px-3 py-1 text-stone-600">
                    {d.nazwa} · {formatPln(d.kwota)}
                  </span>
                ))}
                {suma !== undefined ? <span className="ml-2 font-medium">Razem: {formatPln(suma)}</span> : null}
              </div>
            ) : (
              <span className="text-sm font-medium">Ustaw wymiary szafki – cena liczy się sama</span>
            )}
            <button type="button" onClick={() => setOpen(false)} className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-sm">
              Zamknij
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {props.mode === "oferta" ? (
              <ModulView
                key={sel}
                embedded
                readOnly
                title={props.moduly[sel].nazwa}
                initial={props.moduly[sel]}
                price={props.moduly[sel].cena}
              />
            ) : (
              <ModulView embedded title="Szafka na wymiar" cennik={props.cennik ?? null} footer={props.footer} />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
