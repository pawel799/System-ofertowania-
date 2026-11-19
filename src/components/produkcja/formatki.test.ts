import { test } from "node:test";
import assert from "node:assert/strict";
import { formatkiProjektu, type MaterialFormatki, type ZrodloMaterialow } from "./formatki";
import { pustyPlan, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";

const PLYTA: MaterialFormatki = { klucz: "plyta", nazwa: "Płyta biała 18 mm", grubosc: 18, sloje: false, rodzaj: "plyta" };
const zrodlo: ZrodloMaterialow = { material: () => PLYTA, uchwyt: () => ({ nazwa: "listwa", bez: false }), blat: "Blat dąb 38 mm" };

export const el = (o: Partial<ElementKuchni>): ElementKuchni => ({ id: "abcd1234", nazwa: "Mebel", zrodlo: "modul", strefa: "dolna", rodzaj: "szafka", w: 60, h: 72, d: 56, x: 30, z: 28, rot: 0, ...o });
export const plan = (...elementy: ElementKuchni[]): PlanKuchni => ({ ...pustyPlan("ciag"), scianaA: 400, elementy });

export const lista = (p: PlanKuchni) => formatkiProjektu(p, zrodlo);
export const wymiary = (p: PlanKuchni, element: string) =>
  lista(p)
    .formatki.filter((f) => f.element === element)
    .map((f) => `${f.dl}×${f.szer}×${f.ilosc}`);

test("szafka dolna 60: dno (wieniec) = 600 − 2×18 = 564 mm, boki 720 × 557", () => {
  const p = plan(el({}));
  assert.deepEqual(wymiary(p, "Wieniec dolny"), ["564×557×1"]);
  assert.deepEqual(wymiary(p, "Bok"), ["720×557×2"]);
});

test("cargo 30 dolne: korpus bez półek, jeden front, kosz 2 poziomy i prowadnice", () => {
  const p = plan(el({ nazwa: "Cargo 30", rodzaj: "cargo", w: 30 }));
  const l = lista(p);
  assert.deepEqual(wymiary(p, "Bok"), ["720×557×2"]);
  assert.deepEqual(wymiary(p, "Wieniec dolny"), ["264×557×1"]);
  assert.deepEqual(wymiary(p, "Wieniec górny"), ["264×557×1"]);
  assert.deepEqual(wymiary(p, "Front cargo"), ["717×297×1"]);
  assert.equal(l.formatki.filter((f) => f.element === "Półka").length, 0);
  const okucia = l.okucia.map((o) => `${o.nazwa} ×${o.ilosc}`);
  assert.ok(okucia.includes("Kosz cargo 300 mm, 2 poziomy ×1"), okucia.join(" | "));
  assert.ok(okucia.includes("Prowadnice cargo ukryte z cichym domykiem 500 mm ×1"), okucia.join(" | "));
  assert.ok(!okucia.some((o) => o.startsWith("Zawiasy")));
});

test("słupek cargo 300 (210 cm): korpus, jeden front na wysokość, mechanizm z 6 koszami", () => {
  const p = plan(el({ nazwa: "Cargo wysokie 30", rodzaj: "cargo", strefa: "wysoka", w: 30, h: 210 }));
  const l = lista(p);
  assert.deepEqual(wymiary(p, "Bok"), ["2100×557×2"]);
  assert.deepEqual(wymiary(p, "Wieniec dolny"), ["264×557×1"]);
  assert.deepEqual(wymiary(p, "Front cargo"), ["2097×297×1"]);
  const okucia = l.okucia.map((o) => o.nazwa);
  assert.ok(okucia.includes("Mechanizm cargo wysokie 300 mm, 6 koszy, wys. korpusu 2100 mm"), okucia.join(" | "));
  // 200 cm: 5 koszy.
  const niski = lista(plan(el({ rodzaj: "cargo", strefa: "wysoka", w: 30, h: 200 }))).okucia.map((o) => o.nazwa);
  assert.ok(niski.some((o) => o.includes("5 koszy")));
});
