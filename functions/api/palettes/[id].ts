/*
 * /api/palettes/:id  (panel, wymaga tokenu)
 *   PUT    – zmiana pakietu; kolorów użytych w ofertach nie da się usunąć (409)
 *   DELETE – usunięcie pakietu; 409, gdy oferta ma front z tego pakietu
 */
import { getPalette, offersUsing, paletteId, validatePalette } from "../../_lib/assets";
import { parseRalFront } from "../../../src/components/palettes";
import { handle, HttpError, json, param, readJson, requirePanel, store } from "../../_lib/offers";

const notFound = () => new HttpError(404, "not_found", "Nie ma takiego pakietu.");

export const onRequestPut = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const id = paletteId(param(ctx, "id"));
  const existing = await getPalette(kv, id);
  if (!existing) throw notFound();
  const next = validatePalette(await readJson(ctx.request), id);
  const removed = existing.colors.filter((c) => !next.colors.includes(c));
  if (removed.length) {
    const used = await offersUsing(kv, (o) => {
      const ref = parseRalFront(o.front);
      return !!ref && ref.paletteId === id && removed.includes(ref.code);
    });
    if (used.length) {
      throw new HttpError(409, "in_use", `Usuwane kolory są użyte w ofertach: ${used.join(", ")}. Zmień w nich front.`);
    }
  }
  const saved = { ...next, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  await kv.put(`palette:${id}`, JSON.stringify(saved));
  return json({ palette: saved });
});

export const onRequestDelete = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const id = paletteId(param(ctx, "id"));
  if (!(await getPalette(kv, id))) throw notFound();
  const used = await offersUsing(kv, (o) => parseRalFront(o.front)?.paletteId === id);
  if (used.length) {
    throw new HttpError(409, "in_use", `Pakiet jest użyty w ofertach: ${used.join(", ")}. Zmień w nich front.`);
  }
  await kv.delete(`palette:${id}`);
  return new Response(null, { status: 204 });
});
