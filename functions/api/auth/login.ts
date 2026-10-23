/*
 * POST /api/auth/login – { email, haslo } → ciasteczko sesji.
 * Ochrona: Turnstile (gdy TURNSTILE_SECRET_KEY), stały czas odpowiedzi i 20 błędnych prób na IP i 10 na konto w ciągu 15 minut.
 */
import { clientIp, createSession, requireTurnstile, verifyDummy, verifyPassword } from "../../_lib/auth";
import { handle, HttpError, json, readJson, store } from "../../_lib/offers";
import { assertFirmActive, firmView, getFirm, getUser, normEmail, putUser, userView } from "../../_lib/tenant";

const WINDOW = 15 * 60;

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 8_000)) as { email?: unknown; haslo?: unknown; turnstile?: unknown } | null;
  const email = normEmail(typeof b?.email === "string" ? b.email : "");
  const password = typeof b?.haslo === "string" ? b.haslo : "";
  if (!email || !password) throw new HttpError(400, "invalid", "Wpisz e-mail i hasło.");

  const ipKey = `loginfail:ip:${clientIp(ctx)}`;
  const userKey = `loginfail:u:${email}`;
  const [ipFails, userFails] = await Promise.all([kv.get(ipKey), kv.get(userKey)]).then((v) => v.map((x) => Number(x ?? 0)));
  if (ipFails >= 20 || userFails >= 10) {
    throw new HttpError(429, "too_many", "Za dużo nieudanych prób logowania. Spróbuj ponownie za 15 minut.");
  }

  await requireTurnstile(ctx, b?.turnstile);

  const user = await getUser(kv, email);
  const ok = user ? await verifyPassword(password, user.pw) : await verifyDummy(password, ctx.env);
  if (!user || !ok) {
    await Promise.all([
      kv.put(ipKey, String(ipFails + 1), { expirationTtl: WINDOW }),
      kv.put(userKey, String(userFails + 1), { expirationTtl: WINDOW }),
    ]);
    throw new HttpError(401, "bad_login", "Zły e-mail albo hasło.");
  }
  const firm = await getFirm(kv, user.firmId);
  if (!firm) throw new HttpError(401, "bad_login", "Zły e-mail albo hasło.");
  assertFirmActive(firm);

  await putUser(kv, { ...user, lastLogin: new Date().toISOString() });
  if (userFails) await kv.delete(userKey);
  const cookie = await createSession(kv, user, ctx.request);
  return json({ user: userView(user), firm: firmView(firm) }, 200, { "set-cookie": cookie });
});
