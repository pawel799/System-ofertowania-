/*
 * Lista formatek z innego programu (KD Max, PRO100, Excel hurtowni): wklejone komórki z Excela albo plik CSV/TXT.
 *
 * Kolumny rozpoznajemy po nagłówkach (długość, szerokość, ilość, materiał, nazwa, grubość, okleina, słoje).
 * Bez nagłówka: pierwsze dwie liczby to długość i szerokość, trzecia – ilość, pierwszy tekst – materiał.
 * Liczby z przecinkiem albo kropką. Wymiary w mm; gdy wszystkie są małe (< 300), to raczej centymetry – mnożymy × 10.
 */
import { BEZ_OKLEINY, DREWNO_RE, HDF, type Formatka, type MaterialFormatki, type Okleina } from "./formatki";

export type WynikImportu = { formatki: Formatka[]; materialy: MaterialFormatki[]; uwagi: string[]; pominieteWierszy: number };

type Kolumna = "dl" | "szer" | "ilosc" | "material" | "nazwa" | "mebel" | "grubosc" | "okleina" | "d1" | "d2" | "s1" | "s2" | "sloje";

/** Początek nagłówka i koniec słowa (\b nie działa z polskimi literami). */
const P = (alt: string) => new RegExp(`^(${alt})(?=$|[^a-ząćęłńóśźż0-9])`, "i");
const OKL = "(?:okl\\w*\\.?|obrz\\w*\\.?|edge)?\\s*[-_ ]?\\s*";

const NAGLOWKI: [Kolumna, RegExp][] = [
  ["d1", P(`${OKL}(?:d1|dl1|dł1|l1|a1)`)],
  ["d2", P(`${OKL}(?:d2|dl2|dł2|l2|a2)`)],
  ["s1", P(`${OKL}(?:s1|sz1|w1|b1)`)],
  ["s2", P(`${OKL}(?:s2|sz2|w2|b2)`)],
  ["dl", P("dł|dl|dług|dlug|długość|dlugosc|length|len|wymiar 1|wym\\.? ?1|a|x|wys|wysokość|wysokosc|height")],
  ["szer", P("szer|szerokość|szerokosc|width|wymiar 2|wym\\.? ?2|b|y")],
  ["ilosc", P("il|ilość|ilosc|szt|sztuk|qty|quantity|count|liczba|ile")],
  ["grubosc", /^(gr|grub|grubość|grubosc|thick)/i],
  ["sloje", /(słoj|sloj|usłoj|uslo|grain|kierunek|rotacja|obrót|obrot)/i],
  ["okleina", /^(okl|obrz|edge|abs|pcv|pvc)/i],
  ["material", /^(mat|materiał|material|płyt|plyt|dekor|kolor|board|rodzaj płyty)/i],
  ["mebel", /^(mebel|szafk|moduł|modul|korpus|cabinet|pozycja|poz\.)/i],
  ["nazwa", /(nazw|opis|element|część|czesc|name|desc|uwag|formatk)/i],
];

const liczba = (s: string) => {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};

