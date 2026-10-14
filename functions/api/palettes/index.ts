/*
 * /api/palettes  (panel, wymaga tokenu)
 *   GET  – pakiety kolorów RAL
 *   POST – nowy pakiet: { name, finish, colors: ["9010", …], delta }
 */
import { listPalettes, validatePalette } from "../../_lib/assets";
import { handle, json, randomId, readJson, requirePanel, store } from "../../_lib/offers";

export const onRequestGet = handle(async (ctx) => {
  await requirePanel(ctx);
  return json({ palettes: await listPalettes(store(ctx.env)) });
});

export const onRequestPost = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const id = randomId(12);
  const now = new Date().toISOString();
  const palette = { ...validatePalette(await readJson(ctx.request), id), createdAt: now, updatedAt: now };
  await kv.put(`palette:${id}`, JSON.stringify(palette));
  return json({ palette }, 201, { location: `/api/palettes/${id}` });
});
