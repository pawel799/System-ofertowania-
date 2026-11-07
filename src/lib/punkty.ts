/*
 * Gniazdka i inne punkty instalacji na ścianach (wywiad.punkty): przesuwanie na rzucie i w 3D z zabezpieczeniami,
 * uwagi montażowe i propozycja rozmieszczenia z AGD w projekcie. Rodzaje, nazwy i wymiary: PUNKT_INFO w wywiad.ts.
 *
 * Błędy (nie da się postawić): poza ścianą, poniżej podłogi / nad sufitem, w oknie albo w drzwiach, na innym punkcie.
 * Uwagi (można, ale warto wiedzieć): gniazdko blisko zlewu albo nad płytą grzewczą, punkt zasłonięty meblem
 * (kratka wentylacyjna, zawór gazu, włącznik – źle; gniazdko za AGD – tak ma być).
 */
import { rodzajElementu, type PlanKuchni } from "./kuchnia";
import { meblaPrzyScianie, wysokoscMebla } from "./otwory";
import { scianaPoId, scianyPokoju, wysokoscOtworu, wysokoscPokoju, type ScianaPokoju } from "./sciany";
import { MAX_PUNKTOW, PUNKT_INFO, type PunktInstalacji, type RodzajPunktu } from "./wywiad";

/** Gniazdko bliżej zlewu niż tyle [cm] – uwaga. */
const OD_ZLEWU = 60;

const nazwa = (p: PunktInstalacji) => PUNKT_INFO[p.rodzaj].krotka;

/** Prostokąt maskownicy na ścianie [cm]: wzdłuż (a–b) i w pionie (y0–y1). */
export function obrysPunktu(p: PunktInstalacji) {
  const { szer, h } = PUNKT_INFO[p.rodzaj];
  return { a: p.od - szer / 2, b: p.od + szer / 2, y0: p.wys - h / 2, y1: p.wys + h / 2 };
}

/** Błędy punktu po zmianie (pusta lista = można). i – indeks w plan.wywiad.punkty (nowy: -1). */
export function sprawdzPunkt(plan: PlanKuchni, i: number, p: PunktInstalacji): string[] {
  const s = scianaPoId(plan, p.sciana as ScianaPokoju);
  if (!s) return [`Ściany ${p.sciana} nie ma – ${p.sciana === "B" ? "ustaw układ L albo wymiary pokoju" : "podaj wymiary pokoju w kroku „Pomiar” albo sprawdź kreator ścian"}.`];
  const bledy: string[] = [];
  const H = wysokoscPokoju(plan);
  const r = obrysPunktu(p);
  if (r.a < 0 || r.b > s.dlugosc) bledy.push(`${nazwa(p)} wychodzi poza ścianę ${s.id} (${s.dlugosc} cm).`);
  if (r.y0 < 0) bledy.push(`${nazwa(p)} poniżej podłogi.`);
  if (r.y1 > H) bledy.push(`${nazwa(p)} nad sufitem (${H} cm).`);
  for (const o of plan.wywiad?.otwory ?? []) {
    if (o.sciana !== p.sciana) continue;
    const { y0, y1 } = wysokoscOtworu(o, H);
    if (r.b > o.od - 2 && r.a < o.od + o.szer + 2 && r.y1 > y0 - 2 && r.y0 < y1 + 2) bledy.push(`${nazwa(p)} ${o.rodzaj === "okno" ? "w oknie" : "w drzwiach"}.`);
  }
  (plan.wywiad?.punkty ?? []).forEach((inny, j) => {
    if (j === i || inny.sciana !== p.sciana) return;
    const q = obrysPunktu(inny);
    if (r.b > q.a - 1 && r.a < q.b + 1 && r.y1 > q.y0 - 1 && r.y0 < q.y1 + 1) bledy.push(`${nazwa(p)} nachodzi na: ${nazwa(inny).toLowerCase()} ${j + 1}.`);
  });
  return Array.from(new Set(bledy));
}

type Uwaga = { tekst: string; typ: "zlew" | "plyta" | "zasloniete" };

