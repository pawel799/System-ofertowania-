/*
 * Wspólny kod Cloudflare Pages Functions dla ofert (API pod /api/...).
 * Nie eksportuje handlerów onRequest*, więc Cloudflare nie robi z niego trasy.
 *
 * Magazyn: Workers KV, binding OFFERS.
 *   offer:<klucz>  -> pełna oferta (JSON), klucz = numer oferty bez "/" (KUCH-2026_12)
 *   slug:<slug>    -> klucz oferty, żeby strona klienta znalazła ofertę po linku
 *   pinfail:<slug> -> licznik błędnych PIN-ów (wygasa po godzinie)
 */

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

export interface Env {
  OFFERS?: KVNamespace;
  /** Sekret (Settings → Variables and Secrets), nigdy w kodzie. */
  PANEL_TOKEN?: string;
}

export type Ctx = {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
};

/* ---------- Katalog: musi zgadzać się z frontStore / countertopStore / hardwareStore ---------- */

export const FRONT_IDS = ["dab-naturalny", "dab-bielony", "dab-wedzony", "kaszmir", "grafit"];
export const COUNTERTOP_IDS = ["kwarcyt-calacatta", "granit-absolute-black", "laminat-dab"];
export const HARDWARE_IDS = ["mosiadz", "czarny-mat", "push-to-open"];

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

export type OfferEvent = { t: string; k: (typeof EVENT_KINDS)[number]; x: string };

export type Offer = {
  id: string;
  title: string;
  client: string;
  greet: string | null;
  contact: string;
  layout: (typeof LAYOUTS)[number];
  base: number;
  front: string;
  countertop: string;
  hardware: string;
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
      if (e instanceof HttpError) return fail(e.status, e.code, e.message);
      console.error(e);
      return fail(500, "server_error", "Błąd serwera.");
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > 200_000) throw new HttpError(413, "too_large", "Za duże dane.");
  const text = await request.text();
  if (text.length > 200_000) throw new HttpError(413, "too_large", "Za duże dane.");
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

/* ---------- Autoryzacja panelu: nagłówek Authorization: Bearer <PANEL_TOKEN> ---------- */

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export async function requirePanel(ctx: Ctx) {
  const secret = ctx.env.PANEL_TOKEN;
  if (!secret) throw new HttpError(503, "no_token_configured", "Na serwerze nie ustawiono sekretu PANEL_TOKEN.");
  const header = ctx.request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  // Porównanie skrótów w stałym czasie (bez wczesnego wyjścia).
  const [a, b] = await Promise.all([sha256(given), sha256(secret)]);
  let diff = given ? 0 : 1;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) throw new HttpError(401, "unauthorized", "Brak lub zły token panelu.");
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
  const comment = o.comment === undefined || o.comment === null ? undefined : str(o.comment, "comment", 2000);
  return {
    id,
    title: str(o.title, "title", 200, { min: 1 }),
    client: str(o.client, "client", 200, { min: 1 }),
    greet,
    contact: str(o.contact, "contact", 200),
    layout: oneOf(o.layout, LAYOUTS, "layout"),
    base: Math.round(o.base * 100) / 100,
    front: oneOf(o.front, FRONT_IDS, "front"),
    countertop: oneOf(o.countertop, COUNTERTOP_IDS, "countertop"),
    hardware: oneOf(o.hardware, HARDWARE_IDS, "hardware"),
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
    greet: o.greet,
    front: o.front,
    countertop: o.countertop,
    hardware: o.hardware,
    showPrice: link.showPrice,
    comments: link.comments,
    ...(link.showPrice ? { base: o.base } : {}),
    expires: link.expires,
  };
}

/** Szuka aktywnego linku i sprawdza ważność oraz PIN. Rzuca HttpError z polskim komunikatem. */
export async function resolvePublic(ctx: Ctx): Promise<{ kv: KVNamespace; key: string; offer: Offer }> {
  const kv = store(ctx.env);
  const slug = param(ctx, "slug");
  const notFound = new HttpError(404, "not_found", "Nie znaleźliśmy tej oferty.");
  if (!SLUG_RE.test(slug)) throw notFound;
  const key = await kv.get(`slug:${slug}`);
  if (!key) throw notFound;
  const offer = await getOffer(kv, key);
  if (!offer || !offer.link || offer.link.slug !== slug) throw notFound;
  if (offer.link.expiresAt && Date.parse(offer.link.expiresAt) < Date.now()) {
    throw new HttpError(410, "expired", "Link do tej oferty wygasł.");
  }
  if (offer.link.pin) {
    const failKey = `pinfail:${slug}`;
    const fails = Number((await kv.get(failKey)) ?? 0);
    if (fails >= 10) throw new HttpError(429, "pin_locked", "Za dużo prób PIN-u. Spróbuj za godzinę.");
    const given = ctx.request.headers.get("x-offer-pin") ?? "";
    if (!given) throw new HttpError(401, "pin_required", "Ta oferta jest chroniona PIN-em.");
    if (given !== offer.link.pin) {
      await kv.put(failKey, String(fails + 1), { expirationTtl: 3600 });
      throw new HttpError(401, "pin_wrong", "Nieprawidłowy PIN.");
    }
  }
  return { kv, key, offer };
}
