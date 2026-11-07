/*
 * /api/models/:id  (panel, wymaga tokenu)
 *   GET    – opis modelu
 *   PUT    – zmiana nazwy, oznaczeń elementów i wymiarów: { name?, tags?, wymiary?: { w, h, d } | null }
 *   DELETE – usunięcie modelu i pliku; 409, gdy używa go jakaś oferta
 */
import { bucket, cleanName, getModel, modelId, offersUsing, putModel, validateTags, validateWymiary } from "../../_lib/assets";
import { handle, HttpError, json, param, readJson } from "../../_lib/offers";
import { panel } from "../../_lib/auth";

const notFound = () => new HttpError(404, "not_found", "Nie ma takiego modelu.");

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const m = await getModel(kv, modelId(param(ctx, "id")));
  if (!m) throw notFound();
  return json({ model: m });
});

export const onRequestPut = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const m = await getModel(kv, modelId(param(ctx, "id")));
  if (!m) throw notFound();
  const body = await readJson(ctx.request);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid", "Oczekiwano obiektu.");
  const b = body as Record<string, unknown>;
  const { wymiary: _stare, ...bezWymiarow } = m;
  void _stare;
  const wymiary = b.wymiary === null ? undefined : b.wymiary !== undefined ? validateWymiary(b.wymiary) : m.wymiary;
  const saved = {
    ...bezWymiarow,
    ...(wymiary ? { wymiary } : {}),
    ...(b.name !== undefined ? { name: cleanName(b.name, "name") } : {}),
    ...(b.tags !== undefined ? { tags: validateTags(b.tags) } : {}),
    updatedAt: new Date().toISOString(),
  };
  await putModel(kv, saved);
  return json({ model: saved });
});

export const onRequestDelete = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const m = await getModel(kv, modelId(param(ctx, "id")));
  if (!m) throw notFound();
  const used = await offersUsing(kv, (o) => o.modelId === m.id || !!o.kuchnia?.elementy.some((e) => e.modelId === m.id));
  if (used.length) {
    throw new HttpError(409, "in_use", `Model jest użyty w ofertach: ${used.join(", ")}. Zmień w nich model albo je usuń.`);
  }
  await bucket(ctx.env).delete(m.file);
  await kv.delete(`model:${m.id}`);
  await kv.root.delete(`modelowner:${m.id}`);
  return new Response(null, { status: 204 });
});
