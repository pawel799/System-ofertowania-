"use client";

/*
 * Opcje zaznaczonego mebla w kroku „Meble”: strona zawiasu drzwi jednoskrzydłowych, szerokość cargo,
 * narożnik LeMans (strona, front, blenda, ostrzeżenie o sąsiedniej szafce), blat waterfall, typ prowadnic (wysuwy).
 * Pokazuje się tylko to, co ma sens dla danego mebla; brak opcji = nic się nie rysuje.
 */
import type { ReactNode } from "react";
import { Seg } from "./ui";
import { lemansElementu, maBlatKuchenny, ostrzezeniaLemans, ostrzezeniaWaterfall, type ElementKuchni, type PlanKuchni, type StronaWaterfall } from "@/lib/kuchnia";
import { LEMANS, podzialLemans, sprawdzLemans, type UstawieniaLemans } from "@/lib/lemans";
import { PoleCm } from "./KreatorWlasciwosci";
import { jednoSkrzydlo } from "@/lib/wnetrze";
import { cargoWysokie, jestCargo, kompletyProwadnic, koszeCargoWysokiego, maProwadnice, PROWADNICE_CARGO, type TypProwadnic } from "@/lib/okucia";

const SZEROKOSCI_CARGO = ["15", "20", "30", "40"] as const;

function Opcja({ tytul, opis, children }: { tytul: string; opis?: string; children: ReactNode }) {
  return (
    <div className="kr-opcja">
      <span className="kr-opcja-tytul">{tytul}</span>
      {children}
      {opis ? <span className="faint kr-opcja-opis">{opis}</span> : null}
    </div>
  );
}

