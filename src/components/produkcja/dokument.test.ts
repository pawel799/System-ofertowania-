import { test } from "node:test";
import assert from "node:assert/strict";
import { csvHurtownia, csvZamowienia, NAGLOWEK_HURTOWNIA } from "./dokument";
import { rozkroj } from "./rozkroj";
import { formatkiProjektu, wzoryFormatek, USTAWIENIA_DOMYSLNE, type MaterialFormatki } from "./formatki";
import { pustyPlan, type ElementKuchni } from "@/lib/kuchnia";
import { DEFAULT_CENNIK } from "@/lib/modul";
import { danePdf, pdfHtml, pdfTekst } from "../panel/ofertaPdf";

const PLYTA: MaterialFormatki = { klucz: "plyta", nazwa: "Płyta biała", grubosc: 18, sloje: false, rodzaj: "plyta" };
const el = (o: Partial<ElementKuchni>): ElementKuchni => ({ id: "abcd1234", nazwa: "Szafka dolna 60", zrodlo: "modul", strefa: "dolna", rodzaj: "szafka", w: 60, h: 72, d: 56, x: 30, z: 28, rot: 0, ...o });
const plan = { ...pustyPlan("ciag"), scianaA: 300, elementy: [el({}), el({ id: "cargo001", nazwa: "Cargo 30", rodzaj: "cargo", w: 30, x: 75 })] };
const lista = formatkiProjektu(plan, { material: () => PLYTA, blat: "Blat" });

test("CSV hurtowni: dokładny nagłówek, wiersz dna szafki 60 (564 × 557), okleina 1/0, bez cen", () => {
  const csv = csvHurtownia(lista).replace(/^﻿/, "");
  const linie = csv.trim().split("\r\n");
  assert.equal(linie[0], "materiał;grubość;długość;szerokość;ilość;okleina_dł1;okleina_dł2;okleina_szer1;okleina_szer2;słoje;opis");
  assert.equal(linie[0], NAGLOWEK_HURTOWNIA);
  assert.ok(linie.some((l) => /^Płyta biała;18;564;557;1;1;0;0;0;0;\d+\. 1\. Szafka dolna 60 – Wieniec dolny$/.test(l)), linie.join("\n"));
  assert.ok(linie.every((l) => l.split(";").length >= 11));
  assert.ok(!/zł/.test(csv));
});

test("CSV okuć i okleiny: formatki, cięcia, okleina w mb, okucia cargo", () => {
  const csv = csvZamowienia(lista, 42);
  assert.match(csv, /Formatki razem;\d+;szt\./);
  assert.match(csv, /Cięcia \(z rozkroju\);42;szt\./);
  assert.match(csv, /Okleina – Płyta biała;[\d.]+;mb/);
  assert.match(csv, /Kosz cargo 300 mm, 2 poziomy;1;kpl\./);
  assert.ok(!/zł/.test(csv));
});

test("rozkrój liczy cięcia: obrzeże 4 + do 2 na formatkę", () => {
  const w = rozkroj([{ ref: "a", nr: 1, dl: 1000, szer: 500, ilosc: 2 }], false);
  assert.equal(w.arkusze.length, 1);
  assert.ok(w.arkusze[0].ciecia >= 5 && w.arkusze[0].ciecia <= 8, String(w.arkusze[0].ciecia));
});

test("wzory: dno szafki 60 = 600 − 2 × 18 = 564 mm", () => {
  assert.ok(wzoryFormatek(USTAWIENIA_DOMYSLNE).some((x) => x.includes("600 − 2 × 18 = 564 mm")));
});

test("PDF oferty bez cen: żadnej kwoty w HTML i w mailu, okucia z ilością zostają", () => {
  const args = {
    id: "K-1",
    title: "Test",
    client: "Klient",
    contact: "",
    firma: "Firma",
    logo: null,
    front: "dab-naturalny",
    countertop: "kwarcyt-calacatta",
    hardware: "czarny-mat",
    palettes: [],
    cennik: DEFAULT_CENNIK,
    cennikUwaga: null,
    link3d: null,
  };
  const zCenami = danePdf({ ...args, plan });
  assert.match(pdfHtml(zCenami), /zł/);
  assert.match(pdfHtml(zCenami), /Kosz cargo dolny/);
  const bez = danePdf({ ...args, plan: { ...plan, bezCen: true } });
  const html = pdfHtml(bez);
  assert.doesNotMatch(html.replace(/hidden>[^<]*/g, ""), /\d zł/);
  assert.match(html, /Kosz cargo dolny, 2 poziomy <span class="muted">\(1 kpl\.\)/);
  assert.doesNotMatch(pdfTekst(bez), /zł/);
});
