/*
 * Baza płyt i blatów (K3D-PLYTY-01): wbudowane dekory (data/boards/*.json) i własna baza stolarni z CSV.
 *
 * Zasady (prawo):
 *   - tylko fakty: producent, kod, nazwa, struktura, typ, grubości, format; nazwy i kody wyłącznie opisowo,
 *   - kolor HEX dobrany ręcznie (poglądowy) + ogólne wykończenie → proceduralna struktura w 3D,
 *   - bez tekstur, zdjęć i logotypów producentów (textureUrl zostaje puste), bez palet RAL/NCS.
 *
 * Moduł bez importów w czasie działania (tylko typy) – używa go panel, kreator, Pages Functions
 * i testy `node --test` (natywne obcinanie typów w Node 24).
 */
import type { KoloryProjektu } from "./kolory";

export const PRODUCENCI = ["Egger", "Kronospan", "Inny"] as const;
export type Producent = (typeof PRODUCENCI)[number];

export const TYPY_PLYT = ["plyta", "blat", "kompakt", "front", "obrzeze"] as const;
export type TypPlyty = (typeof TYPY_PLYT)[number];
export const TYP_PLYTY_LABEL: Record<TypPlyty, string> = { plyta: "Płyta", blat: "Blat", kompakt: "Kompakt", front: "Front", obrzeze: "Obrzeże" };

export const WYKONCZENIA_PLYT = ["mat", "polysk", "drewno", "kamien", "beton", "inne"] as const;
export type WykonczeniePlyty = (typeof WYKONCZENIA_PLYT)[number];
export const WYKONCZENIE_PLYTY_LABEL: Record<WykonczeniePlyty, string> = { mat: "Mat", polysk: "Połysk", drewno: "Drewno", kamien: "Kamień", beton: "Beton", inne: "Inne" };

export type Board = {
  id: string;
  producer: Producent;
  /** Nazwa producenta, gdy producer === "Inny" (tekst opisowy). */
  producerName?: string;
  code: string;
  name: string;
  structure?: string;
  type: TypPlyty;
  /** Grubości w mm. */
  thicknesses: number[];
  /** Format arkusza [długość, szerokość] w mm. */
  format?: [number, number];
  /** Kolor poglądowy #rrggbb – dobrany ręcznie, nie z plików producenta. */
  hex: string;
  finish: WykonczeniePlyty;
  /** Zawsze puste – miejsce na tekstury z licencją w przyszłości. */
  textureUrl?: null;
  /** Cena netto za m² z CSV stolarni; brak = tryb „bez cen”. */
  priceM2?: number;
  source: "katalog" | "csv";
};

/* ---------- Wybór w projekcie (plan kuchni) ---------- */

export const SLOTY_PLYT = ["korpus", "front", "blat", "obrzeze"] as const;
export type SlotPlyty = (typeof SLOTY_PLYT)[number];
export const SLOT_PLYTY_LABEL: Record<SlotPlyty, string> = { korpus: "Korpus (boki i obudowa)", front: "Fronty", blat: "Blat", obrzeze: "Obrzeże" };
/** Typy z bazy, które pasują do miejsca w meblu. */
export const TYPY_SLOTU: Record<SlotPlyty, readonly TypPlyty[]> = {
  korpus: ["plyta"],
  front: ["front", "plyta"],
  blat: ["blat", "kompakt"],
  obrzeze: ["obrzeze"],
};

/** Płyta wybrana w projekcie – fakty z chwili wyboru (stara oferta nie zależy od późniejszej zmiany CSV). */
export type PlytaWybrana = {
  /** Id w bazie (katalog albo CSV). */
  ref: string;
  producer: Producent;
  producerName?: string;
  code: string;
  name: string;
  structure?: string;
  type: TypPlyty;
  hex: string;
  finish: WykonczeniePlyty;
  /** Wybrana grubość [mm]. */
  grubosc: number;
  priceM2?: number;
};
export type MaterialyPlyt = Partial<Record<SlotPlyty, PlytaWybrana>>;

