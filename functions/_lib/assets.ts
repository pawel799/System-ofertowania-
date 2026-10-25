/*
 * Modele 3D i pakiety kolorów RAL – wspólny kod Pages Functions.
 *
 * Magazyn:
 *   R2 (binding MODELS):  models/<id>/<wersja>.glb  -> plik modelu (po optymalizacji w przeglądarce)
 *   KV (binding OFFERS):  model:<id>    -> opis modelu (JSON, ModelMeta)
 *                         palette:<id>  -> pakiet RAL (JSON, Palette)
 *
 * Oznaczenia elementów (tags) to mapa: nazwa węzła w pliku GLB -> rola (front / blat / uchwyt).
 * Nazwy węzłów są unikalne, bo panel nadaje je przy wgrywaniu (modelOptimize.ts).
 */
import { FINISHES, PALETTE_ID_RE, parseRalFront, type Finish, type Palette } from "../../src/components/palettes";
import { ralByCode } from "../../src/components/ral";
import { ASSET_ID_RE, HttpError, listOffers, type Env, type KVNamespace, type Offer, type R2Bucket } from "./offers";

/* ---------- Modele 3D ---------- */

export const MODEL_ROLES = ["front", "blat", "uchwyt"] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export type ModelMeta = {
  id: string;
  name: string;
  /** Rozmiar pliku w bajtach. */
  size: number;
  /** Rośnie przy podmianie pliku; trafia do adresu pliku (?v=), więc cache przeglądarki jest bezpieczny. */
  version: number;
  /** Klucz pliku w R2. */
  file: string;
  tags: Record<string, ModelRole>;
  createdAt: string;
  updatedAt: string;
};

/** Limit pliku po optymalizacji. Pages Functions przyjmują do 100 MB, ale klient i tak musi to pobrać. */
export const MAX_MODEL_BYTES = 40 * 1024 * 1024;
const MAX_TAGS = 20_000;

export function bucket(env: Env): R2Bucket {
  if (!env.MODELS) throw new HttpError(503, "no_r2", "Brak bindingu R2 o nazwie MODELS (pliki modeli 3D).");
  return env.MODELS;
}

const bad = (message: string) => new HttpError(400, "invalid", message);

export function modelId(raw: string) {
  if (!ASSET_ID_RE.test(raw)) throw bad("Zły identyfikator modelu.");
  return raw;
}

export function cleanName(v: unknown, field: string, max = 120) {
  if (typeof v !== "string") throw bad(`Pole ${field} musi być tekstem.`);
  const s = v.replace(/\s+/g, " ").trim();
  if (!s) throw bad(`Pole ${field} jest wymagane.`);
  if (s.length > max) throw bad(`Pole ${field} jest za długie (max ${max}).`);
  return s;
}

export function validateTags(v: unknown): Record<string, ModelRole> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad("Oznaczenia muszą być obiektem.");
  const entries = Object.entries(v as Record<string, unknown>);
  if (entries.length > MAX_TAGS) throw bad(`Za dużo oznaczonych elementów (max ${MAX_TAGS}).`);
  const out: Record<string, ModelRole> = {};
  for (const [node, role] of entries) {
    if (!node || node.length > 300) throw bad("Nazwa elementu jest pusta albo za długa.");
    if (!MODEL_ROLES.includes(role as ModelRole)) throw bad(`Nieznana rola elementu: ${String(role)}.`);
    out[node] = role as ModelRole;
  }
  return out;
}

/** Sprawdza nagłówek pliku GLB (binarny glTF 2.0). */
export function isGlb(buf: ArrayBuffer) {
  if (buf.byteLength < 20) return false;
  const v = new DataView(buf);
  return v.getUint32(0, true) === 0x46546c67 && v.getUint32(4, true) === 2 && v.getUint32(8, true) === buf.byteLength;
}

export async function getModel(kv: KVNamespace, id: string): Promise<ModelMeta | null> {
  const raw = await kv.get(`model:${id}`);
  return raw ? (JSON.parse(raw) as ModelMeta) : null;
}

export async function putModel(kv: KVNamespace, m: ModelMeta) {
  await kv.put(`model:${m.id}`, JSON.stringify(m));
}

