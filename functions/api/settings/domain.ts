/*
 * /api/settings/domain  (panel, wymaga tokenu)
 *   GET    – stan własnej domeny: { configured, target, domain, active }
 *   PUT    – ustawienie domeny: { hostname } (zakłada custom hostname w Cloudflare)
 *   DELETE – usunięcie domeny (linki wracają na adres systemu)
 */
import { cleanHostname, createDomain, deleteDomain, domainView, getDomain, requireCf } from "../../_lib/domain";
import { handle, HttpError, json, readJson, requirePanel, store } from "../../_lib/offers";

export const onRequestGet = handle(async (ctx) => {
  await requirePanel(ctx);
  return json(domainView(ctx.env, await getDomain(store(ctx.env))));
});

export const onRequestPut = handle(async (ctx) => {
  await requirePanel(ctx);
  requireCf(ctx.env);
  const kv = store(ctx.env);
  const body = (await readJson(ctx.request)) as { hostname?: unknown } | null;
  const hostname = cleanHostname(body?.hostname, ctx.env);
  const existing = await getDomain(kv);
  if (existing) {
    throw new HttpError(409, "exists", `Domena ${existing.hostname} jest już ustawiona. Usuń ją, żeby dodać inną.`);
  }
  const state = await createDomain(ctx.env, kv, hostname);
  return json(domainView(ctx.env, state), 201);
});

export const onRequestDelete = handle(async (ctx) => {
  await requirePanel(ctx);
  requireCf(ctx.env);
  const kv = store(ctx.env);
  const existing = await getDomain(kv);
  if (existing) await deleteDomain(ctx.env, kv, existing);
  return new Response(null, { status: 204 });
});