function rozdziel(linia: string, sep: string) {
  if (sep !== ",") return linia.split(sep);
  // CSV z cudzysłowami.
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < linia.length; i++) {
    const c = linia[i];
    if (c === '"') {
      if (q && linia[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function separator(linie: string[]) {
  const proba = linie.slice(0, 20);
  const ile = (sep: string) => proba.reduce((s, l) => s + (l.split(sep).length - 1), 0);
  if (ile("\t") >= proba.length) return "\t";
  if (ile(";") >= proba.length) return ";";
  // Liczby rozdzielone spacjami (np. „72 56 2” albo „56,4 55,7 2”) – przecinek to wtedy część dziesiętna.
  if (proba.every((l) => l.trim().split(/\s+/).filter((c) => !Number.isNaN(liczba(c))).length >= 2)) return " ";
  if (ile(",") >= proba.length) return ",";
  if (ile("|") >= proba.length) return "|";
  return /\s{2,}/.test(proba.join("\n")) ? "  " : "\t";
}

/** Okleina z jednej kolumny: „D1 D2 S1”, „1111”, „2/2”, „dookoła”, „x”. */
function okleinaZTekstu(s: string): Okleina {
  const t = s.trim().toLowerCase();
  if (!t || t === "0" || t === "-" || t === "brak" || t === "nie") return { ...BEZ_OKLEINY };
  if (/dooko|wszystk|4 ?str|all/.test(t)) return { d1: true, d2: true, s1: true, s2: true };
  if (/^[01]{4}$/.test(t)) return { d1: t[0] === "1", d2: t[1] === "1", s1: t[2] === "1", s2: t[3] === "1" };
  const d = /d|l/.test(t);
  if (/[dl]\s*1|[sw]\s*1|[dl]\s*2|[sw]\s*2/.test(t))
    return { d1: /[dl]\s*1/.test(t), d2: /[dl]\s*2/.test(t), s1: /[sw]\s*1/.test(t), s2: /[sw]\s*2/.test(t) };
  const m = /^(\d)\s*[/x×+]\s*(\d)$/.exec(t);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return { d1: a >= 1, d2: a >= 2, s1: b >= 1, s2: b >= 2 };
  }
  return d ? { d1: true, d2: false, s1: false, s2: false } : { d1: true, d2: true, s1: true, s2: true };
}

const tak = (s: string) => /^(1|x|tak|t|yes|y|true|✓|v|\+|okl\w*|abs|pcv|pvc)$/i.test(s.trim()) || /^\d+([.,]\d+)?\s*mm$/i.test(s.trim()) || (liczba(s) > 0 && liczba(s) < 5);

const kluczMaterialu = (nazwa: string, gr: number) => `imp-${nazwa.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, "-")}-${gr}`;

export function importujListe(tekst: string, domyslnyMaterial = "Płyta 18 mm"): WynikImportu {
  const linie = tekst
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim());
  const uwagi: string[] = [];
  if (!linie.length) return { formatki: [], materialy: [], uwagi: ["Pusta lista."], pominieteWierszy: 0 };
  const sep = separator(linie);
  const wiersze = linie.map((l) => (sep === "  " ? l.trim().split(/\s{2,}/) : sep === " " ? l.trim().split(/\s+/) : rozdziel(l, sep)).map((c) => c.trim()));

  // Nagłówek: wiersz z co najmniej dwoma rozpoznanymi nazwami kolumn i bez dwóch liczb.
  let mapa = new Map<Kolumna, number>();
  let start = 0;
  for (let i = 0; i < Math.min(5, wiersze.length); i++) {
    const w = wiersze[i];
    const m = new Map<Kolumna, number>();
    w.forEach((c, j) => {
      const nazwa = c.replace(/\[.*?\]|\(.*?\)/g, "").trim();
      for (const [k, re] of NAGLOWKI) if (!m.has(k) && re.test(nazwa)) return void m.set(k, j);
    });
    if (m.has("dl") && m.has("szer") && w.filter((c) => !Number.isNaN(liczba(c))).length < 2) {
      mapa = m;
      start = i + 1;
      break;
    }
  }
  const bezNaglowka = !mapa.size;

  type Surowa = { dl: number; szer: number; ilosc: number; material: string; gr: number; nazwa: string; mebel: string; okl: Okleina; sloje: boolean | null };
  const surowe: Surowa[] = [];
  let pominiete = 0;
  for (const w of wiersze.slice(start)) {
    let dl: number, szer: number, ilosc: number, material: string, nazwa: string;
    let mebel = "";
    let gr = NaN;
    let okl: Okleina = { ...BEZ_OKLEINY };
    let sloje: boolean | null = null;
    if (bezNaglowka) {
      const liczby = w.map(liczba).map((n, j) => [n, j] as const).filter(([n]) => !Number.isNaN(n));
      const teksty = w.filter((c) => c && Number.isNaN(liczba(c)));
      if (liczby.length < 2) {
        pominiete++;
        continue;
      }
      [dl, szer] = [liczby[0][0], liczby[1][0]];
      ilosc = liczby[2] ? liczby[2][0] : 1;
      material = teksty.find((t) => /płyt|plyt|mdf|hdf|egger|kronospan|pfleiderer|swiss|dąb|dab|biał|bial|\d+\s*mm/i.test(t)) ?? domyslnyMaterial;
      nazwa = teksty.find((t) => t !== material) ?? "";
    } else {
      const get = (k: Kolumna) => (mapa.has(k) ? (w[mapa.get(k)!] ?? "") : "");
      dl = liczba(get("dl"));
      szer = liczba(get("szer"));
      if (Number.isNaN(dl) || Number.isNaN(szer)) {
        pominiete++;
        continue;
      }
      const il = liczba(get("ilosc"));
      ilosc = Number.isNaN(il) ? 1 : il;
      material = get("material") || domyslnyMaterial;
      nazwa = get("nazwa");
      mebel = get("mebel");
      gr = liczba(get("grubosc"));
      if (mapa.has("d1") || mapa.has("d2") || mapa.has("s1") || mapa.has("s2")) okl = { d1: tak(get("d1")), d2: tak(get("d2")), s1: tak(get("s1")), s2: tak(get("s2")) };
      else if (mapa.has("okleina")) okl = okleinaZTekstu(get("okleina"));
      if (mapa.has("sloje")) {
        const s = get("sloje").toLowerCase();
        sloje = /^(1|tak|t|yes|y|true|x|wzdłuż|wzdluz|dł|dl|l|pion|✓)$/.test(s) ? true : /^(0|nie|n|no|false|-|brak|dowolnie|obrót|obrot)$/.test(s) ? false : null;
      }
    }
    if (dl <= 0 || szer <= 0 || ilosc <= 0) {
      pominiete++;
      continue;
    }
    const grZNazwy = /(\d+([.,]\d)?)\s*mm/i.exec(material);
    if (Number.isNaN(gr) && grZNazwy) gr = Number(grZNazwy[1].replace(",", "."));
    surowe.push({ dl, szer, ilosc: Math.round(ilosc), material, gr: Number.isNaN(gr) ? (/hdf/i.test(material) ? 3 : 18) : gr, nazwa, mebel, okl, sloje });
  }
  if (!surowe.length) return { formatki: [], materialy: [], uwagi: ["Nie znaleziono wierszy z długością i szerokością."], pominieteWierszy: pominiete };

  // Centymetry? Wszystkie wymiary małe – płyta 18 mm nie ma formatek po 30 cm i mniej w całej liście.
  const max = Math.max(...surowe.map((s) => Math.max(s.dl, s.szer)));
  const skala = max < 300 ? 10 : 1;
  if (skala === 10) uwagi.push("Wymiary wyglądały na centymetry – przeliczono na milimetry.");

  const materialy = new Map<string, MaterialFormatki>();
  const formatki: Formatka[] = surowe.map((s, i) => {
    const klucz = /^hdf\b/i.test(s.material) && s.gr <= 4 ? HDF.klucz : kluczMaterialu(s.material, s.gr);
    if (!materialy.has(klucz))
      materialy.set(klucz, klucz === HDF.klucz ? { ...HDF, nazwa: s.material } : { klucz, nazwa: s.material, grubosc: s.gr, sloje: s.sloje ?? DREWNO_RE.test(s.material), rodzaj: s.gr <= 4 ? "hdf" : "plyta" });
    else if (s.sloje === true) materialy.get(klucz)!.sloje = true;
    return {
      id: `i${i + 1}`,
      mebel: s.mebel || "Import",
      element: s.nazwa || `Formatka ${i + 1}`,
      material: klucz,
      dl: Math.round(s.dl * skala),
      szer: Math.round(s.szer * skala),
      ilosc: s.ilosc,
      okleina: s.okl,
    };
  });
  if (pominiete) uwagi.push(`Pominięto ${pominiete} ${pominiete === 1 ? "wiersz" : "wierszy"} bez wymiarów.`);
  if (bezNaglowka) uwagi.push("Brak nagłówka – przyjęto: długość, szerokość, ilość w kolejności liczb.");
  return { formatki, materialy: Array.from(materialy.values()), uwagi, pominieteWierszy: pominiete };
}
