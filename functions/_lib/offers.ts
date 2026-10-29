/*
 * Wspólny kod Cloudflare Pages Functions dla ofert (API pod /api/...).
 * Nie eksportuje handlerów onRequest*, więc Cloudflare nie robi z niego trasy.
 *
 * Magazyn: Workers KV, binding OFFERS.
 *   offer:<klucz>  -> pełna oferta (JSON), klucz = numer oferty bez "/" (KUCH-2026_12)
 *   slug:<slug>    -> klucz oferty, żeby strona klienta znalazła ofertę po linku
 *   pinfail:<slug> -> licznik błędnych PIN-ów (wygasa po godzinie)
 *   authfail:<ip>  -> licznik błędnych tokenów panelu (wygasa po 15 min)
 *   openseen:<slug>:<ip> -> otwarcie już policzone (30 min), żeby odświeżanie nie zaśmiecało historii
 */

import { parseTypProjektu, type TypProjektu } from "../../src/lib/projekt";
import type { PlanKuchni } from "../../src/lib/kuchnia";
import { parseKuchnia } from "../../src/lib/kuchnia";
import type { ModulItem } from "../../src/lib/modul";
import { validateModuly } from "./modul";
import { COUNTERTOPS, FRONTS, HARDWARE } from "../../src/components/catalog";
import { RAL_FRONT_RE } from "../../src/components/palettes";
import { KAT_REF_RE, type MaterialySnapshot } from "../../src/components/katalogFirmy";

/* Minimalne typy runtime'u Cloudflare (bez dodatkowej paczki z typami). */
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/* Minimalne typy R2 (pliki modeli 3D). */
export interface R2ObjectBody {
  body: ReadableStream;
  size: number;
  httpEtag: string;
}

export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

export interface Env {
  OFFERS?: KVNamespace;
  /** Sekret (Settings → Variables and Secrets), nigdy w kodzie. */
  PANEL_TOKEN?: string;
  /** Bucket R2 na pliki modeli 3D (binding MODELS). */
  MODELS?: R2Bucket;
  /** Własna domena (Cloudflare for SaaS): token API (sekret), strefa i cel CNAME. Opcjonalne. */
  CF_API_TOKEN?: string;
  CF_ZONE_ID?: string;
  CF_CNAME_TARGET?: string;
  /** Powiadomienia o zgłoszeniach (opcjonalne): klucz API Resend, adres(y) odbiorcy, nadawca. */
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  NOTIFY_FROM?: string;
  /** Tylko do testów: inny adres API Cloudflare. */
  CF_API_BASE?: string;
  /** Liczba iteracji PBKDF2 dla nowych haseł (domyślnie 100 000 – maksimum w Workers). */
  PASSWORD_ITERATIONS?: string;
  /** Płatności online (docs/platnosci.md): operator i sekret podpisu webhooka. Bez nich – faktury ręcznie. */
  BILLING_PROVIDER?: string;
  BILLING_WEBHOOK_SECRET?: string;
  /** Cloudflare Turnstile (sekret) – weryfikacja anty-bot przy rejestracji i logowaniu. Bez niego – wyłączona. */
  TURNSTILE_SECRET_KEY?: string;
}

export type Ctx = {
  request: Request;
  waitUntil?: (p: Promise<unknown>) => void;
  env: Env;
  params: Record<string, string | string[]>;
};

/* ---------- Katalog: ten sam moduł co strona (src/components/catalog.ts), listy nie mogą się rozjechać ---------- */

export const FRONT_IDS = FRONTS.map((f) => f.id);
export const COUNTERTOP_IDS = COUNTERTOPS.map((c) => c.id);
export const HARDWARE_IDS = HARDWARE.map((h) => h.id);

const STATUSES = ["szkic", "wyslany", "otwarty", "poprawki", "zaakceptowany"] as const;
const CHANNELS = ["email", "sms", "messenger"] as const;
const LAYOUTS = ["I", "L", "U", "wyspa"] as const;
const EVENT_KINDS = ["create", "send", "open", "comment", "accept", "revoke", "edit"] as const;

