/*
 * Kuchnia pokazowa do prezentacji systemu (kreator: /panel/kreator?pokaz=1):
 * L 420 × 300 cm w pokoju 420 × 380, okno nad zabudową na ścianie B, drzwi naprzeciw, gniazdka z AGD,
 * fronty dolne grafit, górne i słupki dąb, ściany w kolorze greige.
 */
import { mebleKuchniPokazowej, type PlanKuchni } from "./kuchnia";
import { propozycjaPunktow } from "./punkty";
import { wywiadDomyslny } from "./wywiad";

export function planPokazowy(): PlanKuchni {
  const meble = mebleKuchniPokazowej();
  // Dwa kolory: szafki dolne (także zmywarka i szuflady) grafit, górne i słupki jak oferta (dąb naturalny).
  const elementy = meble.elementy.map((e) =>
    e.strefa === "dolna" ? { ...e, kolory: { front: "grafit" } } : e,
  );
  const plan: PlanKuchni = {
    ...meble,
    elementy,
    pomieszczenie: { szer: 420, dlug: 380 },
    sciany: { kolor: "#c9c0b3" },
    wywiad: {
      ...wywiadDomyslny("kuchnia"),
      wysokosc: 260,
      otwory: [
        { rodzaj: "okno", sciana: "B", od: 170, szer: 110, parapet: 95 },
        { rodzaj: "drzwi", sciana: "C", od: 280, szer: 90 },
      ],
    },
  };
  return { ...plan, wywiad: { ...plan.wywiad!, punkty: propozycjaPunktow(plan) } };
}
