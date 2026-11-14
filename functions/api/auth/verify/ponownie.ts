/*
 * POST /api/auth/verify/ponownie – { email } bez logowania: nowy link potwierdzający dla konta, które jeszcze
 * nie potwierdziło adresu (ekran „Sprawdź skrzynkę” po rejestracji, logowanie zablokowane do potwierdzenia).
 * Zawsze ta sama odpowiedź { ok: true } – nie zdradzamy, czy konto istnieje. Limity: 10 próśb na godzinę z IP,
 * na konto jeden mail na minutę i 5 na dobę (te same klucze co /api/auth/verify/resend).
 */
import { bumpLimit, clientIp } from "../../../_lib/auth";
import { mailConfigured } from "../../../_lib/notify";
import { handle, HttpError, json, readJson, store } from "../../../_lib/offers";
import { EMAIL_RE, getFirm, getUser, isVerified, normEmail } from "../../../_lib/tenant";
import { sendVerifyLink } from "../../../_lib/weryfikacja";

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 2_000)) as { email?: unknown } | null;
  const email = normEmail(typeof b?.email === "string" ? b.email : "");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "invalid", "Wpisz adres e-mail, na który zakładałeś konto.");
  if (!mailConfigured(ctx.env)) throw new HttpError(503, "mail_off", "Wysyłka e-maili chwilowo nie działa. Spróbuj później albo napisz do nas.");
  await bumpLimit(kv, `rate:verifyagain:${clientIp(ctx)}`, 10, 3600, "Za dużo próśb z tego adresu. Spróbuj za godzinę.");

  const user = await getUser(kv, email);
  if (user && !isVerified(user)) {
    const cool = `verifyresend:cool:${user.email}`;
    const day = `verifyresend:day:${user.email}`;
    const dzis = Number((await kv.get(day)) ?? 0);
    if (!(await kv.get(cool)) && dzis < 5) {
      await kv.put(cool, "1", { expirationTtl: 60 });
      await kv.put(day, String(dzis + 1), { expirationTtl: 86400 });
      const firm = await getFirm(kv, user.firmId);
      const sending = sendVerifyLink(ctx.env, kv, new URL(ctx.request.url).origin, user, firm?.name ?? "");
      if (ctx.waitUntil) ctx.waitUntil(sending);
      else await sending;
    }
  }
  return json({ ok: true });
});
