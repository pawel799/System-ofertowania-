import { test } from "node:test";
import assert from "node:assert/strict";
import { formatkiProjektu, USTAWIENIA_DOMYSLNE, type MaterialFormatki, type ZrodloMaterialow } from "./formatki";
import { okuciaOferty, ostrzezeniaLemans, ostrzezeniaWaterfall, parseKuchnia, pustyPlan, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";
import { DEFAULT_CENNIK } from "@/lib/modul";

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

// LeMans 110 w narożniku L: korpus wzdłuż ściany A (tył przy z = 0), szafka prostopadła ze ściany B stoi przed częścią ślepą.
const lemansL = (zm: Partial<ElementKuchni> = {}) => el({ id: "lemans01", nazwa: "Narożnik LeMans 110", rodzaj: "lemans", w: 110, x: 55, z: 28, ...zm });
const prostopadla = (zm: Partial<ElementKuchni> = {}) => el({ id: "bok00001", nazwa: "Szafka B", rot: 90, x: 28, z: 86, ...zm });

test("LeMans L: korpus 1100, blenda 70, front 450, mechanizm lewy, zawiasy", () => {
  const p = { ...plan(lemansL(), prostopadla()), uklad: "L" as const, scianaB: 300 };
  const l = lista(p);
  assert.deepEqual(wymiary(p, "Bok").slice(0, 1), ["720×557×2"]);
  assert.deepEqual(wymiary(p, "Wieniec dolny").slice(0, 1), ["1064×557×1"]);
  assert.deepEqual(wymiary(p, "Blenda (zaślepka)"), ["717×70×1"]);
  assert.deepEqual(wymiary(p, "Front LeMans"), ["717×447×1"]);
  const okucia = l.okucia.map((o) => o.nazwa);
  assert.ok(okucia.includes("Mechanizm narożny typu LeMans lewy (front 450 mm, korpus 1100 mm)"), okucia.join(" | "));
  assert.ok(okucia.includes("Zawiasy puszkowe z prowadnikami"));
  assert.deepEqual(ostrzezeniaLemans(p), []);
});

test("LeMans P: blenda i front po lewej, mechanizm prawy, okucia oferty z wariantem P", () => {
  const lm = lemansL({ lemans: { strona: "P", blenda: 60, front: 500 } });
  const sasiad = prostopadla({ rot: 270, x: 82, z: 86 });
  const p = plan(lm, sasiad);
  assert.deepEqual(wymiary(p, "Blenda (zaślepka)"), ["717×60×1"]);
  assert.deepEqual(wymiary(p, "Front LeMans"), ["717×497×1"]);
  assert.ok(lista(p).okucia.some((o) => o.nazwa.startsWith("Mechanizm narożny typu LeMans prawy")));
  assert.deepEqual(
    okuciaOferty(p, DEFAULT_CENNIK).map((o) => [o.klucz, o.wariant, o.ilosc]),
    [["lemans", "P", 1]],
  );
  // Sąsiad stoi po prawej (od strony ślepej): wolne = 1100 − 500 − 578 = 22 mm < 40 → ostrzeżenie.
  assert.match(ostrzezeniaLemans(p).join(" "), /22 mm od frontu/);
});

test("LeMans: sąsiad za głęboki zasłania front, brak sąsiada – podpowiedź", () => {
  const p = plan(lemansL(), prostopadla({ d: 65, x: 32.5 }));
  assert.match(ostrzezeniaLemans(p).join(" "), /zasłania front .* o 18 mm/);
  assert.match(ostrzezeniaLemans(plan(lemansL())).join(" "), /brak szafki prostopadłej/);
});

test("LeMans: parser zachowuje ustawienia, odrzuca blendę spoza 50–100 mm", () => {
  const p = plan(lemansL({ lemans: { strona: "P", blenda: 60, front: 500 } }));
  assert.deepEqual(parseKuchnia(p).elementy[0].lemans, { strona: "P", blenda: 60, front: 500 });
  assert.throws(() => parseKuchnia(plan(lemansL({ lemans: { strona: "L", blenda: 120, front: 450 } }))), /Blenda LeMans/);
  // Stary plan bez pola – domyślne ustawienia, bez zmian w zapisie.
  assert.equal(parseKuchnia(plan(lemansL())).elementy[0].lemans, undefined);
});

test("waterfall P na końcu ciągu: bok 820 mm (nóżki 100 + korpus 720), gł. blatu, blat dłuższy o grubość", () => {
  const p = plan(el({ id: "szafka01", x: 30 }), el({ id: "szafka02", x: 90, waterfall: "P" }));
  const l = formatkiProjektu(p, { ...zrodlo, gruboscBlatu: 38 });
  const blaty = l.blaty.map((b) => `${b.mebel}: ${b.dl}×${b.szer}`);
  assert.deepEqual(blaty, ["nad poz. 1, 2: 1238×580", "bok waterfall – 2. Mebel, prawy: 820×580"]);
  const bok = l.blaty.find((b) => b.waterfall)!;
  assert.match(bok.uwagi ?? "", /gr\. 38 mm/);
  assert.match(bok.uwagi ?? "", /45°/);
  // Wysokość z ustawień nóżek, nie na sztywno.
  const wyzsze = formatkiProjektu(p, zrodlo, { ...USTAWIENIA_DOMYSLNE, nozki: 150 });
  assert.equal(wyzsze.blaty.find((b) => b.waterfall)!.dl, 870);
  assert.deepEqual(ostrzezeniaWaterfall(p), []);
});

test("waterfall: oba boki, ostrzeżenie w środku ciągu, parser tylko dla szafek pod blatem", () => {
  const p = plan(el({ id: "szafka01", x: 30, waterfall: "LP" }));
  assert.equal(lista(p).blaty.filter((b) => b.waterfall).length, 2);
  const srodek = plan(el({ id: "szafka01", x: 30, waterfall: "P" }), el({ id: "szafka02", x: 90 }));
  assert.match(ostrzezeniaWaterfall(srodek).join(" "), /po prawej styka się/);
  assert.equal(parseKuchnia(p).elementy[0].waterfall, "LP");
  assert.throws(() => parseKuchnia(plan(el({ strefa: "gorna", h: 72, d: 32, waterfall: "L" }))), /waterfall tylko przy szafce dolnej/);
});

test("wysuwy w rozkroju: nazwa prowadnic z typem, cargo z wybranym typem", () => {
  const okucia = lista(plan(el({ rodzaj: "szuflady", prowadnice: "ukryte" }))).okucia.map((o) => o.nazwa);
  assert.ok(okucia.some((o) => o === "Prowadnice ukryte z cichym domykiem 500 mm"), okucia.join(" | "));
  const cargo = lista(plan(el({ rodzaj: "cargo", w: 30, prowadnice: "rolkowe" }))).okucia.map((o) => o.nazwa);
  assert.ok(cargo.includes("Prowadnice cargo rolkowe 500 mm"), cargo.join(" | "));
});
