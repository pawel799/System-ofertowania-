/*
 * GET /api/auth/me – kto jest zalogowany: { user, firm, role }.
 * Administrator (kod PANEL_TOKEN): user = null, firm = null, role = "admin".
 */
import { requirePanel } from "../../_lib/auth";
import { handle, json, store } from "../../_lib/offers";
import { firmView, getFirm, getUser, userView } from "../../_lib/tenant";

export const onRequestGet = handle(async (ctx) => {
  const s = await requirePanel(ctx);
  if (s.role === "admin") return json({ role: "admin", user: null, firm: null });
  const kv = store(ctx.env);
  const [user, firm] = await Promise.all([getUser(kv, s.email!), getFirm(kv, s.firmId)]);
  return json({ role: s.role, user: user ? userView(user) : null, firm: firm ? firmView(firm) : null });
});
