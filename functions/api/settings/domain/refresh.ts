/*
 * POST /api/settings/domain/refresh  (panel, wymaga tokenu)
 * Pobiera z Cloudflare aktualny status domeny i certyfikatu.
 */
import { domainView, getDomain, refreshDomain, requireCf } from "../../../_lib/domain";
import { handle, HttpError, json, requirePanel, store } from "../../../_lib/offers";

export const onRequestPost = handle(async (ctx) => {
  await requirePanel(ctx);
  requireCf(ctx.env);
  const kv = store(ctx.env);
  const existing = await getDomain(kv);
  if (!existing) throw new HttpError(404, "not_found", "Nie ustawiono własnej domeny.");
  return json(domainView(ctx.env, await refreshDomain(ctx.env, kv, existing)));
});
