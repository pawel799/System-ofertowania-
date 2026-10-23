/*
 * /api/zapytania/:id (panel, wymaga kodu dostępu)
 *   PATCH  { obsluzone: boolean } – oznaczenie zgłoszenia jako obsłużone (albo cofnięcie)
 *   DELETE – usunięcie zgłoszenia
 * id = klucz KV bez prefiksu "zapytanie:" (data ISO + losowy sufiks).
 */
import { handle, HttpError, json, param, readJson } from "../../_lib/offers";
import { panel } from "../../_lib/auth";

const ID_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z:[A-Za-z0-9]{4,16}$/;
const TTL = 180 * 24 * 3600;

function keyOf(ctx: Parameters<typeof param>[0]) {
  const id = decodeURIComponent(param(ctx, "id"));
  if (!ID_RE.test(id)) throw new HttpError(400, "invalid", "Niepoprawny identyfikator zgłoszenia.");
  return { id, key: `zapytanie:${id}` };
}

export const onRequestPatch = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const { id, key } = keyOf(ctx);
  const raw = await kv.get(key);
  if (!raw) throw new HttpError(404, "not_found", "Nie ma takiego zgłoszenia (mogło wygasnąć po 180 dniach).");
  const body = (await readJson(ctx.request)) as { obsluzone?: unknown } | null;
  if (typeof body?.obsluzone !== "boolean") throw new HttpError(400, "invalid", "Oczekiwano { obsluzone: true/false }.");
  const record = JSON.parse(raw) as Record<string, unknown>;
  record.obsluzone = body.obsluzone ? new Date().toISOString() : null;
  // Zachowujemy pierwotny termin wygaśnięcia: 180 dni od utworzenia.
  const created = Date.parse(String(record.utworzono ?? "")) || Date.now();
  const left = Math.max(60, Math.round(TTL - (Date.now() - created) / 1000));
  await kv.put(key, JSON.stringify(record), { expirationTtl: left });
  return json({ item: { id, ...record } });
});

export const onRequestDelete = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const { key } = keyOf(ctx);
  await kv.delete(key);
  return new Response(null, { status: 204 });
});
