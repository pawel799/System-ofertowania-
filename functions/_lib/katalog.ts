/*
 * Katalog materiałów firmy – KV (firma przez scoped()):  catalog:<id> -> KatalogPozycja (JSON).
 * Wzorzec jak pakiety RAL (assets.ts). Lista jest mała (limit planu), więc wystarczy skan prefiksu.
 */
import {
  KATALOG_ID_RE,
  KATALOG_JEDNOSTKI,
  KATALOG_RODZAJE,
  KATALOG_WYKONCZENIA,
  parseKatRef,
  publicznaPozycja,
  RODZAJ_ROLI,
  snapshotMaterialow,
  type KatalogJednostka,
  type KatalogPozycja,
  type KatalogRodzaj,
  type KatalogWykonczenie,
  type MaterialySnapshot,
  type RolaMaterialu,
} from "../../src/components/katalogFirmy";
import { cleanName, listPalettes } from "./assets";
import { HttpError, listOffers, type KVNamespace, type Offer } from "./offers";

const bad = (message: string) => new HttpError(400, "invalid", message);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function katalogId(raw: string) {
  if (!KATALOG_ID_RE.test(raw)) throw bad("Zły identyfikator pozycji katalogu.");
  return raw;
}

const opcjonalnyTekst = (v: unknown, pole: string, max: number) => {
  if (v === undefined || v === null || v === "") return undefined;
  return cleanName(v, pole, max);
};

export function validateKatalog(v: unknown, id: string): KatalogPozycja {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad("Oczekiwano obiektu pozycji katalogu.");
  const p = v as Record<string, unknown>;
  if (!KATALOG_RODZAJE.includes(p.kind as KatalogRodzaj)) throw bad("Nieznany rodzaj pozycji.");
  if (typeof p.color !== "string" || !HEX_RE.test(p.color)) throw bad("Kolor podaj jako #rrggbb.");
  if (typeof p.delta !== "number" || !Number.isInteger(p.delta) || p.delta < -100_000 || p.delta > 1_000_000) {
    throw bad("Dopłata musi być liczbą całkowitą (zł), od −100 000 do 1 000 000.");
  }
  if (p.finish !== undefined && p.finish !== null && p.finish !== "" && !KATALOG_WYKONCZENIA.includes(p.finish as KatalogWykonczenie)) {
    throw bad("Nieznane wykończenie.");
  }
  if (p.unit !== undefined && p.unit !== null && p.unit !== "" && !KATALOG_JEDNOSTKI.includes(p.unit as KatalogJednostka)) {
    throw bad("Nieznana jednostka.");
  }
  let thicknessMm: number | undefined;
  if (p.thicknessMm !== undefined && p.thicknessMm !== null && p.thicknessMm !== "") {
    if (typeof p.thicknessMm !== "number" || !Number.isFinite(p.thicknessMm) || p.thicknessMm <= 0 || p.thicknessMm > 200) {
      throw bad("Grubość podaj w mm (0–200).");
    }
    thicknessMm = Math.round(p.thicknessMm * 10) / 10;
  }
  let ral: string | undefined;
  if (p.ral !== undefined && p.ral !== null && p.ral !== "") {
    if (typeof p.ral !== "string" || !/^\d{4}$/.test(p.ral)) throw bad("Kod RAL to cztery cyfry, np. 9010.");
    ral = p.ral;
  }
  if (typeof p.active !== "boolean") throw bad("Pole active musi być true albo false.");
  const sort = typeof p.sort === "number" && Number.isFinite(p.sort) ? Math.round(p.sort) : undefined;
  const kind = p.kind as KatalogRodzaj;
  return {
    id,
    kind,
    name: cleanName(p.name, "name", 120),
    ...(opcjonalnyTekst(p.producer, "producer", 80) ? { producer: opcjonalnyTekst(p.producer, "producer", 80) } : {}),
    ...(opcjonalnyTekst(p.collection, "collection", 80) ? { collection: opcjonalnyTekst(p.collection, "collection", 80) } : {}),
    ...(thicknessMm !== undefined ? { thicknessMm } : {}),
    ...(p.finish ? { finish: p.finish as KatalogWykonczenie } : {}),
    color: (p.color as string).toLowerCase(),
    ...(ral ? { ral } : {}),
    delta: p.delta,
    ...(p.unit ? { unit: p.unit as KatalogJednostka } : {}),
    active: p.active,
    ...(kind === "uchwyt" && p.bezUchwytu === true ? { bezUchwytu: true } : {}),
    ...(sort !== undefined ? { sort } : {}),
  };
}