function uwagi(plan: PlanKuchni, p: PunktInstalacji): Uwaga[] {
  const s = scianaPoId(plan, p.sciana as ScianaPokoju);
  if (!s) return [];
  const info = PUNKT_INFO[p.rodzaj];
  const r = obrysPunktu(p);
  const out: Uwaga[] = [];
  const woda = plan.wywiad?.woda;
  if (info.elektryczny && woda && woda.sciana === p.sciana && Math.abs(woda.od - p.od) < OD_ZLEWU && p.wys < 150) out.push({ typ: "zlew", tekst: `Bliżej niż ${OD_ZLEWU} cm od przyłącza wody.` });
  for (const e of plan.elementy) {
    const odc = meblaPrzyScianie(e, s);
    if (!odc) continue;
    const rodzaj = rodzajElementu(e);
    if (info.elektryczny && (rodzaj === "zlew" || rodzaj === "zlewozmywak") && p.wys < 150) {
      // Komora zlewu: zlewozmywak – jego obrys; szafka pod zlew – ok. 50 cm na środku szafki.
      const sr = (odc.a + odc.b) / 2;
      const pol = rodzaj === "zlewozmywak" ? (odc.b - odc.a) / 2 : Math.min(25, (odc.b - odc.a) / 2);
      if (r.b > sr - pol - OD_ZLEWU && r.a < sr + pol + OD_ZLEWU) out.push({ typ: "zlew", tekst: `Bliżej niż ${OD_ZLEWU} cm od zlewu („${e.nazwa}”).` });
    }
    if (info.elektryczny && rodzaj.startsWith("plyta-") && p.wys > 85 && p.wys < 140 && r.b > odc.a - 10 && r.a < odc.b + 10)
      out.push({ typ: "plyta", tekst: `Nad płytą grzewczą „${e.nazwa}” – przenieś na bok.` });
    const pion = wysokoscMebla(e);
    if (!pion || r.b <= odc.a || r.a >= odc.b || p.wys < pion.y0 || p.wys > pion.y1) continue;
    const tekst =
      p.rodzaj === "kratka"
        ? `Kratki wentylacyjnej nie wolno zasłaniać – zasłania ją „${e.nazwa}”.`
        : p.rodzaj === "gaz"
          ? `Zawór gazu za „${e.nazwa}” – w plecach szafki trzeba zostawić otwór rewizyjny.`
          : p.rodzaj === "wlacznik" || p.rodzaj === "swiatlo"
            ? `„${e.nazwa}” zasłania: ${info.krotka.toLowerCase()}.`
            : `Schowane za „${e.nazwa}” (dobre dla AGD w zabudowie, w plecach szafki – otwór).`;
    out.push({ typ: "zasloniete", tekst });
  }
  return out.filter((u, k) => out.findIndex((v) => v.tekst === u.tekst) === k);
}

/** Uwagi montażowe (punkt może tam być). */
export function uwagiPunktu(plan: PlanKuchni, p: PunktInstalacji): string[] {
  return uwagi(plan, p).map((u) => u.tekst);
}

/** Położenie punktu z rzutu (cm): najbliższa ściana, środek pod kursorem w granicach ściany; wysokość bez zmian. */
export function punktWPunkcie(plan: PlanKuchni, p: PunktInstalacji, x: number, z: number, krok = 5): PunktInstalacji {
  let najlepsza: { s: ReturnType<typeof scianyPokoju>[number]; t: number; d: number } | null = null;
  for (const s of scianyPokoju(plan)) {
    const t = (x - s.x) * s.dx + (z - s.z) * s.dz;
    const d = Math.abs((x - s.x) * s.nx + (z - s.z) * s.nz);
    const poza = t < -30 ? -30 - t : t > s.dlugosc + 30 ? t - s.dlugosc - 30 : 0;
    const kara = d + poza * 2;
    if (!najlepsza || kara < najlepsza.d) najlepsza = { s, t, d: kara };
  }
  if (!najlepsza) return p;
  return naScianie(plan, p, najlepsza.s.id, najlepsza.t, p.wys, krok);
}

/** Punkt na ścianie w miejscu t (cm wzdłuż) i y (cm nad podłogą) – zaokrąglony do kroku i w granicach ściany. */
export function naScianie(plan: PlanKuchni, p: PunktInstalacji, sciana: ScianaPokoju, t: number, y: number, krok = 5): PunktInstalacji {
  const s = scianaPoId(plan, sciana);
  if (!s) return p;
  const { szer, h } = PUNKT_INFO[p.rodzaj];
  const H = wysokoscPokoju(plan);
  const zaokr = (v: number) => Math.round(v / krok) * krok;
  const od = Math.min(Math.max(Math.ceil(szer / 2), zaokr(t)), Math.max(Math.ceil(szer / 2), Math.floor(s.dlugosc - szer / 2)));
  const wys = Math.min(Math.max(Math.ceil(h / 2), zaokr(y)), Math.floor(H - h / 2));
  return { ...p, sciana: sciana as PunktInstalacji["sciana"], od, wys };
}