/** Id koloru w systemie kolorów mebli (kolory.ts / katalogFirmy.ts) dla płyty z danego miejsca. */
export const plytaRef = (slot: SlotPlyty) => `brd:${slot}`;
export const PLYTA_REF_RE = /^brd:(korpus|front|blat|obrzeze)$/;
export function slotZRef(id: string): SlotPlyty | null {
  const m = PLYTA_REF_RE.exec(id);
  return m ? (m[1] as SlotPlyty) : null;
}

/** Grubości blatu: standard 28/36/38 mm, kompakt 12–16 mm (domyślnie 12). */
export const GRUBOSCI_BLATU = [28, 36, 38] as const;
export const GRUBOSCI_KOMPAKTU = [12, 13, 14, 15, 16] as const;
export const domyslnaGrubosc = (b: Pick<Board, "type" | "thicknesses">): number => {
  if (b.type === "kompakt") return b.thicknesses.includes(12) ? 12 : b.thicknesses[0] ?? 12;
  if (b.type === "blat") return b.thicknesses.includes(38) ? 38 : b.thicknesses[0] ?? 38;
  return b.thicknesses.includes(18) ? 18 : b.thicknesses[0] ?? 18;
};
/** Grubość korpusu, dla której liczą się wymiary (bryła 3D, rysunek, formatki). */
export const GRUBOSC_KORPUSU = 18;

/** Grubość blatu w mm; null = brak wyboru (stare oferty: wygląd jak dotąd). */
export function gruboscBlatu(plan: { plyty?: MaterialyPlyt } | null | undefined): number | null {
  const g = plan?.plyty?.blat?.grubosc;
  return typeof g === "number" && g > 0 ? g : null;
}

export const nazwaProducenta = (p: Pick<PlytaWybrana, "producer" | "producerName">) => (p.producer === "Inny" ? p.producerName || "Inny" : p.producer);

/** „Egger H1145 ST10 18 mm” – opis materiału w formatkach, PDF i ofercie. */
export function opisPlyty(p: Pick<PlytaWybrana, "producer" | "producerName" | "code" | "structure" | "grubosc">) {
  return `${nazwaProducenta(p)} ${p.code}${p.structure ? ` ${p.structure}` : ""} ${formatMm(p.grubosc)} mm`;
}
/** „Egger H1145 ST10 Dąb Bardolino naturalny, 18 mm” – opis z nazwą dekoru. */
export function opisPlytyPelny(p: PlytaWybrana) {
  return `${nazwaProducenta(p)} ${p.code}${p.structure ? ` ${p.structure}` : ""} ${p.name}, ${formatMm(p.grubosc)} mm`;
}
const formatMm = (n: number) => String(n).replace(".", ",");

export function wybierzPlyte(b: Board, grubosc?: number): PlytaWybrana {
  const g = grubosc && b.thicknesses.includes(grubosc) ? grubosc : domyslnaGrubosc(b);
  return {
    ref: b.id,
    producer: b.producer,
    ...(b.producerName ? { producerName: b.producerName } : {}),
    code: b.code,
    name: b.name,
    ...(b.structure ? { structure: b.structure } : {}),
    type: b.type,
    hex: b.hex,
    finish: b.finish,
    grubosc: g,
    ...(typeof b.priceM2 === "number" ? { priceM2: b.priceM2 } : {}),
  };
}

/**
 * Kolory projektu z płytami: płyta frontów zastępuje front oferty, płyta korpusu – wspólne boki.
 * Mebel z własnym kolorem (element.kolory) dalej ma swój (koloryMebla w kolory.ts).
 */
export function zPlytami<T extends { front: string; countertop: string }>(
  wybor: T,
  plan: { plyty?: MaterialyPlyt; kolory?: KoloryProjektu } | null | undefined,
  kolory?: KoloryProjektu | null,
): { wybor: T; kolory: KoloryProjektu | undefined } {
  const p = plan?.plyty;
  const k = kolory ?? plan?.kolory ?? undefined;
  if (!p || (!p.front && !p.korpus && !p.blat)) return { wybor, kolory: k ?? undefined };
  return {
    wybor: { ...wybor, ...(p.front ? { front: plytaRef("front") } : {}), ...(p.blat ? { countertop: plytaRef("blat") } : {}) },
    kolory: p.korpus ? { ...k, korpus: plytaRef("korpus") } : (k ?? undefined),
  };
}

