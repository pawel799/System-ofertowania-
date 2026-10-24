/*
 * POST /api/billing/checkout – płatność online: { plan, period } → { url } strony operatora.
 * Bez skonfigurowanego operatora (BILLING_PROVIDER) – 501, panel pokazuje wtedy prośbę o fakturę.
 */
import { isPlanId } from "../../../src/lib/plans";
import { panel, requireOwner } from "../../_lib/auth";
import { billingProvider } from "../../_lib/billing";
import { handle, HttpError, json, readJson } from "../../_lib/offers";
import { firmPlan } from "../../_lib/plan";

export const onRequestPost = handle(async (ctx) => {
  const { session } = await panel(ctx);
  requireOwner(session);
  const provider = billingProvider(ctx.env);
  if (!provider) throw new HttpError(501, "payments_off", "Płatności online jeszcze nie działają. Wyślij prośbę o fakturę.");
  const fp = await firmPlan(ctx.env, session);
  if (!fp.firm) throw new HttpError(400, "no_firm", "Administrator systemu nie ma planu.");
  const b = (await readJson(ctx.request, 2_000)) as { plan?: unknown; period?: unknown } | null;
  if (!isPlanId(b?.plan)) throw new HttpError(400, "invalid", "Nieznany plan.");
  const { url } = await provider.createCheckout({
    firm: fp.firm,
    plan: b.plan,
    period: b?.period === "year" ? "year" : "month",
    email: session.email ?? "",
    origin: new URL(ctx.request.url).origin,
  });
  return json({ url });
});