export function KreatorOpcjeMebla({
  plan,
  element,
  onZmien,
  onWymiar,
}: {
  plan: PlanKuchni;
  element: ElementKuchni;
  onZmien: (fn: (el: ElementKuchni) => ElementKuchni) => void;
  /** Zmiana wymiaru z dosunięciem rzędu (jak pola wymiarów). */
  onWymiar: (key: "w" | "h" | "d", value: number) => boolean | void;
}) {
  const opcje: ReactNode[] = [];
  if (jestCargo(element) && element.zrodlo !== "model") {
    const szer = String(element.w);
    opcje.push(
      <Opcja
        key="cargo"
        tytul="Szerokość cargo"
        opis={cargoWysokie(element) ? `Słupek cargo: ${koszeCargoWysokiego(element.h)} koszy na mechanizmie, jeden front na całą wysokość.` : "Front na prowadnicach z koszem na 2 poziomach."}
      >
        <Seg
          label="Szerokość cargo"
          value={(SZEROKOSCI_CARGO as readonly string[]).includes(szer) ? szer : "inna"}
          onChange={(v) => {
            if (v !== "inna") onWymiar("w", Number(v));
          }}
          options={[...SZEROKOSCI_CARGO.map((v) => ({ value: v, label: `${v} cm` })), ...((SZEROKOSCI_CARGO as readonly string[]).includes(szer) ? [] : [{ value: "inna", label: `${szer} cm` }])]}
        />
      </Opcja>,
    );
  }
  if (element.rodzaj === "lemans" && element.zrodlo !== "model") {
    const u = lemansElementu(element);
    const p = podzialLemans(element.w, u);
    const ustaw = (zm: Partial<UstawieniaLemans>) => {
      const nowe = { ...u, ...zm };
      if (!sprawdzLemans(element.w, nowe)) onZmien((el) => ({ ...el, lemans: nowe }));
    };
    const ostrzezenia = ostrzezeniaLemans(plan, element.id);
    opcje.push(
      <Opcja key="lemans" tytul="Narożnik LeMans" opis={`Część ślepa ${p.slepa} mm (za szafką prostopadłą) + blenda ${p.blenda} mm + front ${p.front} mm = ${p.W} mm.`}>
        <Seg
          label="Strona części ślepej narożnika LeMans"
          value={u.strona}
          onChange={(v) => ustaw({ strona: v })}
          options={[
            { value: "L", label: "Narożnik po lewej" },
            { value: "P", label: "Narożnik po prawej" },
          ]}
        />
        <div className="kr-dims kr-dims-2">
          <PoleCm id="k-lm-front" label="Front" jedn="mm" value={u.front} min={LEMANS.front.min} max={Math.min(LEMANS.front.max, p.W - u.blenda - LEMANS.slepaMin)} onCommit={(n) => ustaw({ front: Math.round(n) })} />
          <PoleCm id="k-lm-blenda" label="Blenda" jedn="mm" value={u.blenda} min={LEMANS.blenda.min} max={LEMANS.blenda.max} onCommit={(n) => ustaw({ blenda: Math.round(n) })} />
        </div>
        {ostrzezenia.map((t) => (
          <p key={t} className="kr-warn" role="status">
            {t}
          </p>
        ))}
      </Opcja>,
    );
  }
  if (jednoSkrzydlo(element)) {
    opcje.push(
      <Opcja key="zawias" tytul="Zawiasy drzwi" opis="Patrząc na front. Uchwyt po przeciwnej stronie.">
        <Seg
          label="Strona zawiasów drzwi"
          value={element.hinge ?? "L"}
          onChange={(v) => onZmien((el) => ({ ...el, hinge: v }))}
          options={[
            { value: "L", label: "Lewe" },
            { value: "P", label: "Prawe" },
          ]}
        />
      </Opcja>,
    );
  }
  if (maProwadnice(element)) {
    const cargo = jestCargo(element);
    const n = kompletyProwadnic(element);
    opcje.push(
      <Opcja
        key="prowadnice"
        tytul="Wysuwy (prowadnice)"
        opis={
          element.prowadnice || cargo
            ? `W ofercie osobna pozycja okuć: ${n} kpl.`
            : "Standard: prowadnice w cenie mebla, jak dotąd. Wybrany typ trafia do oferty jako osobna pozycja okuć."
        }
      >
        <Seg
          label="Typ prowadnic"
          value={element.prowadnice ?? (cargo ? PROWADNICE_CARGO : "standard")}
          onChange={(v) =>
            onZmien((el) => {
              const { prowadnice: _stare, ...bez } = el;
              void _stare;
              return v === "standard" ? bez : { ...bez, prowadnice: v as TypProwadnic };
            })
          }
          options={[
            ...(cargo ? [] : [{ value: "standard", label: "Standard" }]),
            { value: "rolkowe", label: "Rolkowe" },
            { value: "kulkowe", label: "Kulkowe" },
            { value: "ukryte", label: "Ukryte, cichy domyk" },
          ]}
        />
      </Opcja>,
    );
  }
  if (maBlatKuchenny(element)) {
    const ostrzezenia = ostrzezeniaWaterfall(plan, element.id);
    opcje.push(
      <Opcja key="waterfall" tytul="Blat waterfall" opis="Bok z materiału blatu schodzi do podłogi przy boku mebla – zwykle na końcu ciągu. Łączenie z blatem na 45°.">
        <Seg
          label="Blat waterfall"
          value={element.waterfall ?? "brak"}
          onChange={(v) =>
            onZmien((el) => {
              const { waterfall: _stary, ...bez } = el;
              void _stary;
              return v === "brak" ? bez : { ...bez, waterfall: v as StronaWaterfall };
            })
          }
          options={[
            { value: "brak", label: "Brak" },
            { value: "L", label: "Lewy" },
            { value: "P", label: "Prawy" },
            { value: "LP", label: "Oba" },
          ]}
        />
        {ostrzezenia.map((t) => (
          <p key={t} className="kr-warn" role="status">
            {t}
          </p>
        ))}
      </Opcja>,
    );
  }
  if (!opcje.length) return null;
  return <div className="kr-opcje-mebla">{opcje}</div>;
}
