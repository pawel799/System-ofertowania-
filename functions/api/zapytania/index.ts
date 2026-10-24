/*
 * POST /api/zapytania – publiczny formularz: prośba o wycenę lub pomiar (strona oferty)
 * oraz wiadomość ze strony /kontakt.
 * Body: { typ: "wycena" | "pomiar" | "kontakt", imie, telefon?, email?, uwagi?, oferta?, wybor?, link? }
 *   - link = identyfikator linku oferty: zgłoszenie trafia do firmy, która wysłała tę ofertę;
 *   - f = id firmy z widżetu kuchni 3D na jej stronie (/osadz?f=…): do tej firmy, gdy widżet działa;
 *     bez linku i firmy (np. /kontakt, oferta demo) – do właściciela systemu (firma "main"),
 *   - wymagane imię i (telefon albo e-mail),
 *   - limit 5 zgłoszeń na godzinę z jednego IP (rate:zap:<ip>),
 *   - zapis w KV (binding OFFERS): zapytanie:<data>:<losowe id>, przechowywane 180 dni.
 *   - powiadomienie e-mail przez Resend, jeśli ustawiono RESEND_API_KEY i NOTIFY_EMAIL (patrz docs/zgloszenia.md).
 * Odczyt: GET z panelu (zalogowana firma widzi tylko swoje) – ostatnie 200 zgłoszeń, najnowsze pierwsze.
 * Zmiana / usuwanie: /api/zapytania/:id (PATCH { obsluzone }, DELETE).
 */
import { panel } from "../../_lib/auth";
import { notifyNewRequest } from "../../_lib/notify";
import { resolveEmbed } from "../../_lib/embed";
import { handle, HttpError, json, randomId, readJson, SLUG_RE, store, type Env, type KVNamespace } from "../../_lib/offers";
import { FIRM_ID_RE, firmUsers, getFirm, MAIN_FIRM, parseSlugValue, scoped } from "../../_lib/tenant";

/** Firma, do której trafia zgłoszenie (po linku oferty albo z widżetu na stronie firmy), i adresy do powiadomienia. */
async function targetFirm(env: Env, root: KVNamespace, link: unknown, f: unknown): Promise<{ firmId: string; to?: string[]; source?: string }> {
  if (typeof f === "string" && f && (f === MAIN_FIRM || FIRM_ID_RE.test(f))) {
    await resolveEmbed(env, f); // 404, gdy widżet wyłączony albo plan go nie obejmuje
    if (f === MAIN_FIRM) return { firmId: f, source: "osadzenie" };
    const owners = (await firmUsers(root, f)).filter((u) => u.role === "owner").map((u) => u.email);
    return { firmId: f, to: owners, source: "osadzenie" };
  }
  if (typeof link !== "string" || !SLUG_RE.test(link)) return { firmId: MAIN_FIRM };
  const raw = await root.get(`slug:${link}`);
  if (!raw) return { firmId: MAIN_FIRM };
  const { firmId } = parseSlugValue(raw);
  if (firmId === MAIN_FIRM) return { firmId };
  const firm = await getFirm(root, firmId);
  if (!firm || firm.status === "suspended") throw new HttpError(404, "not_found", "Ta oferta nie jest już dostępna.");
  const owners = (await firmUsers(root, firmId)).filter((u) => u.role === "owner").map((u) => u.email);
  return { firmId, to: owners };
}

const PER_IP_HOUR = 5;
const TTL = 180 * 24 * 3600;
const TYPES = ["wycena", "pomiar", "kontakt"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "");

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const body = await readJson(ctx.request);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid", "Oczekiwano obiektu.");
  const b = body as Record<string, unknown>;

  const typ = TYPES.find((t) => t === b.typ);
  if (!typ) throw new HttpError(400, "invalid", "Nieznany rodzaj zgłoszenia.");
  const imie = str(b.imie, 120);
  const telefon = str(b.telefon, 40);
  const email = str(b.email, 200);
  const uwagi = str(b.uwagi, 2000);
  if (!imie) throw new HttpError(400, "invalid", "Podaj imię.");
  if (email && !EMAIL.test(email)) throw new HttpError(400, "invalid", "Niepoprawny adres e-mail.");
  if (telefon && telefon.replace(/\D/g, "").length < 9) throw new HttpError(400, "invalid", "Niepoprawny numer telefonu.");
  if (!telefon && !email) throw new HttpError(400, "invalid", "Podaj telefon albo e-mail.");

  const ip = ctx.request.headers.get("cf-connecting-ip") ?? "unknown";
  const rateKey = `rate:zap:${ip}`;
  const n = Number((await kv.get(rateKey)) ?? 0);
  if (n >= PER_IP_HOUR) throw new HttpError(429, "limit", "Wysłano już kilka zgłoszeń. Spróbuj ponownie za godzinę.");
  await kv.put(rateKey, String(n + 1), { expirationTtl: 3600 });

  const target = await targetFirm(ctx.env, kv, b.link, b.f);
  const now = new Date().toISOString();
  const record = {
    typ,
    imie,
    telefon,
    email,
    uwagi,
    oferta: str(b.oferta, 60),
    wybor: str(b.wybor, 300),
    firma: str(b.firma, 200),
    ...(target.source ? { zrodlo: target.source } : {}),
    utworzono: now,
  };
  await scoped(kv, target.firmId).put(`zapytanie:${now}:${randomId(8)}`, JSON.stringify(record), { expirationTtl: TTL });
  const sending = notifyNewRequest(ctx.env, record, new URL(ctx.request.url).origin, target.to);
  if (ctx.waitUntil) ctx.waitUntil(sending);
  else await sending;
  return json({ ok: true }, 201);
});

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "zapytanie:", cursor });
    names.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && names.length < 5000);
  const latest = names.sort().reverse().slice(0, 200);
  const values = await Promise.all(latest.map((k) => kv.get(k)));
  const items = latest
    .map((k, i) => (values[i] ? { id: k.slice("zapytanie:".length), ...JSON.parse(values[i] as string) } : null))
    .filter(Boolean);
  return json({ items });
});
