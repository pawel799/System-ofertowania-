/*
 * Płatności – przygotowanie pod operatora (Stripe, Przelewy24, PayU…).
 *
 * Dziś: provider "manual" – firma prosi o zmianę planu w panelu, my dostajemy maila,
 * wystawiamy fakturę i wpisujemy „opłacone do” w Ustawienia → Firmy (administrator).
 *
 * Operator płatności dochodzi w dwóch miejscach:
 *   1. createCheckout() – adres strony płatności dla firmy (POST /api/billing/checkout),
 *   2. webhook – operator potwierdza płatność (POST /api/billing/webhook) → aktualizacja firmy.
 * Webhook przyjmuje już dziś ogólny, podpisany format (HMAC-SHA256, sekret BILLING_WEBHOOK_SECRET),
 * więc wystarczy mały adapter po stronie operatora (albo Workera), który przetłumaczy jego zdarzenie.
 * Instrukcja: docs/platnosci.md.
 */
import type { PlanId } from "../../src/lib/plans";
import { HttpError, type Env } from "./offers";
import type { Firm } from "./tenant";

export type BillingPeriod = "month" | "year";

export type CheckoutArgs = { firm: Firm; plan: PlanId; period: BillingPeriod; email: string; origin: string };

export interface BillingProvider {
  id: string;
  /** Adres strony płatności (przekierowanie przeglądarki). */
  createCheckout(args: CheckoutArgs): Promise<{ url: string }>;
}

/** Operator płatności z konfiguracji (BILLING_PROVIDER); null = płatności online wyłączone. */
export function billingProvider(env: Env): BillingProvider | null {
  switch (env.BILLING_PROVIDER) {
    // case "stripe": return stripeProvider(env);   – tu dochodzi adapter operatora
    default:
      return null;
  }
}

/* ---------- Webhook: ogólny, podpisany format ---------- */

/** Zdarzenie „opłacono”: firma, plan, okres i data, do kiedy plan jest opłacony. */
export type PaidEvent = {
  /** Unikalny identyfikator zdarzenia (idempotencja – drugie dostarczenie jest ignorowane). */
  eventId: string;
  /** Czas wystawienia zdarzenia (ISO). Starsze niż 5 minut – odrzucone (ochrona przed powtórką). */
  createdAt: string;
  firmId: string;
  plan: PlanId;
  period: BillingPeriod;
  paidUntil: string;
  provider: string;
  customerId?: string;
  subscriptionId?: string;
};

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** Podpis: hex(HMAC-SHA256(sekret, surowa treść)), nagłówek X-Billing-Signature. */
export async function signBody(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

export async function verifyWebhook(env: Env, request: Request): Promise<string> {
  const secret = env.BILLING_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(404, "not_found", "Płatności online nie są włączone.");
  const body = await request.text();
  if (body.length > 20_000) throw new HttpError(413, "too_large", "Za duże dane.");
  const given = (request.headers.get("x-billing-signature") ?? "").toLowerCase();
  const want = await signBody(secret, body);
  let diff = given.length ^ want.length;
  for (let i = 0; i < Math.min(given.length, want.length); i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  if (diff !== 0) throw new HttpError(401, "bad_signature", "Zły podpis zdarzenia płatności.");
  return body;
}