/** Nota prawna w stopce kreatora i PDF. */
export const NOTA_PLYT = "Nazwy i kody dekorów należą do ich producentów i są użyte wyłącznie do opisu materiału. Kolory na ekranie są poglądowe.";

/* ---------- Walidacja ---------- */

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const MAX_PLYT_CSV = 2000;
const MAX_KOD = 32;
const MAX_NAZWA = 120;
const MAX_STRUKTURA = 16;

const czysc = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "");
const bezPl = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

export function idPlyty(b: Pick<Board, "producer" | "producerName" | "code" | "structure" | "type">) {
  const s = bezPl(`${b.producer === "Inny" ? b.producerName || "inny" : b.producer}-${b.code}-${b.structure ?? ""}-${b.type}`)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 64);
}

function producentZ(v: string): { producer: Producent; producerName?: string } | null {
  if (!v) return null;
  const n = bezPl(v);
  if (n === "egger") return { producer: "Egger" };
  if (n === "kronospan") return { producer: "Kronospan" };
  if (n === "inny") return { producer: "Inny" };
  return { producer: "Inny", producerName: v.slice(0, 40) };
}

function typZ(v: string): TypPlyty | null {
  const n = bezPl(v);
  if (n === "plyta" || n === "korpus") return "plyta";
  if (n === "blat") return "blat";
  if (n === "kompakt" || n === "compact") return "kompakt";
  if (n === "front") return "front";
  if (n === "obrzeze" || n === "okleina") return "obrzeze";
  return null;
}

/** Wykończenie z nazwy dekoru, gdy CSV go nie podaje. */
export function wykonczenieZNazwy(nazwa: string): WykonczeniePlyty {
  const n = bezPl(nazwa);
  if (/beton|cement|concrete/.test(n)) return "beton";
  if (/marmur|kamien|granit|lupek|trawertyn|terrazzo|marble|stone/.test(n)) return "kamien";
  if (/dab|orzech|jesion|buk|sosn|olch|wiaz|akacj|hikor|tek|drewn|wood|oak|walnut/.test(n)) return "drewno";
  if (/polysk|gloss|lustr/.test(n)) return "polysk";
  return "mat";
}

function wykonczenieZ(v: string): WykonczeniePlyty | null {
  if (!v) return null;
  const n = bezPl(v);
  return (WYKONCZENIA_PLYT as readonly string[]).includes(n) ? (n as WykonczeniePlyty) : null;
}

