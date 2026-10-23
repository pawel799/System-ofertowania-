/*
 * /api/palettes  (panel, wymaga tokenu)
 *   GET  – pakiety kolorów RAL
 *   POST – nowy pakiet: { name, finish, colors: ["9010", …], delta }
 */
import { listPalettes, validatePalette } from "../../_lib/assets";
import { handle, json, randomId, readJson } from "../../_lib/offers";
import { panel } from "../../_lib/auth";
import { assertCanWrite, assertFeature, firmPlan } from "../../_lib/plan";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  return json({ palettes: await listPalettes(kv) });
});

export const onRequestPost = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  const fp = await firmPlan(ctx.env, session);
  assertFeature(fp, "palettes");
  assertCanWrite(fp);
  const id = randomId(12);
  const now = new Date().toISOString();
  const palette = { ...validatePalette(await readJson(ctx.request), id), createdAt: now, updatedAt: now };
  await kv.put(`palette:${id}`, JSON.stringify(palette));
  return json({ palette }, 201, { location: `/api/palettes/${id}` });
});
