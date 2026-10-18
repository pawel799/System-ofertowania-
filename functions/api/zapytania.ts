/*
 * POST /api/zapytania – publiczny formularz: prośba o wycenę lub pomiar (strona oferty)
 * oraz wiadomość ze strony /kontakt.
 * Body: { typ: "wycena" | "pomiar" | "kontakt", imie, telefon?, email?, uwagi?, oferta?, wybor? }
 *   - wymagane imię i (telefon albo e-mail),
 *   - limit 5 zgłoszeń na godzinę z jednego IP (rate:zap:<ip>),
 *   - zapis w KV (binding OFFERS): zapytanie:<data>:<losowe id>, przechowywane 180 dni.
 * Odczyt: GET z tokenem panelu (Authorization: Bearer <PANEL_TOKEN>) – ostatnie 100 zgłoszeń.
 */
import { handle, HttpError, json, randomId, readJson, requirePanel, store } from "../_lib/offers";

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
  return json({ ok: true }, 201);
});

export const onRequestGet = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const { keys } = await kv.list({ prefix: "zapytanie:", limit: 1000 });
  const latest = keys.map((k) => k.name).sort().reverse().slice(0, 100);
  const items = (await Promise.all(latest.map((k) => kv.get(k)))).filter(Boolean).map((v) => JSON.parse(v as string));
  return json({ items });
});