type Status = (typeof STATUSES)[number];

export type OfferLink = {
  slug: string;
  days: number;
  expires: string;
  expiresAt?: string;
  pin: string | null;
  comments: boolean;
  showPrice: boolean;
  channel: (typeof CHANNELS)[number];
  views: number;
};

export type CompanyData = {
  name: string;
  nip: string;
  regon: string;
  krs: string;
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  vatStatus: string;
};

const COMPANY_LIMITS: Record<keyof CompanyData, number> = {
  name: 300,
  nip: 20,
  regon: 20,
  krs: 20,
  legalForm: 200,
  street: 200,
  postalCode: 12,
  city: 120,
  vatStatus: 40,
};

const CLIENT_TYPES = ["private", "company"] as const;

export type OfferEvent = { t: string; k: (typeof EVENT_KINDS)[number]; x: string };

export type Offer = {
  id: string;
  title: string;
  client: string;
  greet: string | null;
  clientType?: (typeof CLIENT_TYPES)[number];
  company?: CompanyData;
  contactPerson?: string;
  contact: string;
  layout: (typeof LAYOUTS)[number];
  base: number;
  front: string;
  countertop: string;
  hardware: string;
  /** Wgrany model 3D (id z /api/models); brak = kuchnia demo. */
  modelId?: string;
  /** Moduły parametryczne (szafki na wymiar); cenę liczy serwer z cennika firmy. */
  moduly?: ModulItem[];
  /**
   * Układ z kreatora kuchni (rzut + elementy). Cena i lista modułów są wtedy
   * wyliczane na serwerze z tego planu, a nie z pól base/moduly przysyłanych przez panel.
   */
  kuchnia?: PlanKuchni;
  /** Co projektujemy (kuchnia, szafa, komoda…) – src/lib/projekt.ts. Brak = kuchnia. */
  projekt?: TypProjektu;
  /** Nazwy i dopłaty materiałów z chwili zapisu (liczy serwer – katalogFirmy.ts). Stare oferty go nie mają. */
  materialy?: MaterialySnapshot;
  status: Status;
  link: OfferLink | null;
  comment?: string;
  events: OfferEvent[];
  createdAt?: string;
  updatedAt?: string;
};

/* ---------- Odpowiedzi ---------- */

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export const fail = (status: number, error: string, message: string) => json({ error, message }, status);

export function store(env: Env): KVNamespace {
  if (!env.OFFERS) throw new HttpError(503, "no_storage", "Brak bindingu KV o nazwie OFFERS.");
  return env.OFFERS;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Dodatkowe pola w odpowiedzi JSON (np. marka firmy na ekranie PIN-u). */
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/** Opakowuje handler: HttpError -> JSON z kodem, reszta -> 500. */
export function handle(fn: (ctx: Ctx) => Promise<Response>) {
  return async (ctx: Ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message, ...e.extra }, e.status);
      console.error(e);
      return fail(500, "server_error", "Błąd serwera.");
    }
  };
}

export async function readJson(request: Request, max = 200_000): Promise<unknown> {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > max) throw new HttpError(413, "too_large", "Za duże dane.");
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, "too_large", "Za duże dane.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json", "Niepoprawny JSON.");
  }
}

export const param = (ctx: Ctx, name: string) => {
  const v = ctx.params[name];
  return Array.isArray(v) ? v.join("/") : (v ?? "");
};

/* ---------- Kod dostępu administratora: nagłówek Authorization: Bearer <PANEL_TOKEN> ----------
 * Zwykłe konta firm logują się e-mailem i hasłem (functions/_lib/auth.ts, requirePanel).
 * Kod PANEL_TOKEN zostaje jako wejście administratora systemu (firma "main", zarządzanie firmami).
 */

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** Po tylu błędnych tokenach z jednego IP panel jest blokowany na AUTH_LOCK_SECONDS. */
const AUTH_FAIL_LIMIT = 20;
const AUTH_LOCK_SECONDS = 15 * 60;

