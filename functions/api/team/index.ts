/*
 * /api/team – konta pracowników firmy.
 *   GET  – lista kont (każdy w firmie)
 *   POST – nowe konto pracownika (tylko właściciel): { email, imie, haslo }
 *          Hasło startowe przekazujesz pracownikowi; może je zmienić w Ustawieniach → Konto.
 */
import { checkPasswordRules, hashPassword, iterationsFor, panel, requireOwner } from "../../_lib/auth";
import { handle, HttpError, json, randomId, readJson, store } from "../../_lib/offers";
import { EMAIL_RE, firmEmails, firmUsers, getUser, MAIN_FIRM, normEmail, putUser, setFirmEmails, userView, type User } from "../../_lib/tenant";
import { assertCanWrite, assertLimit, firmPlan } from "../../_lib/plan";

export const onRequestGet = handle(async (ctx) => {
  const { session } = await panel(ctx);
  if (session.firmId === MAIN_FIRM) return json({ users: [] });
  return json({ users: (await firmUsers(store(ctx.env), session.firmId)).map(userView) });
});

export const onRequestPost = handle(async (ctx) => {
  const { session } = await panel(ctx);
  requireOwner(session);
  if (session.firmId === MAIN_FIRM) throw new HttpError(400, "no_firm", "Konta pracowników dodaje się w koncie firmy.");
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 5_000)) as Record<string, unknown> | null;
  const email = normEmail(typeof b?.email === "string" ? b.email : "");
  if (!EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, "invalid_email", "Wpisz poprawny adres e-mail.");
  const name = typeof b?.imie === "string" ? b.imie.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (name.length < 2) throw new HttpError(400, "invalid", "Wpisz imię i nazwisko.");
  const password = checkPasswordRules(b?.haslo);
  if (await getUser(kv, email)) throw new HttpError(409, "email_taken", "Konto z tym adresem e-mail już istnieje.");
  const fp = await firmPlan(ctx.env, session);
  assertCanWrite(fp);
  assertLimit(fp, "users", (await firmEmails(kv, session.firmId)).length);
  const user: User = {
    id: randomId(12),
    email,
    name,
    firmId: session.firmId,
    role: "member",
    pw: await hashPassword(password, iterationsFor(ctx.env)),
    createdAt: new Date().toISOString(),
  };
  await putUser(kv, user);
  await setFirmEmails(kv, session.firmId, [...(await firmEmails(kv, session.firmId)), email]);
  return json({ user: userView(user) }, 201);
});