/** Liczba z polskim przecinkiem („45,50”). NaN, gdy to nie liczba. */
export function liczbaPl(v: string): number {
  const s = v.replace(/\s|zł|zl|pln/gi, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

function gruboscZ(v: string): number[] | string {
  // „28/38”, „28 38”, „28,38” – lista; „0,8” (obrzeże) – liczba z przecinkiem.
  const czesci = v
    .split(/[\/|+; ]+/)
    .flatMap((c) => (/^\d,\d$/.test(c) ? [c] : c.split(",")))
    .filter(Boolean);
  if (!czesci.length) return "brak grubości";
  const out: number[] = [];
  for (const c of czesci) {
    const n = liczbaPl(c.replace(/mm$/i, ""));
    if (!Number.isFinite(n) || n <= 0 || n > 100) return `zła grubość „${c}” (mm, np. 18 albo 28/38)`;
    if (!out.includes(n)) out.push(Math.round(n * 10) / 10);
  }
  return out.sort((a, b) => a - b);
}

function formatZ(v: string): [number, number] | null | string {
  if (!v) return null;
  const m = /^(\d{3,5})\s*[x×*]\s*(\d{3,5})$/i.exec(v.replace(/mm/gi, "").trim());
  if (!m) return `zły format „${v}” (np. 2800x2070)`;
  return [Number(m[1]), Number(m[2])];
}

function hexZ(v: string): string | null {
  if (!v) return "#c8c8c8";
  const s = v.startsWith("#") ? v : `#${v}`;
  return HEX_RE.test(s) ? s.toLowerCase() : null;
}

export type PlytaSurowa = {
  producent?: string;
  kod?: string;
  nazwa?: string;
  typ?: string;
  grubosci?: string;
  hex?: string;
  cena_m2?: string;
  struktura?: string;
  format?: string;
  wykonczenie?: string;
};

/** Jeden wiersz (CSV albo JSON) → płyta albo opis błędu po polsku. */
export function plytaZWiersza(r: PlytaSurowa, source: Board["source"] = "csv"): Board | string {
  const prod = producentZ(czysc(r.producent));
  if (!prod) return "brak producenta";
  const code = czysc(r.kod).toUpperCase();
  if (!code) return "brak kodu";
  if (code.length > MAX_KOD) return `kod dłuższy niż ${MAX_KOD} znaki`;
  const name = czysc(r.nazwa);
  if (!name) return "brak nazwy";
  if (name.length > MAX_NAZWA) return `nazwa dłuższa niż ${MAX_NAZWA} znaków`;
  const type = typZ(czysc(r.typ));
  if (!type) return `nieznany typ „${czysc(r.typ)}” (płyta, blat, kompakt, front, obrzeże)`;
  const gr = gruboscZ(czysc(r.grubosci));
  if (typeof gr === "string") return gr;
  if (type === "kompakt" && gr.some((g) => g < 12 || g > 16)) return "kompakt ma grubość od 12 do 16 mm";
  const hex = hexZ(czysc(r.hex));
  if (!hex) return `zły kolor „${czysc(r.hex)}” (#rrggbb)`;
  let priceM2: number | undefined;
  const cena = czysc(r.cena_m2);
  if (cena) {
    const n = liczbaPl(cena);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) return `zła cena „${cena}” (zł za m², np. 45,50)`;
    priceM2 = Math.round(n * 100) / 100;
  }
  const structure = czysc(r.struktura).toUpperCase() || undefined;
  if (structure && structure.length > MAX_STRUKTURA) return `struktura dłuższa niż ${MAX_STRUKTURA} znaków`;
  const format = formatZ(czysc(r.format));
  if (typeof format === "string") return format;
  const finishRaw = czysc(r.wykonczenie);
  const finish = wykonczenieZ(finishRaw);
  if (finishRaw && !finish) return `nieznane wykończenie „${finishRaw}” (mat, połysk, drewno, kamień, beton, inne)`;
  const b: Board = {
    id: "",
    ...prod,
    code,
    name,
    ...(structure ? { structure } : {}),
    type,
    thicknesses: gr,
    ...(format ? { format } : {}),
    hex,
    finish: finish ?? wykonczenieZNazwy(name),
    textureUrl: null,
    ...(priceM2 !== undefined ? { priceM2 } : {}),
    source,
  };
  b.id = idPlyty(b);
  return b;
}

/** Walidacja płyty z JSON (API, wbudowane pliki). Rzuca Error z opisem. */
export function walidujPlyte(v: unknown, source: Board["source"]): Board {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Płyta ma zły format.");
  const o = v as Record<string, unknown>;
  if (o.textureUrl !== undefined && o.textureUrl !== null) throw new Error("textureUrl musi być puste (bez tekstur producentów).");
  const gr = Array.isArray(o.thicknesses) ? o.thicknesses.join("/") : "";
  const r = plytaZWiersza(
    {
      producent: o.producer === "Inny" ? (typeof o.producerName === "string" && o.producerName.trim() ? o.producerName : "Inny") : (o.producer as string),
      kod: o.code as string,
      nazwa: o.name as string,
      typ: o.type as string,
      grubosci: gr,
      hex: o.hex as string,
      cena_m2: typeof o.priceM2 === "number" ? String(o.priceM2) : "",
      struktura: o.structure as string,
      format: Array.isArray(o.format) && o.format.length === 2 ? `${o.format[0]}x${o.format[1]}` : "",
      wykonczenie: o.finish as string,
    },
    source,
  );
  if (typeof r === "string") throw new Error(`Płyta ${typeof o.code === "string" ? o.code : ""}: ${r}.`);
  return r;
}

/** Płyta wybrana w planie (parseKuchnia). Rzuca Error. */
export function parsePlytaWybrana(v: unknown, slot: SlotPlyty): PlytaWybrana {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`${SLOT_PLYTY_LABEL[slot]}: zły format płyty.`);
  const o = v as Record<string, unknown>;
  const ref = czysc(o.ref);
  if (!ref || ref.length > 80) throw new Error(`${SLOT_PLYTY_LABEL[slot]}: brak id płyty.`);
  const grubosc = typeof o.grubosc === "number" && Number.isFinite(o.grubosc) && o.grubosc > 0 && o.grubosc <= 100 ? Math.round(o.grubosc * 10) / 10 : NaN;
  if (Number.isNaN(grubosc)) throw new Error(`${SLOT_PLYTY_LABEL[slot]}: zła grubość.`);
  const b = plytaZWiersza(
    {
      producent: o.producer === "Inny" ? (czysc(o.producerName) || "Inny") : czysc(o.producer),
      kod: czysc(o.code),
      nazwa: czysc(o.name),
      typ: czysc(o.type),
      grubosci: String(grubosc),
      hex: czysc(o.hex),
      cena_m2: typeof o.priceM2 === "number" ? String(o.priceM2) : "",
      struktura: czysc(o.structure),
      wykonczenie: czysc(o.finish),
    },
    "katalog",
  );
  if (typeof b === "string") throw new Error(`${SLOT_PLYTY_LABEL[slot]}: ${b}.`);
  if (!TYPY_SLOTU[slot].includes(b.type)) throw new Error(`${SLOT_PLYTY_LABEL[slot]}: typ „${TYP_PLYTY_LABEL[b.type]}” tu nie pasuje.`);
  return { ...wybierzPlyte(b, grubosc), ref, grubosc };
}