/** Nowy punkt w pierwszym wolnym miejscu: na podanej ścianie od „od” co 10 cm, potem na pozostałych. */
export function wolneMiejscePunktu(plan: PlanKuchni, p: PunktInstalacji): PunktInstalacji {
  const sciany = scianyPokoju(plan);
  const kolejnosc = [...sciany.filter((s) => s.id === p.sciana), ...sciany.filter((s) => s.id !== p.sciana)];
  for (const s of kolejnosc) {
    const start = s.id === p.sciana ? p.od : 20;
    for (let k = 0; k <= s.dlugosc; k += 10) {
      const t = ((start + k) % Math.max(1, s.dlugosc)) || 10;
      const kand = naScianie(plan, p, s.id, t, p.wys, 1);
      if (!sprawdzPunkt(plan, -1, kand).length) return kand;
    }
  }
  return p;
}

/**
 * Propozycja gniazdek z mebli w projekcie (do dopisania do istniejących): płyta indukcyjna – siła 400 V, płyta gazowa – zawór,
 * zmywarka, piekarnik, lodówka, mikrofala – gniazdko za nimi, okap – gniazdko nad nim, nad blatem – podwójne co ok. 120 cm
 * (nie przy zlewie, nie nad płytą). Pomija miejsca z błędem i powtórki.
 */
export function propozycjaPunktow(plan: PlanKuchni): PunktInstalacji[] {
  const H = wysokoscPokoju(plan);
  const out: PunktInstalacji[] = [...(plan.wywiad?.punkty ?? [])];
  const zPunktami = () => ({ ...plan, wywiad: plan.wywiad ? { ...plan.wywiad, punkty: out } : plan.wywiad });
  const dodaj = (p: PunktInstalacji, bezUwagZlewuIPlyty: boolean) => {
    if (out.length >= MAX_PUNKTOW) return;
    const powtorka = (k: PunktInstalacji) => out.some((q) => q.rodzaj === k.rodzaj && q.sciana === k.sciana && Math.abs(q.od - k.od) < 40 && Math.abs(q.wys - k.wys) < 30);
    if (powtorka(p)) return;
    for (const d of [0, 10, -10, 20, -20, 30, -30, 45, -45, 60, -60]) {
      const kand = naScianie(zPunktami(), p, p.sciana as ScianaPokoju, p.od + d, p.wys, 1);
      if (powtorka(kand)) continue;
      const pl = zPunktami();
      if (sprawdzPunkt(pl, -1, kand).length) continue;
      if (bezUwagZlewuIPlyty && uwagi(pl, kand).some((u) => u.typ !== "zasloniete")) continue;
      out.push(kand);
      return;
    }
  };
  for (const s of scianyPokoju(plan)) {
    const sciana = s.id as PunktInstalacji["sciana"];
    const blat: { a: number; b: number }[] = [];
    for (const e of plan.elementy) {
      const odc = meblaPrzyScianie(e, s);
      if (!odc) continue;
      const sr = Math.round((odc.a + odc.b) / 2);
      const r = rodzajElementu(e);
      const p = (rodzaj: RodzajPunktu, wys: number) => dodaj({ rodzaj, sciana, od: sr, wys }, false);
      if (r === "plyta-indukcja") p("sila", 50);
      else if (r === "plyta-gaz") p("gaz", 50);
      else if (r === "zmywarka" || r === "piekarnik" || r === "lodowka" || r === "lodowka-zabudowa" || r === "mikrofalowka") p("gniazdko", 30);
      else if (r === "okap") p("gniazdko", Math.min(H - 25, 215));
      else if (r === "okap-podszafkowy") p("gniazdko", 165);
      if (e.strefa === "dolna") blat.push(odc);
    }
    // Ciągi blatu przy tej ścianie (sklejone odcinki szafek dolnych) – podwójne gniazdka nad blatem.
    blat.sort((p, q) => p.a - q.a);
    const ciagi: { a: number; b: number }[] = [];
    for (const o of blat) {
      const ost = ciagi[ciagi.length - 1];
      if (ost && o.a <= ost.b + 2) ost.b = Math.max(ost.b, o.b);
      else ciagi.push({ ...o });
    }
    for (const c of ciagi) {
      const L = c.b - c.a;
      if (L < 60) continue;
      const n = Math.max(1, Math.round(L / 120));
      for (let k = 0; k < n; k++) dodaj({ rodzaj: "gniazdko-2", sciana, od: Math.round(c.a + (L * (k + 0.5)) / n), wys: 110 }, true);
    }
  }
  return out;
}

/** Do PDF i podsumowań: „3× Podwójne gniazdko, 1× Siła 400 V”. */
export function opisPunktow(punkty: readonly PunktInstalacji[] | undefined) {
  const ile = new Map<RodzajPunktu, number>();
  for (const p of punkty ?? []) ile.set(p.rodzaj, (ile.get(p.rodzaj) ?? 0) + 1);
  return Array.from(ile, ([r, n]) => `${n}× ${PUNKT_INFO[r].nazwa}`).join(", ");
}
