/*
 * POST /api/auth/verify/resend – zalogowane konto bez potwierdzonego e-maila: nowy link na adres konta.
 * Limity: jeden mail na minutę i 5 na dobę na konto (plus 20 na godzinę z IP).
 * Starsze linki działają dalej do swojego terminu – wystarczy kliknąć którykolwiek.
 */
import { bumpLimit, clientIp, panel } from "../../../_lib/auth";
import { mailConfigured } from "../../../_lib/notify";
import { handle, HttpError, json, store } from "../../../_lib/offers";
import { getFirm, getUser, isVerified } from "../../../_lib/tenant";
import { sendVerifyLink } from "../../../_lib/weryfikacja";

const COOLDOWN = 60;
const PER_DAY = 5;

export const onRequestPost = handle(async (ctx) => {
  const { session } = await panel(ctx);
  if (!session.email) throw new HttpError(400, "no_account", "Kod administratora nie ma adresu e-mail do potwierdzenia.");
  const kv = store(ctx.env);
  const user = await getUser(kv, session.email);
  if (!user) throw new HttpError(401, "unauthorized", "Zaloguj się ponownie.");
  if (isVerified(user)) return json({ ok: true, already: true, email: user.email });
  if (!mailConfigured(ctx.env)) {
    throw new HttpError(503, "mail_off", "Wysyłka e-maili chwilowo nie działa. Spróbuj później albo napisz do nas.");
  }

  const cool = `verifyresend:cool:${user.email}`;
  if (await kv.get(cool)) {
    throw new HttpError(429, "too_soon", "Link wysłaliśmy przed chwilą. Sprawdź skrzynkę (także spam) i spróbuj ponownie za minutę.");
  }
  await bumpLimit(kv, `rate:verifyresend:${clientIp(ctx)}`, 20, 3600, "Za dużo próśb z tego adresu. Spróbuj za godzinę.");
  await bumpLimit(
    kv,
    `verifyresend:day:${user.email}`,
    PER_DAY,
    86400,
    `Wysłaliśmy już ${PER_DAY} linków w ciągu doby. Sprawdź folder spam albo napisz do nas.`,
  );
  await kv.put(cool, "1", { expirationTtl: COOLDOWN });

  const firm = await getFirm(kv, user.firmId);
  if (!(await sendVerifyLink(ctx.env, kv, new URL(ctx.request.url).origin, user, firm?.name ?? ""))) {
    throw new HttpError(502, "mail_failed", "Nie udało się wysłać e-maila. Spróbuj za chwilę.");
  }
  return json({ ok: true, email: user.email });
});