export function parseMaterialyPlyt(v: unknown): MaterialyPlyt | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw new Error("Płyty projektu mają zły format.");
  const o = v as Record<string, unknown>;
  const out: MaterialyPlyt = {};
  for (const s of SLOTY_PLYT) if (o[s] !== undefined && o[s] !== null) out[s] = parsePlytaWybrana(o[s], s);
  return Object.keys(out).length ? out : undefined;
}

/* ---------- CSV ---------- */

export const KOLUMNY_CSV = ["producent", "kod", "nazwa", "typ", "grubosci", "hex", "cena_m2"] as const;
const WYMAGANE = ["producent", "kod", "nazwa", "typ", "grubosci"] as const;
const DODATKOWE = ["struktura", "format", "wykonczenie"] as const;
type Kolumna = (typeof KOLUMNY_CSV)[number] | (typeof DODATKOWE)[number];

const ALIASY: Record<string, Kolumna> = {
  producent: "producent",
  producer: "producent",
  kod: "kod",
  code: "kod",
  nazwa: "nazwa",
  name: "nazwa",
  typ: "typ",
  type: "typ",
  grubosci: "grubosci",
  grubosc: "grubosci",
  thickness: "grubosci",
  hex: "hex",
  kolor: "hex",
  cena_m2: "cena_m2",
  cena: "cena_m2",
  "cena m2": "cena_m2",
  "cena_m²": "cena_m2",
  struktura: "struktura",
  structure: "struktura",
  format: "format",
  wykonczenie: "wykonczenie",
  finish: "wykonczenie",
};

