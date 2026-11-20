import { test } from "node:test";
import assert from "node:assert/strict";
import { zrodloMaterialow } from "./zrodloOferty";
import { formatkiProjektu } from "./formatki";
import { parseCsvPlyt, wybierzPlyte } from "@/lib/plyty";
import { pustyPlan, type ElementKuchni, type PlanKuchni } from "@/lib/kuchnia";

const el = (o: Partial<ElementKuchni>): ElementKuchni => ({ id: "abcd1234", nazwa: "Mebel", zrodlo: "modul", strefa: "dolna", rodzaj: "szafka", w: 60, h: 72, d: 56, x: 30, z: 28, rot: 0, ...o });
const plan = (...elementy: ElementKuchni[]): PlanKuchni => ({ ...pustyPlan("ciag"), scianaA: 400, elementy });
const wybor = { front: "bialy", hardware: "listwa", countertop: "laminat-dab" };

test("waterfall z blatem z bazy płyt: bok i naddatek w grubości wybranej płyty (kompakt 12 mm)", () => {
  const [kompakt] = parseCsvPlyt("producent;kod;nazwa;typ;grubosci;hex\nEgger;F186;Beton Chicago jasnoszary;kompakt;12/16;#a9a7a1\n").plyty;
  const z = zrodloMaterialow({}, { ...wybor, plyty: { blat: wybierzPlyte(kompakt) } });
  assert.equal(z.gruboscBlatu, 12);
  assert.match(z.blat ?? "", /F186 Beton Chicago jasnoszary, 12 mm/);
  const l = formatkiProjektu(plan(el({ id: "szafka01", x: 30, waterfall: "P" })), z);
  const bok = l.blaty.find((b) => b.waterfall)!;
  assert.match(bok.uwagi ?? "", /gr\. 12 mm/);
  assert.equal(l.blaty.find((b) => !b.waterfall)!.dl - formatkiProjektu(plan(el({ id: "szafka01", x: 30 })), z).blaty[0].dl, 12, "blat dłuższy o grubość boku");
});

test("waterfall bez płyty z bazy: grubość jak dotąd (materiał oferty albo 38 mm)", () => {
  const z = zrodloMaterialow({}, wybor);
  assert.equal(z.gruboscBlatu, undefined);
  const bok = formatkiProjektu(plan(el({ id: "szafka01", x: 30, waterfall: "P" })), z).blaty.find((b) => b.waterfall)!;
  assert.match(bok.uwagi ?? "", /gr\. 38 mm/);
});
