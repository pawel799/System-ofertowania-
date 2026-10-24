/*
 * POST /api/auth/password – zmiana własnego hasła: { obecne, nowe }.
 * Starsze sesje (inne przeglądarki) przestają działać; ta dostaje nowe ciasteczko.
 */
import { checkPasswordRules, createSession, hashPassword, iterationsFor, requirePanel, verifyPassword } from "../../_lib/auth";
import { handle, HttpError, json, readJson, store } from "../../_lib/offers";
import { getUser, putUser } from "../../_lib/tenant";

export const onRequestPost = handle(async (ctx) => {
  const s = await requirePanel(ctx);
  if (!s.email) throw new HttpError(400, "no_account", "Wejście kodem administratora nie ma hasła do zmiany.");
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 5_000)) as { obecne?: unknown; nowe?: unknown } | null;
  const user = await getUser(kv, s.email);
  if (!user) throw new HttpError(401, "unauthorized", "Zaloguj się ponownie.");
  if (typeof b?.obecne !== "string" || !(await verifyPassword(b.obecne, user.pw))) {
    throw new HttpError(400, "bad_password", "Obecne hasło się nie zgadza.");
  }
  const next = checkPasswordRules(b?.nowe);
  const changed = { ...user, pw: await hashPassword(next, iterationsFor(ctx.env)), pwChangedAt: new Date().toISOString() };
  await putUser(kv, changed);
  // Sesja tej przeglądarki: utworzona po zmianie, więc dalej ważna.
  await new Promise((r) => setTimeout(r, 5));
  const cookie = await createSession(kv, changed, ctx.request);
  return json({ ok: true }, 200, { "set-cookie": cookie });
});
