/*
 * Wysokości w scenie 3D (metry). Rzut zostaje w centymetrach.
 * Półka ścienna dosuwa się górą do szafek górnych obok, blat leży na szafce dolnej.
 */
import { nachodzi, rect, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";

/** Dół szafek górnych nad blatem [m]. */
export const Y_GORNA = 1.45;
const BLAT_NAD_KORPUSEM = 0.03;
const GORNA_TYPOWA = 0.72;

export function poziomBlatu(plan: PlanKuchni, el: ElementKuchni) {
  const r = rect(el);
  const pod = plan.elementy.filter((e) => e.strefa === "dolna" && nachodzi(r, rect(e)));
  if (!pod.length) return 0.72 + BLAT_NAD_KORPUSEM;
  return Math.max(...pod.map((e) => e.h / 100)) + BLAT_NAD_KORPUSEM;
}

export function yElementu(el: ElementKuchni, plan: PlanKuchni) {
  if (el.strefa === "gorna") return Y_GORNA;
  if (el.strefa === "blat") {
    const poziom = poziomBlatu(plan, el);
    if ((el.rodzaj ?? "szafka") === "zlewozmywak") return Math.max(0, poziom - el.h / 100 + 0.012);
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
