/*
 * Plany abonamentu. Wspólne dla API (functions/) i strony.
 * Firma ma zawsze jeden plan; nowa firma dostaje okres próbny na wybranym planie.
 */
export const PLAN_IDS = ["start", "pracownia", "producent"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_NAMES: Record<PlanId, string> = {
  start: "Start",
  pracownia: "Pracownia",
  producent: "Producent",
};

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);

/** Długość okresu próbnego po rejestracji. */
export const TRIAL_DAYS = 30;
