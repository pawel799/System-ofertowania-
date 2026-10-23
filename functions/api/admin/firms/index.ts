/*
 * GET /api/admin/firms – lista firm z kontami (tylko administrator: kod PANEL_TOKEN).
 * Do ręcznego zarządzania planami, okresem próbnym i zawieszaniem kont.
 */
import { panel, requireAdmin } from "../../../_lib/auth";
import { handle, json, store } from "../../../_lib/offers";
import { firmEmails, firmView, listFirms } from "../../../_lib/tenant";

export const onRequestGet = handle(async (ctx) => {
  const { session } = await panel(ctx);
  requireAdmin(session);
  const kv = store(ctx.env);
  const firms = await listFirms(kv);
  const emails = await Promise.all(firms.map((f) => firmEmails(kv, f.id)));
  return json({ firms: firms.map((f, i) => ({ ...firmView(f), users: emails[i] })) });
});
