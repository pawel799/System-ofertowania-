"use client";

/*
 * Kreator → „Biblioteka modeli”: okno z miniaturami i krótkim opisem każdego elementu.
 * Te same pozycje co lista w kolumnie katalogu (moduły na wymiar, biblioteka GLB, modele firmy),
 * tylko łatwiej wybrać po wyglądzie. Kliknięcie dodaje element na końcu wybranej ściany; okno zostaje
 * otwarte, żeby dało się dodać kilka rzeczy z rzędu.
 *
 * Miniatury biblioteki: public/biblioteka/<id>.webp (render z Blendera, 240 px).
 * Opisy: src/lib/bibliotekaOpisy.json – policzone z nazw elementów w plikach GLB (drzwi, szuflady, podstawa…).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GRUPY_BIBLIOTEKI, podzielModele } from "@/lib/bibliotekaModeli";
import OPISY from "@/lib/bibliotekaOpisy.json";
import { GRUPY_PRESETOW, PRESETY, RODZAJ_LABEL, wycenianyElement, type NowyElement, type RodzajElementu } from "@/lib/kuchnia";
import { modulCena, type ModulCennik } from "@/lib/modul";
import { formatPln } from "../pricing";
import type { ModelMeta } from "./offerApi";
import { toast } from "./ui";
import { GRUPY_TYPU, TYP_PROJEKTU, type TypProjektu } from "@/lib/projekt";

type Pozycja = {
  key: string;
  grupa: string;
  nazwa: string;
  opis: string;
  miniatura: string | null;
  rodzaj: RodzajElementu;
  element: NowyElement;
  /** Pasuje do rodzaju projektu (kuchnia, szafa…) – domyślny filtr okna. */
  doProjektu: boolean;
};

const opisy = OPISY as Record<string, string>;

const OPIS_RODZAJU: Partial<Record<RodzajElementu, string>> = {
  szafka: "Moduł na wymiar: korpus, front, uchwyt",
  szuflady: "Moduł na wymiar z szufladami",
  narozna: "Narożna na wymiar, dwa fronty",
  zlew: "Szafka pod zlew, bez wieńca górnego",
  polka: "Półka ścienna na wymiar",
};

