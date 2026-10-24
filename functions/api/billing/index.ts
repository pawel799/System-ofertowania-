/*
 * GET /api/billing – plan firmy, okres próbny / opłacone do, wykorzystanie limitów
 * i czy działają płatności online. Dla administratora (firma "main") – brak planu.
 */
import { PLANS } from "../../../src/lib/plans";
import { panel } from "../../_lib/auth";
import { billingProvider } from "../../_lib/billing";
import { handle, json, store } from "../../_lib/offers";
import { firmPlan, usage } from "../../_lib/plan";
import { firmEmails, firmExpired, firmView } from "../../_lib/tenant";

export const onRequestGet = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  const fp = await firmPlan(ctx.env, session);
  if (!fp.firm || !fp.plan) return json({ firm: null, plan: null, plans: PLANS });
  const users = (await firmEmails(store(ctx.env), fp.firm.id)).length;
  const until = fp.firm.status === "trial" ? fp.firm.trialEnds : fp.firm.paidUntil;
  const daysLeft = until ? Math.ceil((Date.parse(until) - Date.now()) / 86400_000) : null;
  return json({
    firm: firmView(fp.firm),
    plan: fp.plan,
    plans: PLANS,
    expired: firmExpired(fp.firm),
    daysLeft,
    usage: await usage(kv, users),
    online: !!billingProvider(ctx.env),
  });
});