/** Token z nagłówka Authorization (pusty = brak). */
export function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/** Sprawdza kod administratora. Rzuca 401/429; brak sekretu na serwerze = kod wyłączony. */
export async function verifyPanelToken(ctx: Ctx) {
  const secret = ctx.env.PANEL_TOKEN;
  if (!secret) throw new HttpError(401, "unauthorized", "Kod dostępu administratora jest wyłączony. Zaloguj się e-mailem i hasłem.");
  // Ochrona przed zgadywaniem tokenu: licznik błędnych prób na IP (KV, wygasa po 15 min).
  // Sprawdzany PRZED porównaniem, żeby zablokowany adres nie mógł dalej zgadywać.
  const kv = ctx.env.OFFERS;
  const failKey = `authfail:${ctx.request.headers.get("cf-connecting-ip") ?? "unknown"}`;
  const fails = kv ? Number((await kv.get(failKey)) ?? 0) : 0;
  if (fails >= AUTH_FAIL_LIMIT) {
    throw new HttpError(429, "auth_locked", "Za dużo prób z błędnym tokenem. Spróbuj ponownie za 15 minut.");
  }
  const given = bearerToken(ctx.request);
  // Porównanie skrótów w stałym czasie (bez wczesnego wyjścia).
  const [a, b] = await Promise.all([sha256(given), sha256(secret)]);
  let diff = given ? 0 : 1;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) {
    if (kv) await kv.put(failKey, String(fails + 1), { expirationTtl: AUTH_LOCK_SECONDS });
    throw new HttpError(401, "unauthorized", "Brak lub zły token panelu.");
  }
}

/* ---------- Identyfikatory ---------- */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Losowy identyfikator base62 (crypto, bez przewidywalnej kolejności). */
export function randomId(length = 12) {
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length; i++) {
      const byte = buf[i];
      // 248 = 4 * 62: odrzucamy resztę, żeby rozkład był równy.
      if (byte < 248 && out.length < length) out.push(BASE62[byte % 62]);
    }
  }
  return out.join("");
}

export const SLUG_RE = /^[A-Za-z0-9]{10,32}$/;
/** Id modelu 3D i pakietu RAL (losowe, base62). */
export const ASSET_ID_RE = /^[A-Za-z0-9]{10,32}$/;
export const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Klucz oferty w URL i KV: numer oferty bez znaków spoza [A-Za-z0-9_-]. */
export const offerKey = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_");

/* ---------- Walidacja ---------- */

const bad = (message: string) => new HttpError(400, "invalid", message);

function str(v: unknown, field: string, max: number, opts: { min?: number } = {}) {
  if (typeof v !== "string") throw bad(`Pole ${field} musi być tekstem.`);
  const s = v.trim();
  if (s.length < (opts.min ?? 0)) throw bad(`Pole ${field} jest wymagane.`);
  if (s.length > max) throw bad(`Pole ${field} jest za długie (max ${max}).`);
  return s;
}

function oneOf<T extends string>(v: unknown, list: readonly T[], field: string): T {
  if (typeof v !== "string" || !list.includes(v as T)) throw bad(`Nieznana wartość pola ${field}.`);
  return v as T;
}

function bool(v: unknown, field: string) {
  if (typeof v !== "boolean") throw bad(`Pole ${field} musi być true/false.`);
  return v;
}

function int(v: unknown, field: string, min: number, max: number) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw bad(`Pole ${field} poza zakresem.`);
  return v;
}

function validateLink(v: unknown): OfferLink | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "object") throw bad("Pole link ma zły format.");
  const l = v as Record<string, unknown>;
  const slug = str(l.slug, "link.slug", 32);
  if (!SLUG_RE.test(slug)) throw bad("Link musi mieć losowy identyfikator 10–32 znaków [A-Za-z0-9].");
  let expiresAt: string | undefined;
  if (l.expiresAt !== undefined) {
    expiresAt = str(l.expiresAt, "link.expiresAt", 40);
    if (Number.isNaN(Date.parse(expiresAt))) throw bad("Pole link.expiresAt musi być datą ISO.");
  }
  const pin = l.pin === null ? null : str(l.pin, "link.pin", 8);
  if (pin !== null && !/^\d{4,8}$/.test(pin)) throw bad("PIN musi mieć 4–8 cyfr.");
  return {
    slug,
    days: int(l.days, "link.days", 1, 365),
    expires: str(l.expires, "link.expires", 40),
    ...(expiresAt ? { expiresAt } : {}),
    pin,
    comments: bool(l.comments, "link.comments"),
    showPrice: bool(l.showPrice, "link.showPrice"),
    channel: oneOf(l.channel, CHANNELS, "link.channel"),
    views: int(l.views, "link.views", 0, 1_000_000),
  };
}