/** Dzieli tekst CSV na wiersze i pola (cudzysłowy, "" w polu, nowe linie w cudzysłowie). */
export function dzielCsv(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
      continue;
    }
    if (c === '"' && f === "") q = true;
    else if (c === sep) {
      row.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  if (f !== "" || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}

const kolumnaZ = (h: string): Kolumna | undefined => ALIASY[bezPl(h.trim()).replace(/\s+/g, " ")];

export type BladWiersza = { wiersz: number; powod: string };
export type WynikCsv = {
  plyty: Board[];
  bledy: BladWiersza[];
  /** Błąd całego pliku (separator, brak kolumn) – wtedy nic się nie importuje. */
  blad?: string;
  separator?: ";" | ",";
};

/** CSV stolarni → płyty + błędne wiersze z numerem (numer jak w Excelu: nagłówek = 1). */
export function parseCsvPlyt(input: string): WynikCsv {
  const text = input.replace(/^﻿/, "");
  const pierwsza = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  if (!pierwsza) return { plyty: [], bledy: [], blad: "Plik jest pusty." };
  let sep: ";" | "," | undefined;
  let naglowek: (Kolumna | undefined)[] = [];
  for (const s of [";", ","] as const) {
    const h = dzielCsv(pierwsza, s)[0]?.map(kolumnaZ) ?? [];
    if (WYMAGANE.filter((k) => h.includes(k)).length >= 2) {
      sep = s;
      naglowek = h;
      break;
    }
  }
  if (!sep) {
    return { plyty: [], bledy: [], blad: `Nie rozpoznano kolumn. Pierwszy wiersz to nagłówek: ${KOLUMNY_CSV.join(";")} – separator średnik (;) albo przecinek (,).` };
  }
  const brak = WYMAGANE.filter((k) => !naglowek.includes(k));
  if (brak.length) return { plyty: [], bledy: [], separator: sep, blad: `Brak kolumn: ${brak.join(", ")}.` };
  const wiersze = dzielCsv(text, sep);
  const start = wiersze.findIndex((r) => r.some((c) => c.trim()));
  const plyty: Board[] = [];
  const bledy: BladWiersza[] = [];
  const ids = new Map<string, number>();
  for (let i = start + 1; i < wiersze.length; i++) {
    const r = wiersze[i];
    if (!r.some((c) => c.trim())) continue;
    const nr = i + 1;
    if (plyty.length >= MAX_PLYT_CSV) {
      bledy.push({ wiersz: nr, powod: `limit ${MAX_PLYT_CSV} płyt w jednym pliku` });
      continue;
    }
    const s: PlytaSurowa = {};
    naglowek.forEach((k, j) => {
      if (k) s[k] = r[j] ?? "";
    });
    const b = plytaZWiersza(s, "csv");
    if (typeof b === "string") {
      bledy.push({ wiersz: nr, powod: b });
      continue;
    }
    const juz = ids.get(b.id);
    if (juz) {
      bledy.push({ wiersz: nr, powod: `ta sama płyta co w wierszu ${juz}` });
      continue;
    }
    ids.set(b.id, nr);
    plyty.push(b);
  }
  return { plyty, bledy, separator: sep };
}

const poleCsv = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const liczbaCsv = (n: number) => String(n).replace(".", ",");

/** Eksport bazy do CSV (UTF-8 z BOM, separator ;) – ten sam format, co import. */
export function csvZPlyt(plyty: readonly Board[]): string {
  const kol = [...KOLUMNY_CSV, ...DODATKOWE];
  const lines = [kol.join(";")];
  for (const b of plyty) {
    const w: Record<Kolumna, string> = {
      producent: nazwaProducenta(b),
      kod: b.code,
      nazwa: b.name,
      typ: b.type === "plyta" ? "płyta" : b.type === "obrzeze" ? "obrzeże" : b.type,
      grubosci: b.thicknesses.map(liczbaCsv).join("/"),
      hex: b.hex,
      cena_m2: typeof b.priceM2 === "number" ? liczbaCsv(b.priceM2) : "",
      struktura: b.structure ?? "",
      format: b.format ? `${b.format[0]}x${b.format[1]}` : "",
      wykonczenie: b.finish,
    };
    lines.push(kol.map((k) => poleCsv(w[k])).join(";"));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/* ---------- Wyszukiwanie ---------- */

export function szukajPlyt(plyty: readonly Board[], q: { tekst?: string; producent?: Producent | ""; typy?: readonly TypPlyty[] }): Board[] {
  const t = bezPl(q.tekst ?? "").trim();
  const slowa = t ? t.split(/\s+/) : [];
  return plyty.filter((b) => {
    if (q.producent && b.producer !== q.producent) return false;
    if (q.typy?.length && !q.typy.includes(b.type)) return false;
    if (!slowa.length) return true;
    const h = bezPl(`${nazwaProducenta(b)} ${b.code} ${b.structure ?? ""} ${b.name}`);
    return slowa.every((s) => h.includes(s));
  });
}
