import { test } from "node:test";
import assert from "node:assert/strict";
import { jednoSkrzydlo, zawiasLewy } from "./wnetrze";
import { frontyElementu } from "../components/rysunek/rysunekTechniczny";
import { parseKuchnia, pustyPlan, type ElementKuchni } from "./kuchnia";

const szafka = (o: Partial<ElementKuchni> = {}): ElementKuchni => ({ id: "abcd1234", nazwa: "Szafka dolna 60", zrodlo: "modul", strefa: "dolna", rodzaj: "szafka", w: 60, h: 72, d: 56, x: 30, z: 28, rot: 0, ...o });

test("strona zawiasu: brak pola = lewa (jak dotąd), P = prawa, kolumny bez zmian", () => {
  assert.equal(zawiasLewy(undefined, 0, 1), true);
  assert.equal(zawiasLewy("L", 0, 1), true);
  assert.equal(zawiasLewy("P", 0, 1), false);
  assert.equal(zawiasLewy("P", 0, 2), true);
  assert.equal(zawiasLewy("P", 1, 2), false);
});

test("rysunek: trójkąt otwierania po stronie zawiasu", () => {
  const drzwi = (el: ElementKuchni) => frontyElementu(el).filter((f) => f.typ === "drzwi");
  assert.deepEqual(drzwi(szafka()).map((f) => f.zawiasLewy), [true]);
  assert.deepEqual(drzwi(szafka({ hinge: "P" })).map((f) => f.zawiasLewy), [false]);
  // Szafka 80 ma dwa skrzydła – pole nie zmienia nic.
  assert.deepEqual(drzwi(szafka({ w: 80, hinge: "P" })).map((f) => f.zawiasLewy), [true, false]);
});

test("jednoSkrzydlo: szafka 60, górna i słupek tak; 80, szuflady i model nie", () => {
  assert.equal(jednoSkrzydlo(szafka()), true);
  assert.equal(jednoSkrzydlo(szafka({ strefa: "gorna", h: 72, d: 32 })), true);
  assert.equal(jednoSkrzydlo(szafka({ strefa: "wysoka", h: 210 })), true);
  assert.equal(jednoSkrzydlo(szafka({ w: 80 })), false);
  assert.equal(jednoSkrzydlo(szafka({ rodzaj: "szuflady" })), false);
  assert.equal(jednoSkrzydlo(szafka({ zrodlo: "model", modelId: "abcdefghij12" })), false);
});

test("parser: hinge zostaje, stara oferta bez pola bez zmian, zła wartość odrzucona", () => {
  const plan = { ...pustyPlan("ciag"), elementy: [szafka({ hinge: "P" })] };
  assert.equal(parseKuchnia(plan).elementy[0].hinge, "P");
  const stary = { ...pustyPlan("ciag"), elementy: [szafka()] };
  assert.deepEqual(parseKuchnia(stary), stary);
  assert.throws(() => parseKuchnia({ ...plan, elementy: [{ ...szafka(), hinge: "X" }] }), /strona zawiasu/);
});
