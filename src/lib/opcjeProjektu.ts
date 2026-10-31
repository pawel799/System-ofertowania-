/*
 * Które grupy materiałów (fronty, blat, okucia) mają sens w danej ofercie.
 * Jedna funkcja dla kreatora (krok „Materiały”), panelu ofert, strony klienta, PDF i maila – wszędzie te same opcje.
 *
 * Liczymy z tego, co faktycznie jest w projekcie, a nie z nazwy projektu:
 *   blat   – kuchenna szafka dolna, AGD pod blatem / na blacie, element „Blat” albo model 3D z oznaczonym blatem
 *            (szafa, komoda, regał, RTV i szafka pod umywalkę na wymiar blatu kuchennego nie mają);
 *   okucia – element z drzwiami albo szufladami (uchwyty) albo model z oznaczonymi uchwytami
 *            (otwarty regał, sam blat, AGD wolnostojące – nie);
 *   fronty – element z frontem (drzwi, szuflady, zabudowa zmywarki / lodówki) albo model z oznaczonym frontem.
 * Jeden wgrany model: z jego oznaczeń (Ustawienia → Modele 3D). Kuchnia demo: wszystko.
 * Ukryta grupa nie dolicza dopłaty (pricing.ts → totalPrice).
 */
import { wpisPoId } from "./bibliotekaModeli";
import { MEBLE, rodzajElementu, type ElementKuchni, type PlanKuchni } from "./kuchnia";
import { kategoriaWnetrza, wnetrzeDomyslne } from "./wnetrze";

export type GrupyMaterialow = { front: boolean; blat: boolean; okucia: boolean };

export const WSZYSTKIE_GRUPY: GrupyMaterialow = { front: true, blat: true, okucia: true };

type Role = "front" | "blat" | "uchwyt";
type ModelZTagami = { id: string; tags: Record<string, Role> };

/** AGD z frontem meblowym (zabudowa) – front i uchwyt jak szafka. */
const ZABUDOWA = new Set(["zmywarka", "lodowka-zabudowa"]);
/** Stoją na blacie albo w nim – bez blatu nie mają sensu. */
const NA_BLACIE = new Set(["plyta-indukcja", "plyta-gaz", "zlewozmywak", "bateria"]);

function role(model: ModelZTagami | undefined): Set<Role> | null {
  return model ? new Set(Object.values(model.tags)) : null;
}

/** Element parametryczny (moduł na wymiar). */
function grupyModulu(el: ElementKuchni): GrupyMaterialow {
  const rodzaj = rodzajElementu(el);
  if (rodzaj === "blat") return { front: false, blat: true, okucia: false };
  if (NA_BLACIE.has(rodzaj)) return { front: false, blat: true, okucia: false };
  if (ZABUDOWA.has(rodzaj)) return { front: true, blat: el.strefa === "dolna", okucia: true };
  // Piekarnik pod blatem: blat nad nim; drzwi piekarnika to nie front meblowy.
  if (rodzaj === "piekarnik") return { front: false, blat: el.strefa === "dolna", okucia: false };
  if (!kategoriaWnetrza(el)) return { front: false, blat: false, okucia: false };
  const wn = el.wnetrze ?? wnetrzeDomyslne(el);
  const maFront = !!wn && (wn.front !== "otwarte" || wn.kolumny.some((k) => k.sekcje.some((s) => s.typ === "szuflada")));
  return { front: maFront, blat: el.strefa === "dolna" && !MEBLE.has(rodzaj), okucia: maFront };
}

/** Model 3D w projekcie: z oznaczeń; gdy modelu nie ma na liście – z grupy biblioteki. */
function grupyModelu(el: ElementKuchni, modele: ReadonlyMap<string, ModelZTagami>): GrupyMaterialow {
  const r = role(el.modelId ? modele.get(el.modelId) : undefined);
  if (r) return { front: r.has("front"), blat: r.has("blat"), okucia: r.has("uchwyt") };
  const wpis = el.modelId ? wpisPoId(el.modelId) : undefined;
  if (wpis?.grupa === "blaty") return { front: false, blat: true, okucia: false };
  if (wpis?.grupa === "agd") return { front: false, blat: false, okucia: false };
  const kuchenny = wpis ? ["dolne", "gorne", "slupki", "dodatki"].includes(wpis.grupa ?? "") : false;
  return { front: true, blat: kuchenny && el.strefa === "dolna", okucia: true };
}

export function grupyMaterialow(args: {
  plan?: PlanKuchni | null;
  /** Jeden model całej oferty (bez kreatora). */
  model?: ModelZTagami | null;
  /** Modele użyte w planie (z oznaczeniami ról). */
  modele?: readonly ModelZTagami[] | null;
}): GrupyMaterialow {
  const { plan, model } = args;
  if (plan?.elementy.length) {
    const mapa = new Map((args.modele ?? []).map((m) => [m.id, m]));
    const out = { front: false, blat: false, okucia: false };
    for (const el of plan.elementy) {
      const g = el.zrodlo === "model" ? grupyModelu(el, mapa) : grupyModulu(el);
      out.front ||= g.front;
      out.blat ||= g.blat;
      out.okucia ||= g.okucia;
    }
    return out;
  }
  if (model) {
    const r = role(model)!;
    return { front: r.has("front"), blat: r.has("blat"), okucia: r.has("uchwyt") };
  }
  return WSZYSTKIE_GRUPY;
}

/** Czy w projekcie są urządzenia AGD (do dopisku „Bez AGD…” przy cenie). */
export function maAgd(plan?: PlanKuchni | null) {
  const AGD = new Set(["zmywarka", "plyta-indukcja", "plyta-gaz", "piekarnik", "mikrofalowka", "okap", "okap-podszafkowy", "lodowka", "zlewozmywak", "bateria"]);
  if (!plan?.elementy.length) return true;
  return plan.elementy.some((e) => AGD.has(rodzajElementu(e)) || (e.zrodlo === "model" && e.modelId && wpisPoId(e.modelId)?.grupa === "agd"));
}

/** Nazwy wybieranych materiałów do tekstów: „fronty, blat i uchwyty”, „fronty i uchwyty”… */
export function opisGrup(g: GrupyMaterialow): string {
  const czesci = [g.front ? "fronty" : null, g.blat ? "blat" : null, g.okucia ? "uchwyty" : null].filter(Boolean) as string[];
  if (!czesci.length) return "";
  return czesci.length === 1 ? czesci[0] : `${czesci.slice(0, -1).join(", ")} i ${czesci[czesci.length - 1]}`;
}