async function listJson<T>(kv: KVNamespace, prefix: string): Promise<T[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix, cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const raws = await Promise.all(keys.map((k) => kv.get(k)));
  return raws.filter((r): r is string => !!r).map((r) => JSON.parse(r) as T);
}

export async function listModels(kv: KVNamespace) {
  const list = await listJson<ModelMeta>(kv, "model:");
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const modelFileUrl = (m: ModelMeta) => `/api/models/${m.id}/file?v=${m.version}`;

/** To, czego potrzebuje strona klienta: adres pliku i role elementów. */
export const publicModel = (m: ModelMeta) => ({ id: m.id, name: m.name, url: modelFileUrl(m), tags: m.tags });

/* ---------- Pakiety RAL ---------- */

export function validatePalette(v: unknown, id: string): Palette {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad("Oczekiwano obiektu pakietu.");
  const p = v as Record<string, unknown>;
  if (!FINISHES.includes(p.finish as Finish)) throw bad("Nieznane wykończenie.");
  if (!Array.isArray(p.colors) || p.colors.length === 0) throw bad("Dodaj do pakietu co najmniej jeden kolor RAL.");
  if (p.colors.length > 300) throw bad("Za dużo kolorów w pakiecie (max 300).");
  const colors: string[] = [];
  for (const c of p.colors) {
    const ral = typeof c === "string" ? ralByCode(c) : undefined;
    if (!ral) throw bad(`Nieznany kod RAL: ${String(c)}.`);
    if (!colors.includes(ral.code)) colors.push(ral.code);
  }
  if (typeof p.delta !== "number" || !Number.isInteger(p.delta) || p.delta < -100_000 || p.delta > 1_000_000) {
    throw bad("Dopłata musi być liczbą całkowitą (zł).");
  }
  return { id, name: cleanName(p.name, "name", 80), finish: p.finish as Finish, colors, delta: p.delta };
}

export function paletteId(raw: string) {
  if (!PALETTE_ID_RE.test(raw)) throw bad("Zły identyfikator pakietu.");
  return raw;
}

export async function getPalette(kv: KVNamespace, id: string): Promise<Palette | null> {
  const raw = await kv.get(`palette:${id}`);
  return raw ? (JSON.parse(raw) as Palette) : null;
}

export async function listPalettes(kv: KVNamespace) {
  const list = await listJson<Palette>(kv, "palette:");
  return list.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/** Pakiety dla strony klienta; przy ukrytej cenie bez dopłat. */
export const publicPalettes = (list: Palette[], showPrice: boolean) =>
  list.map((p) => ({ id: p.id, name: p.name, finish: p.finish, colors: p.colors, delta: showPrice ? p.delta : 0 }));

/* ---------- Powiązania oferty ---------- */

/** Oferta może wskazywać tylko istniejący model i istniejący kolor z pakietu. */
export async function checkRefs(kv: KVNamespace, offer: Offer) {
  const ral = parseRalFront(offer.front);
  if (ral) {
    const p = await getPalette(kv, ral.paletteId);
    if (!p || !p.colors.includes(ral.code)) {
      throw bad(`Kolor RAL ${ral.code} nie jest już w żadnym pakiecie. Wybierz front jeszcze raz.`);
    }
  }
  if (offer.modelId && !(await getModel(kv, offer.modelId))) {
    throw bad("Wybrany model 3D nie istnieje (mógł zostać usunięty).");
  }
  if (offer.kuchnia) {
    const seen = new Set<string>();
    for (const e of offer.kuchnia.elementy) {
      if (!e.modelId || seen.has(e.modelId)) continue;
      seen.add(e.modelId);
      if (!(await getModel(kv, e.modelId))) {
        throw bad("Model 3D użyty w kreatorze kuchni nie istnieje (mógł zostać usunięty).");
      }
    }
  }
}

/** Oferty, które używają modelu albo pakietu (blokada usuwania). */
export async function offersUsing(kv: KVNamespace, test: (o: Offer) => boolean) {
  return (await listOffers(kv)).filter(test).map((o) => o.id);
}
