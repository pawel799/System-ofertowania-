import { test } from "node:test";
import assert from "node:assert/strict";
import { bazaKuchni, okuciaOferty, pustyPlan, sumaMebli, type ElementKuchni, type PlanKuchni } from "./kuchnia";
import { cenaKoncowa } from "./cenaKoncowa";
import { DEFAULT_CENNIK } from "./modul";
import { CENY_OKUC_DOMYSLNE } from "./okucia";

const el = (o: Partial<ElementKuchni>): ElementKuchni => ({ id: "abcd1234", nazwa: "Mebel", zrodlo: "modul", strefa: "dolna", rodzaj: "szafka", w: 60, h: 72, d: 56, x: 30, z: 28, rot: 0, ...o });
const plan = (...elementy: ElementKuchni[]): PlanKuchni => ({ ...pustyPlan("ciag"), scianaA: 400, elementy });

test("stara oferta (bez cargo i typów prowadnic): brak pozycji okuć, cena = meble + dodatki jak dotąd", () => {
  const p = plan(el({}), el({ id: "efgh5678", rodzaj: "szuflady", x: 90 }));
  assert.deepEqual(okuciaOferty(p, DEFAULT_CENNIK), []);
  assert.equal(bazaKuchni(p, DEFAULT_CENNIK), Math.max(1, sumaMebli(p, DEFAULT_CENNIK)));
  assert.equal(cenaKoncowa({ plan: p, cennik: DEFAULT_CENNIK }).okucia, 0);
});

test("cargo: kosz i prowadnice ukryte jako osobne pozycje okuć, doliczone do ceny", () => {
  const p = plan(el({ rodzaj: "cargo", w: 30 }), el({ id: "efgh5678", rodzaj: "cargo", strefa: "wysoka", w: 30, h: 210, x: 90 }));
  const o = okuciaOferty(p, DEFAULT_CENNIK);
  assert.deepEqual(
    o.map((x) => [x.klucz, x.ilosc]),
    [
      ["prowadnice-ukryte", 2],
      ["kosz-cargo", 1],
      ["cargo-wysokie", 1],
    ],
  );
  const okucia = 2 * CENY_OKUC_DOMYSLNE["prowadnice-ukryte"] + CENY_OKUC_DOMYSLNE["kosz-cargo"] + CENY_OKUC_DOMYSLNE["cargo-wysokie"];
  assert.equal(bazaKuchni(p, DEFAULT_CENNIK), sumaMebli(p, DEFAULT_CENNIK) + okucia);
  const c = cenaKoncowa({ plan: p, cennik: DEFAULT_CENNIK });
  assert.equal(c.okucia, okucia);
  assert.equal(c.baza, bazaKuchni(p, DEFAULT_CENNIK));
});

test("ceny ręczne: okucia z ilością, bez kwot i bez wpływu na sumę", () => {
  const p = { ...plan(el({ rodzaj: "cargo", w: 30, cena: 1000 })), ceny: "reczne" as const };
  const o = okuciaOferty(p, DEFAULT_CENNIK);
  assert.equal(o.length, 2);
  assert.ok(o.every((x) => x.kwota === undefined));
  assert.equal(bazaKuchni(p, DEFAULT_CENNIK), 1000);
});

test("wysuwy: szuflady 60 z typem prowadnic – osobna pozycja z ilością, bez podwójnej dopłaty", async () => {
  const { wnetrzeDomyslne, zliczWnetrze } = await import("./wnetrze");
  const { cenaElementu } = await import("./kuchnia");
  const baza = el({ rodzaj: "szuflady" });
  const n = zliczWnetrze(baza, wnetrzeDomyslne(baza)!).szuflady;
  assert.ok(n >= 2);
  const p = plan({ ...baza, prowadnice: "kulkowe" });
  assert.deepEqual(
    okuciaOferty(p, DEFAULT_CENNIK).map((x) => [x.klucz, x.ilosc, x.kwota]),
    [["prowadnice-kulkowe", n, n * CENY_OKUC_DOMYSLNE["prowadnice-kulkowe"]]],
  );
  // Zapisane wnętrze z szufladami: dopłata „szuflada” znika, gdy prowadnice są osobną pozycją.
  const wn = wnetrzeDomyslne(baza)!;
  const bez = cenaElementu({ ...baza, wnetrze: wn }, DEFAULT_CENNIK)!;
  const z = cenaElementu({ ...baza, wnetrze: wn, prowadnice: "ukryte" }, DEFAULT_CENNIK)!;
  assert.equal(bez - z, n * (DEFAULT_CENNIK.szuflada ?? 0));
  // Cennik firmy z własną ceną prowadnic.
  const c = { ...DEFAULT_CENNIK, okucia: { "prowadnice-kulkowe": 99 } };
  assert.equal(okuciaOferty(p, c)[0].kwota, n * 99);
});

test("wysuwy: parser zostawia typ przy szufladach i cargo, usuwa przy szafce z samymi drzwiami", async () => {
  const { parseKuchnia } = await import("./kuchnia");
  assert.equal(parseKuchnia(plan(el({ rodzaj: "szuflady", prowadnice: "rolkowe" }))).elementy[0].prowadnice, "rolkowe");
  assert.equal(parseKuchnia(plan(el({ rodzaj: "cargo", w: 30, prowadnice: "kulkowe" }))).elementy[0].prowadnice, "kulkowe");
  assert.equal(parseKuchnia(plan(el({ prowadnice: "rolkowe" }))).elementy[0].prowadnice, undefined);
  assert.throws(() => parseKuchnia(plan(el({ rodzaj: "szuflady", prowadnice: "magnetyczne" as never }))), /prowadnice/);
});