export async function getKatalogPozycja(kv: KVNamespace, id: string): Promise<KatalogPozycja | null> {
  const raw = await kv.get(`catalog:${id}`);
  return raw ? (JSON.parse(raw) as KatalogPozycja) : null;
}

export async function listKatalog(kv: KVNamespace): Promise<KatalogPozycja[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "catalog:", cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const raws = await Promise.all(keys.map((k) => kv.get(k)));
  return raws
    .filter((r): r is string => !!r)
    .map((r) => JSON.parse(r) as KatalogPozycja)
    .sort((a, b) => a.kind.localeCompare(b.kind) || (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "pl"));
}

const ROLE: RolaMaterialu[] = ["front", "countertop", "hardware"];

/** Oferty, które używają pozycji (front / blat / okucia albo snapshot) – blokada usuwania i wyłączania. */
export async function ofertyZPozycja(kv: KVNamespace, id: string) {
  const ref = `cat:${id}`;
  return (await listOffers(kv)).filter((o) => o.front === ref || o.countertop === ref || o.hardware === ref).map((o) => o.id);
}

/**
 * Oferta może wskazać tylko istniejącą, aktywną pozycję właściwego rodzaju (front ← płyta frontu, blat ← blat,
 * okucia ← uchwyt). Pozycja nieaktywna przechodzi tylko wtedy, gdy była już w tej ofercie wcześniej.
 */
export async function checkKatalogRefs(kv: KVNamespace, offer: Offer, poprzednia?: Offer | null) {
  for (const rola of ROLE) {
    const id = parseKatRef(offer[rola]);
    if (!id) continue;
    const p = await getKatalogPozycja(kv, id);
    const nazwa = rola === "front" ? "Front" : rola === "countertop" ? "Blat" : "Okucia";
    if (!p) throw bad(`${nazwa}: tej pozycji nie ma już w katalogu. Wybierz materiał jeszcze raz.`);
    if (p.kind !== RODZAJ_ROLI[rola]) throw bad(`${nazwa}: pozycja „${p.name}” ma inny rodzaj w katalogu.`);
    if (!p.active && poprzednia?.[rola] !== offer[rola]) throw bad(`${nazwa}: pozycja „${p.name}” jest wyłączona w katalogu.`);
  }
}

/** Snapshot nazw i dopłat w chwili zapisu (patrz katalogFirmy.ts). */
export async function snapshotOferty(kv: KVNamespace, offer: Offer): Promise<MaterialySnapshot> {
  const [palettes, katalog] = await Promise.all([listPalettes(kv), listKatalog(kv)]);
  return snapshotMaterialow(offer, { palettes, katalog });
}

/** Katalog dla strony klienta: aktywne pozycje trzech ról + te ze snapshotu (nawet wyłączone). */
export function publicznyKatalog(list: KatalogPozycja[], offer: Pick<Offer, "front" | "countertop" | "hardware">, showPrice: boolean) {
  const wybrane = new Set(ROLE.map((r) => parseKatRef(offer[r])).filter(Boolean));
  const role = new Set<KatalogRodzaj>(Object.values(RODZAJ_ROLI));
  return list.filter((p) => role.has(p.kind) && (p.active || wybrane.has(p.id))).map((p) => publicznaPozycja(p, showPrice));
}
