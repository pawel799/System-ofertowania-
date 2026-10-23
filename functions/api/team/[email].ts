/*
 * /api/team/:email (tylko właściciel konta firmy)
 *   PATCH  { haslo } – nowe hasło dla pracownika (np. gdy zapomniał)
 *   DELETE – usunięcie konta pracownika (właściciela nie da się usunąć)
 */
import { checkPasswordRules, hashPassword, iterationsFor, panel, requireOwner } from "../../_lib/auth";
import { handle, HttpError, json, param, readJson, store } from "../../_lib/offers";
import { firmEmails, getUser, normEmail, putUser, setFirmEmails, userView } from "../../_lib/tenant";

async function target(ctx: Parameters<typeof panel>[0]) {
  const { session } = await panel(ctx);
  requireOwner(session);
  const kv = store(ctx.env);
  let email = "";
  try {
    email = normEmail(decodeURIComponent(param(ctx, "email")));
  } catch {
    throw new HttpError(400, "invalid", "Zły adres e-mail.");
  }
  const user = await getUser(kv, email);
  if (!user || user.firmId !== session.firmId) throw new HttpError(404, "not_found", "Nie ma takiego konta w Twojej firmie.");
  return { session, kv, user };
}

export const onRequestPatch = handle(async (ctx) => {
  const { kv, user } = await target(ctx);
  const b = (await readJson(ctx.request, 5_000)) as { haslo?: unknown } | null;
  const password = checkPasswordRules(b?.haslo);
  const saved = { ...user, pw: await hashPassword(password, iterationsFor(ctx.env)), pwChangedAt: new Date().toISOString() };
  await putUser(kv, saved);
  return json({ user: userView(saved) });
});

export const onRequestDelete = handle(async (ctx) => {
  const { session, kv, user } = await target(ctx);
  if (user.role === "owner") throw new HttpError(400, "owner", "Konta właściciela nie można usunąć.");
  if (user.email === session.email) throw new HttpError(400, "self", "Nie możesz usunąć własnego konta.");
  await kv.delete(`user:${user.email}`);
  await setFirmEmails(kv, user.firmId, (await firmEmails(kv, user.firmId)).filter((e) => e !== user.email));
  return new Response(null, { status: 204 });
});
