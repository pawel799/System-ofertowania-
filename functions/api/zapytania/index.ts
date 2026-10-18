/*
 * POST /api/zapytania – publiczny formularz: prośba o wycenę lub pomiar (strona oferty)
 * oraz wiadomość ze strony /kontakt.
 * Body: { typ: "wycena" | "pomiar" | "kontakt", imie, telefon?, email?, uwagi?, oferta?, wybor? }
 *   - wymagane imię i (telefon albo e-mail),
 *   - limit 5 zgłoszeń na godzinę z jednego IP (rate:zap:<ip>),
 *   - zapis w KV (binding OFFERS): zapytanie:<data>:<losowe id>, przechowywane 180 dni.
 *   - powiadomienie e-mail przez Resend, jeśli ustawiono RESEND_API_KEY i NOTIFY_EMAIL (patrz docs/zgloszenia.md).
 * Odczyt: GET z kodem panelu (Authorization: Bearer <PANEL_TOKEN>) – ostatnie 200 zgłoszeń, najnowsze pierwsze.
 * Zmiana / usuwanie: /api/zapytania/:id (PATCH { obsluzone }, DELETE).
 */
import { notifyNewRequest } from "../../_lib/notify";
import { handle, HttpError, json, randomId, readJson, requirePanel, store } from "../../_lib/offers";

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
    utworzono: now,
  };
  await kv.put(`zapytanie:${now}:${randomId(8)}`, JSON.stringify(record), { expirationTtl: TTL });
  const sending = notifyNewRequest(ctx.env, record, new URL(ctx.request.url).origin);
  if (ctx.waitUntil) ctx.waitUntil(sending);
  else await sending;
  return json({ ok: true }, 201);
});

export const onRequestGet = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
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
