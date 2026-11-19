"use client";

/*
 * Opcje zaznaczonego mebla w kroku „Meble”: strona zawiasu drzwi jednoskrzydłowych.
 * Pokazuje się tylko to, co ma sens dla danego mebla; brak opcji = nic się nie rysuje.
 */
import type { ReactNode } from "react";
import { Seg } from "./ui";
import type { ElementKuchni } from "@/lib/kuchnia";
import { jednoSkrzydlo } from "@/lib/wnetrze";

function Opcja({ tytul, opis, children }: { tytul: string; opis?: string; children: ReactNode }) {
  return (
    <div className="kr-opcja">
      <span className="kr-opcja-tytul">{tytul}</span>
      {children}
      {opis ? <span className="faint kr-opcja-opis">{opis}</span> : null}
    </div>
  );
}

export function KreatorOpcjeMebla({ element, onZmien }: { element: ElementKuchni; onZmien: (fn: (el: ElementKuchni) => ElementKuchni) => void }) {
  const opcje: ReactNode[] = [];
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