function validateCompany(v: unknown): CompanyData | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw bad("Pole company ma zły format.");
  const c = v as Record<string, unknown>;
  const out = {} as CompanyData;
  for (const key of Object.keys(COMPANY_LIMITS) as (keyof CompanyData)[]) {
    out[key] = c[key] === undefined || c[key] === null ? "" : str(c[key], `company.${key}`, COMPANY_LIMITS[key]);
  }
  return out;
}

export function validateOffer(input: unknown): Offer {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw bad("Oczekiwano obiektu oferty.");
  const o = input as Record<string, unknown>;
  const id = str(o.id, "id", 40, { min: 1 });
  if (!/^[A-Za-z0-9][A-Za-z0-9 _\-/.]*$/.test(id)) throw bad("Numer oferty ma niedozwolone znaki.");
  if (typeof o.base !== "number" || !Number.isFinite(o.base) || o.base <= 0 || o.base > 10_000_000) {
    throw bad("Cena bazowa musi być liczbą od 1 do 10 000 000.");
  }
  if (!Array.isArray(o.events) || o.events.length > 500) throw bad("Pole events ma zły format.");
  const events = o.events.map((e, i) => {
    if (!e || typeof e !== "object") throw bad(`Zdarzenie ${i} ma zły format.`);
    const ev = e as Record<string, unknown>;
    return { t: str(ev.t, "events.t", 40), k: oneOf(ev.k, EVENT_KINDS, "events.k"), x: str(ev.x, "events.x", 300) };
  });
  const greet = o.greet === null || o.greet === undefined ? null : str(o.greet, "greet", 60);
  const clientType = o.clientType === undefined || o.clientType === null ? undefined : oneOf(o.clientType, CLIENT_TYPES, "clientType");
  const company = validateCompany(o.company);
  const contactPerson =
    o.contactPerson === undefined || o.contactPerson === null ? undefined : str(o.contactPerson, "contactPerson", 200);
  const comment = o.comment === undefined || o.comment === null ? undefined : str(o.comment, "comment", 2000);
  // Front z katalogu albo kolor z pakietu RAL ("ral:<pakiet>:<kod>"; istnienie pakietu sprawdza checkRefs).
  // Pozycja katalogu firmy ("cat:<id>"): istnienie i rodzaj sprawdza checkKatalogRefs.
  const front =
    typeof o.front === "string" && (RAL_FRONT_RE.test(o.front) || KAT_REF_RE.test(o.front)) ? o.front : oneOf(o.front, FRONT_IDS, "front");
  const countertop = typeof o.countertop === "string" && KAT_REF_RE.test(o.countertop) ? o.countertop : oneOf(o.countertop, COUNTERTOP_IDS, "countertop");
  const hardware = typeof o.hardware === "string" && KAT_REF_RE.test(o.hardware) ? o.hardware : oneOf(o.hardware, HARDWARE_IDS, "hardware");
  let modelId: string | undefined;
  if (o.modelId !== undefined && o.modelId !== null && o.modelId !== "") {
    modelId = str(o.modelId, "modelId", 32);
    if (!ASSET_ID_RE.test(modelId)) throw bad("Zły identyfikator modelu 3D.");
  }
  let kuchnia: PlanKuchni | undefined;
  if (o.kuchnia !== undefined && o.kuchnia !== null) {
    try {
      kuchnia = parseKuchnia(o.kuchnia);
    } catch (e) {
      throw bad(e instanceof Error ? e.message : "Zły plan kuchni.");
    }
  }
  // Oferta z kreatora: pozycje i cenę liczy serwer z planu (zCenaKuchni), więc moduły z panelu pomijamy.
  // Wcześniej szły przez limity szafki na wymiar (4–120 cm) i odrzucały np. komodę 141 cm albo blat 240 cm z biblioteki.
  const moduly = kuchnia?.elementy.length ? undefined : validateModuly(o.moduly);
  if (o.projekt !== undefined && o.projekt !== null && !parseTypProjektu(o.projekt)) throw bad("Nieznany rodzaj projektu.");
  const projekt = parseTypProjektu(o.projekt);
  return {
    id,
    title: str(o.title, "title", 200, { min: 1 }),
    client: str(o.client, "client", 200, { min: 1 }),
    greet,
    ...(clientType ? { clientType } : {}),
    ...(company ? { company } : {}),
    ...(contactPerson !== undefined ? { contactPerson } : {}),
    contact: str(o.contact, "contact", 200),
    layout: oneOf(o.layout, LAYOUTS, "layout"),
    base: Math.round(o.base * 100) / 100,
    front,
    countertop,
    hardware,
    ...(modelId ? { modelId } : {}),
    ...(moduly && moduly.length ? { moduly } : {}),
    ...(kuchnia ? { kuchnia } : {}),
    ...(projekt ? { projekt } : {}),
    status: oneOf(o.status, STATUSES, "status"),
    link: validateLink(o.link),
    ...(comment !== undefined ? { comment } : {}),
    events,
  };
}