export function KreatorBiblioteka({
  models,
  cennik,
  onDodaj,
  onClose,
  typ = "kuchnia",
}: {
  models: ModelMeta[];
  cennik: ModulCennik | null;
  onDodaj: (el: NowyElement) => void;
  onClose: () => void;
  typ?: TypProjektu;
}) {
  const [open, setOpen] = useState(false);
  const [fraza, setFraza] = useState("");
  const [grupa, setGrupa] = useState(typ === "inne" ? "wszystkie" : "projekt");
  const zTypu = GRUPY_TYPU[typ];
  const szukajRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    szukajRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const pozycje = useMemo<Pozycja[]>(() => {
    const out: Pozycja[] = [];
    const { moduly, wlasne } = podzielModele(models);
    const kolejnosc = (g: string | null) => GRUPY_BIBLIOTEKI.findIndex((x) => x.id === g);
    const posortowane = [...moduly].sort((a, b) => kolejnosc(a.wpis.grupa) - kolejnosc(b.wpis.grupa) || a.wpis.nr - b.wpis.nr);
    for (const { model, wpis } of posortowane) {
      if (!wpis.strefa || !wpis.rodzaj) continue;
      out.push({
        key: model.id,
        grupa: GRUPY_BIBLIOTEKI.find((g) => g.id === wpis.grupa)?.label.replace(" (model 3D)", "") ?? wpis.kategoria,
        nazwa: wpis.nazwa,
        opis: opisy[model.id] ?? wpis.kategoria,
        miniatura: `/biblioteka/${model.id}.webp`,
        rodzaj: wpis.rodzaj,
        element: { nazwa: wpis.nazwa, strefa: wpis.strefa, rodzaj: wpis.rodzaj, w: wpis.w, h: wpis.h, d: wpis.d, zrodlo: "model", modelId: model.id },
        doProjektu: !!wpis.grupa && zTypu.biblioteka.includes(wpis.grupa),
      });
    }
    for (const p of PRESETY) {
      const g = GRUPY_PRESETOW.find((x) => x.id === p.grupa)?.label ?? "Na wymiar";
      out.push({
        key: `p-${p.id}`,
        grupa: `Na wymiar · ${g}`,
        nazwa: p.nazwa,
        opis: OPIS_RODZAJU[p.rodzaj] ?? `${RODZAJ_LABEL[p.rodzaj]} – bryła parametryczna`,
        miniatura: null,
        rodzaj: p.rodzaj,
        element: { nazwa: p.nazwa, strefa: p.strefa, rodzaj: p.rodzaj, w: p.w, h: p.h, d: p.d, zrodlo: "modul" },
        doProjektu: zTypu.presety.includes(p.grupa),
      });
    }
    for (const m of wlasne) {
      out.push({
        key: m.id,
        grupa: "Moje modele",
        nazwa: m.name,
        opis: "Twój model GLB, skalowany do wymiarów elementu",
        miniatura: null,
        rodzaj: "szafka",
        element: { nazwa: m.name.slice(0, 80) || "Model", strefa: "dolna", w: 60, h: 72, d: 56, zrodlo: "model", modelId: m.id },
        doProjektu: true,
      });
    }
    return out;
  }, [models, zTypu]);

  // Kolejność przycisków: grupy biblioteki jak w katalogu, potem moduły na wymiar i modele firmy.
  const grupy = useMemo(() => {
    const kolejnosc = [...GRUPY_BIBLIOTEKI.map((g) => g.label.replace(" (model 3D)", "")), "Na wymiar", "Moje modele"];
    const obecne = new Set(pozycje.map((p) => (p.grupa.startsWith("Na wymiar") ? "Na wymiar" : p.grupa)));
    return kolejnosc.filter((g) => obecne.has(g));
  }, [pozycje]);

  const q = fraza.trim().toLowerCase();
  const widoczne = pozycje.filter(
    (p) =>
      (grupa === "wszystkie" ||
        (grupa === "projekt" && p.doProjektu) ||
        p.grupa === grupa ||
        (grupa === "Na wymiar" && p.grupa.startsWith("Na wymiar"))) &&
      (!q || `${p.nazwa} ${p.opis} ${p.grupa}`.toLowerCase().includes(q)),
  );

  const cena = (p: Pozycja) => {
    if (!cennik) return "";
    return wycenianyElement(p.element) ? `${formatPln(modulCena(p.element, cennik))} netto` : "AGD, poza ceną";
  };

  return (
    <div className="overlay" data-open={open ? "" : undefined}>
      <div className="backdrop" onClick={onClose} />
      <div className="modal kr-lib" role="dialog" aria-modal="true" aria-labelledby="kr-lib-title">
        <div className="m-pad kr-lib-head">
          <div className="m-top">
            <h2 id="kr-lib-title" style={{ fontSize: 15 }}>
              Biblioteka modeli
            </h2>
            <button type="button" className="btn btn-plain" onClick={onClose} aria-label="Zamknij bibliotekę">
              Zamknij
            </button>
          </div>
          <input
            ref={szukajRef}
            className="input"
            value={fraza}
            onChange={(e) => setFraza(e.target.value)}
            placeholder="Szukaj: komoda, szuflady, lustro, 80 cm…"
            aria-label="Szukaj w bibliotece"
          />
          <div className="kr-choice" role="radiogroup" aria-label="Grupa">
            {[...(typ === "inne" ? [] : ["projekt"]), "wszystkie", ...grupy].map((g) => (
              <button key={g} type="button" role="radio" aria-checked={grupa === g} className="btn btn-ghost" onClick={() => setGrupa(g)}>
                {g === "projekt" ? `Do projektu: ${TYP_PROJEKTU[typ].label}` : g === "wszystkie" ? "Wszystkie" : g}
              </button>
            ))}
          </div>
        </div>
        <div className="kr-lib-grid">
          {widoczne.length ? (
            widoczne.map((p) => (
              <button
                key={p.key}
                type="button"
                className="kr-lib-card"
                onClick={() => {
                  onDodaj(p.element);
                  toast(`Dodano: ${p.nazwa}`, { desc: "Możesz dodać kolejny element albo zamknąć bibliotekę." });
                }}
              >
                {p.miniatura ? (
                  // eslint-disable-next-line @next/next/no-img-element -- statyczny eksport, miniatury z public/
                  <img src={p.miniatura} alt="" loading="lazy" width={240} height={240} />
                ) : (
                  <Schemat rodzaj={p.rodzaj} w={p.element.w} h={p.element.h} wlasny={p.grupa === "Moje modele"} />
                )}
                <b>{p.nazwa}</b>
                <span className="kr-lib-opis">{p.opis}</span>
                <span className="mono kr-lib-dim">
                  {p.element.w}×{p.element.h}×{p.element.d} cm{cena(p) ? ` · ${cena(p)}` : ""}
                </span>
              </button>
            ))
          ) : (
            <p className="lede">Nic nie pasuje. Zmień frazę albo grupę.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Prosty widok frontu dla modułów na wymiar (bez pliku GLB nie ma renderu). */
function Schemat({ rodzaj, w, h, wlasny }: { rodzaj: RodzajElementu; w: number; h: number; wlasny?: boolean }) {
  const k = 76 / Math.max(w, h, 1);
  const bw = Math.max(10, w * k);
  const bh = Math.max(4, h * k);
  const x = 50 - bw / 2;
  const y = 50 - bh / 2;
  const linie: ReactNode[] = [];
  const s = { stroke: "currentColor", strokeWidth: 1.4, fill: "none" } as const;
  if (wlasny) {
    linie.push(
      <text key="t" x={50} y={54} textAnchor="middle" fontSize={12} fill="currentColor">
        GLB
      </text>,
    );
  } else if (rodzaj === "szuflady") {
    for (let i = 1; i < 3; i++) linie.push(<line key={i} x1={x} y1={y + (bh * i) / 3} x2={x + bw} y2={y + (bh * i) / 3} {...s} />);
    for (let i = 0; i < 3; i++) linie.push(<line key={`u${i}`} x1={50 - bw / 6} y1={y + (bh * i) / 3 + 5} x2={50 + bw / 6} y2={y + (bh * i) / 3 + 5} {...s} />);
  } else if (rodzaj === "plyta-indukcja" || rodzaj === "plyta-gaz") {
    [0.3, 0.7].forEach((fx) => linie.push(<circle key={fx} cx={x + bw * fx} cy={50} r={Math.min(bw, 30) / 6} {...s} />));
  } else if (rodzaj === "polka") {
    linie.push(<line key="p" x1={x + 6} y1={y + bh} x2={x + 6} y2={y + bh + 8} {...s} />, <line key="q" x1={x + bw - 6} y1={y + bh} x2={x + bw - 6} y2={y + bh + 8} {...s} />);
  } else if (rodzaj === "okap" || rodzaj === "okap-podszafkowy") {
    linie.push(<line key="o" x1={x} y1={y + bh * 0.75} x2={x + bw} y2={y + bh * 0.75} {...s} />);
  } else if (rodzaj === "piekarnik" || rodzaj === "mikrofalowka") {
    linie.push(<rect key="okno" x={x + bw * 0.15} y={y + bh * 0.35} width={bw * 0.7} height={bh * 0.4} {...s} />);
  } else if (rodzaj === "bateria" || rodzaj === "zlewozmywak") {
    linie.push(<rect key="m" x={x + bw * 0.15} y={y + bh * 0.2} width={bw * 0.7} height={bh * 0.6} rx={3} {...s} />);
  } else {
    const dwoje = w >= 70 || rodzaj === "zlew" || rodzaj === "lodowka-zabudowa";
    if (dwoje) linie.push(<line key="d" x1={50} y1={y} x2={50} y2={y + bh} {...s} />);
    const hx = dwoje ? [50 - 4, 50 + 4] : [x + bw - 5];
    hx.forEach((hxx) => linie.push(<line key={hxx} x1={hxx} y1={y + 6} x2={hxx} y2={y + Math.min(20, bh * 0.4)} {...s} />));
  }
  return (
    <svg viewBox="0 0 100 100" className="kr-lib-schemat" aria-hidden>
      <rect x={x} y={y} width={bw} height={bh} rx={1.5} {...s} />
      {linie}
    </svg>
  );
}
