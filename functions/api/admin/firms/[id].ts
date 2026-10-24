/*
 * PUT /api/admin/firms/:id – zmiana planu i statusu firmy (tylko administrator).
 * Body (wszystko opcjonalne): { plan, status: "trial"|"active"|"suspended", trialEnds, paidUntil }
 * Daty jako ISO albo null.
 */
import { isPlanId } from "../../../../src/lib/plans";
import { panel, requireAdmin } from "../../../_lib/auth";
import { handle, HttpError, json, param, readJson, store } from "../../../_lib/offers";
import { firmView, getFirm, putFirm, type FirmStatus } from "../../../_lib/tenant";

const STATUSES: FirmStatus[] = ["trial", "active", "suspended"];

function date(v: unknown, field: string) {
  if (v === null) return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new HttpError(400, "invalid", `Pole ${field} musi być datą.`);
  return new Date(v).toISOString();
}

export const onRequestPut = handle(async (ctx) => {
  const { session } = await panel(ctx);
  requireAdmin(session);
  const kv = store(ctx.env);
  const firm = await getFirm(kv, param(ctx, "id"));
  if (!firm) throw new HttpError(404, "not_found", "Nie ma takiej firmy.");
  const b = (await readJson(ctx.request, 5_000)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") throw new HttpError(400, "invalid", "Oczekiwano obiektu.");
  const next = { ...firm };
  if (b.plan !== undefined) {
    if (!isPlanId(b.plan)) throw new HttpError(400, "invalid", "Nieznany plan.");
    next.plan = b.plan;
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status as FirmStatus)) throw new HttpError(400, "invalid", "Nieznany status.");
    next.status = b.status as FirmStatus;
  }
  if (b.trialEnds !== undefined) next.trialEnds = date(b.trialEnds, "trialEnds");
  if (b.paidUntil !== undefined) next.paidUntil = date(b.paidUntil, "paidUntil");
  // Prośba o plan obsłużona: ustawiono ten plan albo nową datę opłacenia.
  if (next.planRequest && ((b.plan !== undefined && next.plan === next.planRequest.plan) || (b.paidUntil && next.paidUntil))) {
    next.planRequest = null;
  }
  await putFirm(kv, next);
  return json({ firm: firmView(next) });
});
