/*
 * /api/katalog  (panel)
 *   GET  – pozycje katalogu materiałów firmy
 *   POST – nowa pozycja: { kind, name, color, delta, active, finish?, thicknessMm?, producer?, collection?, ral?, unit?, bezUchwytu?, sort? }
 * Limit pozycji: plan (src/lib/plans.ts → limits.katalog). Katalog jest w każdym planie.
 */
import { listKatalog, validateKatalog } from "../../_lib/katalog";
import { handle, json, randomId, readJson } from "../../_lib/offers";
import { panel } from "../../_lib/auth";
import { assertCanWrite, assertLimit, firmPlan } from "../../_lib/plan";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  return json({ katalog: await listKatalog(kv) });
});

export const onRequestPost = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  const fp = await firmPlan(ctx.env, session);
  assertCanWrite(fp);
  if (fp.plan?.limits.katalog != null) assertLimit(fp, "katalog", (await listKatalog(kv)).length);
  const id = randomId(12);
  const now = new Date().toISOString();
  const pozycja = { ...validateKatalog(await readJson(ctx.request), id), createdAt: now, updatedAt: now };
  await kv.put(`catalog:${id}`, JSON.stringify(pozycja));
  return json({ pozycja }, 201, { location: `/api/katalog/${id}` });
});