/* ---------- KV ---------- */

export async function getOffer(kv: KVNamespace, key: string): Promise<Offer | null> {
  const raw = await kv.get(`offer:${key}`);
  return raw ? (JSON.parse(raw) as Offer) : null;
}

export async function putOffer(kv: KVNamespace, offer: Offer) {
  await kv.put(`offer:${offerKey(offer.id)}`, JSON.stringify(offer));
}

/** Rezerwuje slug linku dla oferty; 409, jeśli należy do innej oferty. */
export async function claimSlug(kv: KVNamespace, slug: string, key: string) {
  const owner = await kv.get(`slug:${slug}`);
  if (owner && owner !== key) throw new HttpError(409, "slug_taken", "Ten link jest już zajęty. Utwórz link ponownie.");
  if (owner !== key) await kv.put(`slug:${slug}`, key);
}

export async function listOffers(kv: KVNamespace): Promise<Offer[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "offer:", cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const raws = await Promise.all(keys.map((k) => kv.get(k)));
  return raws
    .filter((r): r is string => !!r)
    .map((r) => JSON.parse(r) as Offer)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/* ---------- Czas w zdarzeniach (jak w panelu: "9 paź 14:05", czas polski) ---------- */

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

export function stampNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${Number(get("day"))} ${MONTHS[Number(get("month")) - 1]} ${get("hour")}:${get("minute")}`;
}

/* ---------- Publiczny widok oferty (tylko to, czego potrzebuje strona klienta) ---------- */

export function publicView(o: Offer) {
  const link = o.link!;
  return {
    id: o.id,
    title: o.title,
    // Tylko nazwa, którą strona klienta pokazuje w "Oferta dla: …" (bez kontaktu, NIP-u, adresu).
    who: o.clientType === "company" ? o.contactPerson || o.client : o.client,
    front: o.front,
    countertop: o.countertop,
    hardware: o.hardware,
    showPrice: link.showPrice,
    comments: link.comments,
    ...(link.showPrice ? { base: o.base } : {}),
    expires: link.expires,
    ...(o.kuchnia ? { kuchnia: o.kuchnia } : {}),
    // Snapshot nazw i dopłat; przy ukrytej cenie bez kwot.
    ...(o.materialy ? { materialy: link.showPrice ? o.materialy : ukryjDoplaty(o.materialy) } : {}),
  };
}

function ukryjDoplaty(m: MaterialySnapshot): MaterialySnapshot {
  return { ...m, front: { ...m.front, delta: 0 }, countertop: { ...m.countertop, delta: 0 }, hardware: { ...m.hardware, delta: 0 } };
}
