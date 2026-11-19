// Testy parsera CSV bazy płyt: `npm test` (node --test, natywne obcinanie typów w Node 24 – bez zależności).
import assert from "node:assert/strict";
import { test } from "node:test";
import { csvZPlyt, parseCsvPlyt, parseMaterialyPlyt, opisPlyty, wybierzPlyte, zPlytami, gruboscBlatu } from "./plyty.ts";

const NAGLOWEK = "producent;kod;nazwa;typ;grubosci;hex;cena_m2";

test("poprawny plik ze średnikiem", () => {
  const csv = [NAGLOWEK, "Egger;H1145;Dąb Bardolino naturalny;płyta;18;#b08a5f;45,50", "Kronospan;0190;Czarny;plyta;18/10;#1b1b1b;", "Egger;F186;Beton Chicago jasnoszary;blat;38/28;#a7a49e;"].join("\n");
  const w = parseCsvPlyt(csv);
  assert.equal(w.blad, undefined);
  assert.equal(w.separator, ";");
  assert.deepEqual(w.bledy, []);
  assert.equal(w.plyty.length, 3);
  const [a, b, c] = w.plyty;
  assert.equal(a.producer, "Egger");
  assert.equal(a.code, "H1145");
  assert.equal(a.priceM2, 45.5);
  assert.equal(a.finish, "drewno");
  assert.equal(a.source, "csv");
  assert.equal(a.textureUrl, null);
  assert.equal(b.priceM2, undefined, "brak ceny = tryb bez cen");
  assert.deepEqual(b.thicknesses, [10, 18]);
  assert.equal(c.type, "blat");
  assert.equal(c.finish, "beton");
  assert.deepEqual(c.thicknesses, [28, 38]);
});

test("przecinek jako separator, cudzysłowy i BOM", () => {
  const csv = '﻿producent,kod,nazwa,typ,grubosci,hex,cena_m2\r\nEgger,W1000,"Biały, premium",plyta,18,ffffff,"45,5"\r\n';
  const w = parseCsvPlyt(csv);
  assert.equal(w.separator, ",");
  assert.deepEqual(w.bledy, []);
  assert.equal(w.plyty[0].name, "Biały, premium");
  assert.equal(w.plyty[0].hex, "#ffffff");
  assert.equal(w.plyty[0].priceM2, 45.5);
});

test("zły separator – tabulator nie jest rozpoznany", () => {
  const w = parseCsvPlyt("producent\tkod\tnazwa\ttyp\tgrubosci\nEgger\tH1145\tDąb\tplyta\t18\n");
  assert.ok(w.blad);
  assert.match(w.blad, /separator/);
  assert.equal(w.plyty.length, 0);
});

test("brak wymaganej kolumny", () => {
  const w = parseCsvPlyt("producent;kod;nazwa;hex\nEgger;H1145;Dąb;#aa8855\n");
  assert.ok(w.blad);
  assert.match(w.blad, /Brak kolumn: typ, grubosci/);
  assert.equal(w.plyty.length, 0);
});

test("błędne wiersze z numerem, reszta się importuje", () => {
  const csv = [NAGLOWEK, "Egger;H1145;Dąb;plyta;18;#b08a5f;", ";U999;Czarny;plyta;18;;", "Egger;U708;Szary;plyta;abc;;", "Egger;F204;Marmur;kompakt;20;;", "Egger;H1145;Dąb znowu;plyta;18;;", "Egger;U702;Szary;deska;18;;", "Egger;W980;Biały;plyta;18;#zzz;"].join("\n");
  const w = parseCsvPlyt(csv);
  assert.equal(w.plyty.length, 1);
  assert.deepEqual(
    w.bledy.map((b) => b.wiersz),
    [3, 4, 5, 6, 7, 8],
  );
  assert.match(w.bledy[0].powod, /producenta/);
  assert.match(w.bledy[1].powod, /grubość/);
  assert.match(w.bledy[2].powod, /kompakt/);
  assert.match(w.bledy[3].powod, /wierszu 2/);
  assert.match(w.bledy[4].powod, /typ/);
  assert.match(w.bledy[5].powod, /kolor/);
});

test("polskie znaki w nagłówku, nazwie i typie", () => {
  const csv = "Producent;Kod;Nazwa;Typ;Grubości;HEX;Cena_m2\nSwiss Krono;D 4298;Dąb Łódzki żółty ćma;Obrzeże;0,8/2;#c09060;\n";
  const w = parseCsvPlyt(csv);
  assert.deepEqual(w.bledy, []);
  const p = w.plyty[0];
  assert.equal(p.producer, "Inny");
  assert.equal(p.producerName, "Swiss Krono");
  assert.equal(p.name, "Dąb Łódzki żółty ćma");
  assert.equal(p.type, "obrzeze");
  assert.deepEqual(p.thicknesses, [0.8, 2]);
  assert.match(p.id, /^swiss-krono-d-4298-obrzeze$/);
});

test("eksport i ponowny import dają to samo", () => {
  const w = parseCsvPlyt([NAGLOWEK, "Egger;H1145;Dąb Bardolino;płyta;18;#b08a5f;45,50", "Kronospan;0190;Czarny; \"mat\";plyta;18;#1b1b1b;"].join("\n"));
  const csv = csvZPlyt(w.plyty);
  assert.ok(csv.startsWith("﻿"));
  const w2 = parseCsvPlyt(csv);
  assert.deepEqual(w2.bledy, []);
  assert.deepEqual(w2.plyty, w.plyty);
});

test("płyta w planie, opis i grubość blatu", () => {
  const b = parseCsvPlyt([NAGLOWEK, "Egger;H1145;Dąb Bardolino naturalny;plyta;18;#b08a5f;", "Egger;F186;Beton;kompakt;12/16;#a7a49e;"].join("\n")).plyty;
  const korpus = { ...wybierzPlyte(b[0]), structure: "ST10" };
  assert.equal(opisPlyty(korpus), "Egger H1145 ST10 18 mm");
  const blat = wybierzPlyte(b[1]);
  assert.equal(blat.grubosc, 12, "kompakt domyślnie 12 mm");
  const plyty = parseMaterialyPlyt({ korpus, blat });
  assert.equal(gruboscBlatu({ plyty }), 12);
  assert.equal(gruboscBlatu({}), null);
  assert.throws(() => parseMaterialyPlyt({ blat: korpus }), /nie pasuje/);
  const z = zPlytami({ front: "grafit", countertop: "laminat-dab" }, { plyty }, null);
  assert.equal(z.wybor.front, "grafit");
  assert.equal(z.wybor.countertop, "brd:blat");
  assert.equal(z.kolory?.korpus, "brd:korpus");
});

test("wbudowane dane przechodzą walidację i mają zgodne id", async () => {
  const { readFileSync } = await import("node:fs");
  const { walidujPlyte } = await import("./plyty.ts");
  for (const plik of ["egger", "kronospan"]) {
    const dane = JSON.parse(readFileSync(new URL(`../../data/boards/${plik}.json`, import.meta.url), "utf8"));
    assert.ok(dane.length > 0);
    const ids = new Set();
    for (const d of dane) {
      const b = walidujPlyte(d, "katalog");
      assert.equal(b.id, d.id, `${plik}: id ${d.id}`);
      assert.equal(d.textureUrl, null);
      assert.ok(!ids.has(d.id), `powtórzone id ${d.id}`);
      ids.add(d.id);
    }
  }
});
