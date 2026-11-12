/*
 * Wysokości w scenie 3D (metry). Rzut zostaje w centymetrach.
 * Półka ścienna dosuwa się górą do szafek górnych obok, blat leży na szafce dolnej.
 */
import { odPodlogiElementu } from "@/lib/bibliotekaModeli";
import { MEBLE, nachodzi, rect, rodzajElementu, WYPOSAZENIE, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";

/** Dół szafek górnych nad blatem [m]. */
export const Y_GORNA = 1.45;
const BLAT_NAD_KORPUSEM = 0.03;
const GORNA_TYPOWA = 0.72;

export function poziomBlatu(plan: PlanKuchni, el: ElementKuchni) {
  const r = rect(el);
  const pod = plan.elementy.filter((e) => e.strefa === "dolna" && rodzajElementu(e) !== "dekoracja" && nachodzi(r, rect(e)));
  if (!pod.length) return 0.72 + BLAT_NAD_KORPUSEM;
  // Telewizor, monitor, czajnik: na szafce kuchennej stoją na blacie, na komodzie, szafce RTV albo biurku – wprost na meblu.
  if (WYPOSAZENIE.has(rodzajElementu(el))) {
    const bezBlatu = (e: ElementKuchni) => MEBLE.has(rodzajElementu(e)) || WYPOSAZENIE.has(rodzajElementu(e));
    return Math.max(...pod.map((e) => e.h / 100 + (bezBlatu(e) ? 0 : BLAT_NAD_KORPUSEM)));
  }
  return Math.max(...pod.map((e) => e.h / 100)) + BLAT_NAD_KORPUSEM;
}

export function yElementu(el: ElementKuchni, plan: PlanKuchni) {
  // Model z ustaloną wysokością zawieszenia (telewizor, obraz, grzejnik).
  const odPodlogi = odPodlogiElementu(el);
  if (odPodlogi !== null) return odPodlogi / 100;
  if (el.strefa === "gorna") return Y_GORNA;
  if (el.strefa === "blat") {
    const poziom = poziomBlatu(plan, el);
    // Miska (do 30 cm) wpada w blat. Wyższy zlew z baterią stoi na blacie, żeby kran został nad nim.
    if ((el.rodzaj ?? "szafka") === "zlewozmywak" && el.h <= 30) return Math.max(0, poziom - el.h / 100 + 0.012);
    return poziom;
  }
  if (el.strefa === "polka") {
    const r = rect(el);
    let top = Y_GORNA + GORNA_TYPOWA;
    for (const e of plan.elementy) {
      if (e.strefa !== "gorna") continue;
      const o = rect(e);
      const blisko = o.x1 >= r.x0 - 40 && o.x0 <= r.x1 + 40 && o.z1 >= r.z0 - 40 && o.z0 <= r.z1 + 40;
      if (blisko) top = Math.max(top, Y_GORNA + e.h / 100);
    }
    return Math.max(Y_GORNA, top - el.h / 100);
  }
  return 0;
}
