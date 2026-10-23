/*
 * POST /api/billing/webhook – potwierdzenie płatności od operatora (albo adaptera).
 * Treść (JSON): { firmId, plan, period, paidUntil, provider, customerId?, subscriptionId? }
 * Nagłówek: X-Billing-Signature = hex(HMAC-SHA256(BILLING_WEBHOOK_SECRET, treść)).
 * Skutek: plan firmy, status "active", „opłacone do”, dane operatora; prośba o plan wyczyszczona.
 */
import { isPlanId } from "../../../src/lib/plans";
import { verifyWebhook, type PaidEvent } from "../../_lib/billing";
import { handle, HttpError, json, store } from "../../_lib/offers";
import { firmView, getFirm, putFirm } from "../../_lib/tenant";

export const onRequestPost = handle(async (ctx) => {
  const raw = await verifyWebhook(ctx.env, ctx.request);
  let e: PaidEvent;
  try {
    e = JSON.parse(raw) as PaidEvent;
  } catch {
    throw new HttpError(400, "bad_json", "Niepoprawny JSON.");
  }
  if (!isPlanId(e.plan) || Number.isNaN(Date.parse(e.paidUntil)) || typeof e.provider !== "string") {
    throw new HttpError(400, "invalid", "Zdarzenie płatności ma zły format.");
  }
  const kv = store(ctx.env);
  const firm = await getFirm(kv, String(e.firmId));
  if (!firm) throw new HttpError(404, "not_found", "Nie ma takiej firmy.");
  const next = {
    ...firm,
    plan: e.plan,
    status: firm.status === "suspended" ? firm.status : ("active" as const),
    paidUntil: new Date(e.paidUntil).toISOString(),
    billing: {
      provider: e.provider.slice(0, 40),
      customerId: e.customerId?.slice(0, 120) ?? firm.billing?.customerId ?? null,
      subscriptionId: e.subscriptionId?.slice(0, 120) ?? firm.billing?.subscriptionId ?? null,
      period: e.period === "year" ? ("year" as const) : ("month" as const),
    },
    planRequest: null,
  };
  await putFirm(kv, next);
  return json({ firm: firmView(next) });
});
