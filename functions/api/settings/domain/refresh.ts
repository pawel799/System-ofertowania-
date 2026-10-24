/*
 * POST /api/settings/domain/refresh  (panel, wymaga tokenu)
 * Pobiera z Cloudflare aktualny status domeny i certyfikatu.
 */
import { domainView, getDomain, refreshDomain, requireCf } from "../../../_lib/domain";
import { handle, HttpError, json } from "../../../_lib/offers";
import { panel } from "../../../_lib/auth";

export const onRequestPost = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  requireCf(ctx.env);
  const existing = await getDomain(kv);
  if (!existing) throw new HttpError(404, "not_found", "Nie ustawiono własnej domeny.");
  return json(domainView(ctx.env, await refreshDomain(ctx.env, kv, existing)));
});
