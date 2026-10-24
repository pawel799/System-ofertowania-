/*
 * /api/settings/embed (panel) – kuchnia 3D na stronie firmy.
 *   GET – { embed, allowed, firmId }  (allowed = plan obejmuje osadzanie i nie wygasł)
 *   PUT – { enabled, title, modelId, base, showPrice, front, countertop, hardware }
 */
import { panel } from "../../_lib/auth";
import { EMBED_KEY, embedAllowed, getEmbed, validateEmbed } from "../../_lib/embed";
import { handle, json, readJson } from "../../_lib/offers";
import { assertFeature, firmPlan } from "../../_lib/plan";

export const onRequestGet = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  const fp = await firmPlan(ctx.env, session);
  return json({ embed: await getEmbed(kv), allowed: embedAllowed(fp.firm), firmId: session.firmId });
});

export const onRequestPut = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  const fp = await firmPlan(ctx.env, session);
  const embed = await validateEmbed(kv, await readJson(ctx.request, 5_000));
  if (embed.enabled) assertFeature(fp, "embed");
  await kv.put(EMBED_KEY, JSON.stringify(embed));
  return json({ embed, allowed: embedAllowed(fp.firm), firmId: session.firmId });
});
