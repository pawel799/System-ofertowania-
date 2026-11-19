/*
 * Materiały formatek z wyboru oferty (front, okucia, blat, kolory projektu) – wspólne dla kreatora
 * i strony /panel/rozkroj (rozkrój z kilku ostatnich projektów naraz).
 */
import { findMaterial, type KontekstMaterialow } from "../katalogFirmy";
import { koloryMebla, uchwytMebla, type KoloryProjektu } from "@/lib/kolory";
import type { PlanKuchni } from "@/lib/kuchnia";
import { DREWNO_RE, formatkiProjektu, type ListaFormatek, type UstawieniaFormatek, type ZrodloMaterialow } from "./formatki";

export type WyborMaterialow = { front: string; hardware: string; countertop: string; kolory?: KoloryProjektu | null };

export function zrodloMaterialow(ctx: KontekstMaterialow, w: WyborMaterialow): ZrodloMaterialow {
  return {
    material: (el, czesc) => {
      const id = koloryMebla(el, w.front, w.kolory)[czesc];
      const m = findMaterial("front", id, ctx);
      const nazwa = m?.name ?? id;
      return { klucz: id, nazwa, grubosc: m?.thicknessMm ?? 18, sloje: m?.finish === "struktura" || DREWNO_RE.test(nazwa), rodzaj: "plyta" };
    },
    uchwyt: (el) => {
      const m = findMaterial("hardware", uchwytMebla(el, w.hardware), ctx);
      return { nazwa: m?.name ?? "uchwyt", bez: !!m?.bezUchwytu };
    },
    blat: findMaterial("countertop", w.countertop, ctx)?.name,
    gruboscBlatu: findMaterial("countertop", w.countertop, ctx)?.thicknessMm,
  };
}

export type ProjektDoRozkroju = { id: string; nazwa: string; plan: PlanKuchni; zrodlo: ZrodloMaterialow };

/**
 * Formatki kilku projektów w jednym rozkroju: ten sam materiał = te same arkusze (mniej odpadu),
 * każda formatka zna swój projekt („K-2026-014 · 3. Szafka dolna 60”), okucia się sumują.
 */
export function formatkiProjektow(projekty: readonly ProjektDoRozkroju[], u: UstawieniaFormatek): ListaFormatek {
  if (projekty.length === 1) return formatkiProjektu(projekty[0].plan, projekty[0].zrodlo, u);
  const materialy = new Map<string, ListaFormatek["materialy"][number]>();
  const okucia = new Map<string, ListaFormatek["okucia"][number]>();
  const out: ListaFormatek = { formatki: [], materialy: [], blaty: [], blatNazwa: "", okucia: [], pominiete: [] };
  const blaty = new Set<string>();
  for (const p of projekty) {
    const l = formatkiProjektu(p.plan, p.zrodlo, u);
    const pre = (s: string) => `${p.id} · ${s}`;
    for (const m of l.materialy) if (!materialy.has(m.klucz)) materialy.set(m.klucz, m);
    out.formatki.push(...l.formatki.map((f) => ({ ...f, id: `${p.id}:${f.id}`, mebel: pre(f.mebel) })));
    out.blaty.push(...l.blaty.map((b) => ({ ...b, mebel: pre(b.mebel) })));
    if (l.blaty.length) blaty.add(l.blatNazwa);
    out.pominiete.push(...l.pominiete.map((x) => ({ ...x, mebel: pre(x.mebel) })));
    for (const o of l.okucia) {
      const k = `${o.nazwa}|${o.jednostka}`;
      const b = okucia.get(k);
      okucia.set(k, b ? { ...b, ilosc: b.ilosc + o.ilosc } : { ...o });
    }
  }
  out.materialy = Array.from(materialy.values());
  out.okucia = Array.from(okucia.values());
  out.blatNazwa = Array.from(blaty).join(" / ") || "Blat";
  return out;
}
