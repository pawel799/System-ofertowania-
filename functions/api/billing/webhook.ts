/*
 * POST /api/billing/webhook – potwierdzenie płatności od operatora (albo adaptera).
 * Treść (JSON): { eventId, createdAt, firmId, plan, period, paidUntil, provider, customerId?, subscriptionId? }
 * Nagłówek: X-Billing-Signature = hex(HMAC-SHA256(BILLING_WEBHOOK_SECRET, treść)).
 * Ochrona: podpis HMAC (stały czas), createdAt ±5 min, idempotencja po eventId (KV whevt:<id>, 30 dni),
 * „opłacone do” nigdy się nie cofa i nie wybiega dalej niż 400 dni. Cena/plan nie pochodzą od klienta –
 * tylko z podpisanego zdarzenia operatora.
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
  const eventId = typeof e.eventId === "string" ? e.eventId.trim() : "";
  if (!/^[\w.:-]{6,120}$/.test(eventId)) throw new HttpError(400, "invalid", "Brak identyfikatora zdarzenia (eventId).");
  const created = Date.parse(String(e.createdAt));
  if (Number.isNaN(created) || Math.abs(Date.now() - created) > 5 * 60_000) {
    throw new HttpError(400, "stale", "Zdarzenie jest przeterminowane albo ma zły czas (createdAt).");
  }
  const paidUntilMs = Date.parse(e.paidUntil);
  if (paidUntilMs > Date.now() + 400 * 86_400_000) throw new HttpError(400, "invalid", "Data „opłacone do” jest zbyt odległa.");

  const kv = store(ctx.env);
  const evKey = `whevt:${eventId}`;
  if (await kv.get(evKey)) return json({ ok: true, duplicate: true });
  const firm = await getFirm(kv, String(e.firmId));
  if (!firm) throw new HttpError(404, "not_found", "Nie ma takiej firmy.");
  const next = {
    ...firm,
    plan: e.plan,
    status: firm.status === "suspended" ? firm.status : ("active" as const),
    // Nigdy nie skracamy już opłaconego okresu (np. spóźnione starsze zdarzenie).
    paidUntil: new Date(Math.max(paidUntilMs, firm.paidUntil ? Date.parse(firm.paidUntil) || 0 : 0)).toISOString(),
    billing: {
      provider: e.provider.slice(0, 40),
      customerId: e.customerId?.slice(0, 120) ?? firm.billing?.customerId ?? null,
      subscriptionId: e.subscriptionId?.slice(0, 120) ?? firm.billing?.subscriptionId ?? null,
      period: e.period === "year" ? ("year" as const) : ("month" as const),
    },
    planRequest: null,
  };
  await putFirm(kv, next);
  await kv.put(evKey, new Date().toISOString(), { expirationTtl: 30 * 86_400 });
  return json({ firm: firmView(next) });
});
