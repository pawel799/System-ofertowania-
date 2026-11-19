"use client";

/*
 * Opcje zaznaczonego mebla w kroku „Meble”: strona zawiasu drzwi jednoskrzydłowych, szerokość cargo.
 * Pokazuje się tylko to, co ma sens dla danego mebla; brak opcji = nic się nie rysuje.
 */
import type { ReactNode } from "react";
import { Seg } from "./ui";
import type { ElementKuchni } from "@/lib/kuchnia";
import { jednoSkrzydlo } from "@/lib/wnetrze";
import { cargoWysokie, jestCargo, koszeCargoWysokiego } from "@/lib/okucia";

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
  element,
  onZmien,
  onWymiar,
}: {
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
  if (!opcje.length) return null;
  return <div className="kr-opcje-mebla">{opcje}</div>;
}
