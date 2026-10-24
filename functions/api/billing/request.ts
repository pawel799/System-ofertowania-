/*
 * POST /api/billing/request – właściciel prosi o plan: { plan, period: "month" | "year" }.
 * Prośba zapisuje się przy firmie (administrator widzi ją w Ustawienia → Firmy),
 * a właściciel systemu dostaje maila (NOTIFY_EMAIL), żeby wystawić fakturę.
 */
import { isPlanId, PLANS } from "../../../src/lib/plans";
import { panel, requireOwner } from "../../_lib/auth";
import { sendMail } from "../../_lib/notify";
import { handle, HttpError, json, readJson, store } from "../../_lib/offers";
import { firmPlan } from "../../_lib/plan";
import { firmView, putFirm } from "../../_lib/tenant";

export const onRequestPost = handle(async (ctx) => {
  const { session } = await panel(ctx);
  requireOwner(session);
  const fp = await firmPlan(ctx.env, session);
  if (!fp.firm) throw new HttpError(400, "no_firm", "Administrator systemu nie ma planu.");
  const b = (await readJson(ctx.request, 2_000)) as { plan?: unknown; period?: unknown } | null;
  if (!isPlanId(b?.plan)) throw new HttpError(400, "invalid", "Nieznany plan.");
  const period = b?.period === "year" ? "year" : "month";
  const plan = PLANS[b.plan];
  const firm = { ...fp.firm, planRequest: { plan: plan.id, period, at: new Date().toISOString(), by: session.email ?? "" } } as const;
  await putFirm(store(ctx.env), { ...firm });
  const to = (ctx.env.NOTIFY_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const text = `Firma: ${firm.name} (NIP ${firm.nip})\nKonto: ${session.email}\nPlan: ${plan.name}, ${period === "year" ? "rocznie" : "miesięcznie"}\nObecnie: ${PLANS[fp.firm.plan].name}, status ${fp.firm.status}`;
  const sending = sendMail(ctx.env, {
    to,
    subject: `Prośba o plan ${plan.name}: ${firm.name}`,
    text,
    html: `<pre style="font-family:Arial,sans-serif;font-size:14px">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`,
    replyTo: session.email ?? undefined,
  });
  if (ctx.waitUntil) ctx.waitUntil(sending);
  else await sending;
  return json({ firm: firmView(firm) });
});
