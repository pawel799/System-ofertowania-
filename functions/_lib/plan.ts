/*
 * Limity planów (src/lib/plans.ts) po stronie API.
 * Firma "main" (właściciel systemu, kod PANEL_TOKEN) nie ma limitów.
 *
 * Po okresie próbnym bez opłaty (albo po dacie „opłacone do”) panel działa tylko do odczytu:
 * nie da się dodać oferty, utworzyć nowego linku, wgrać modelu ani dodać konta.
 * Linki już wysłane klientom działają dalej – klient firmy nie cierpi przez zaległą fakturę.
 */
import { PLANS, type PlanInfo, type PlanLimits } from "../../src/lib/plans";
import type { Session } from "./auth";
import { listModels } from "./assets";
import { HttpError, listOffers, store, type Env, type KVNamespace, type Offer } from "./offers";
import { firmExpired, getFirm, MAIN_FIRM, type Firm } from "./tenant";

export type FirmPlan = { firm: Firm | null; plan: PlanInfo | null };

/** Firma i jej plan dla sesji (dla "main": { firm: null, plan: null } = bez limitów). */
export async function firmPlan(env: Env, session: Session): Promise<FirmPlan> {
  if (session.firmId === MAIN_FIRM) return { firm: null, plan: null };
  const firm = await getFirm(store(env), session.firmId);
  if (!firm) throw new HttpError(401, "unauthorized", "Zaloguj się ponownie.");
  return { firm, plan: PLANS[firm.plan] ?? PLANS.start };
}

/** Zapis nowych rzeczy wymaga aktywnego planu (albo trwającego okresu próbnego). */
export function assertCanWrite({ firm }: FirmPlan) {
  if (!firm || !firmExpired(firm)) return;
  const what = firm.status === "trial" ? "Okres próbny się skończył" : "Plan wygasł";
  throw new HttpError(
    402,
    "plan_expired",
    `${what}. Oferty i linki klientów działają dalej, ale nowych nie dodasz – wybierz plan w Ustawieniach → Plan.`,
  );
}

type CountedLimit = "users" | "activeOffers" | "models";
const LIMIT_TEXT: Record<CountedLimit, (n: number) => string> = {
  users: (n) => `Plan pozwala na ${n} ${n === 1 ? "konto" : "konta"} w zespole.`,
  activeOffers: (n) => `Plan pozwala na ${n} ofert w toku. Usuń stare oferty albo oznacz je jako zaakceptowane.`,
  models: (n) => `Plan pozwala na ${n} modeli 3D. Usuń nieużywane modele.`,
};

/** Rzuca 403, gdy po dodaniu jednej rzeczy firma przekroczy limit planu. */
export function assertLimit({ plan }: FirmPlan, kind: CountedLimit, current: number) {
  const max = plan?.limits[kind];
  if (max === null || max === undefined || current < max) return;
  throw new HttpError(403, "plan_limit", `${LIMIT_TEXT[kind](max)} Większy limit: Ustawienia → Plan.`, { limit: kind, max });
}

type Feature = keyof Pick<PlanLimits, "palettes" | "domain" | "embed">;
const FEATURE_TEXT: Record<Feature, string> = {
  palettes: "Własne pakiety kolorów RAL są w planie Pracownia i wyższym.",
  domain: "Własna domena linków jest w planie Producent.",
  embed: "Kuchnia 3D na Twojej stronie (kod osadzenia) jest w planie Pracownia i wyższym.",
};

export function assertFeature({ plan }: FirmPlan, feature: Feature) {
  if (!plan || plan.limits[feature]) return;
  throw new HttpError(403, "plan_feature", `${FEATURE_TEXT[feature]} Zmień plan w Ustawieniach → Plan.`, { feature });
}

/* ---------- Liczenie ---------- */

/** Oferta w toku: nie zaakceptowana i bez wygasłego linku. */
export function isActiveOffer(o: Offer, now = Date.now()) {
  if (o.status === "zaakceptowany") return false;
  return !(o.link?.expiresAt && Date.parse(o.link.expiresAt) < now);
}

export async function usage(kv: KVNamespace, users: number) {
  const [offers, models] = await Promise.all([listOffers(kv), listModels(kv)]);
  return { users, activeOffers: offers.filter((o) => isActiveOffer(o)).length, offers: offers.length, models: models.length };
}
