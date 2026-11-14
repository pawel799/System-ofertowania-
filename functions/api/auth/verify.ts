/*
 * POST /api/auth/verify – { token } z linku w mailu → adres e-mail konta potwierdzony.
 * Nie wymaga logowania (link często otwiera się na telefonie). Czytelne błędy:
 *   410 token_expired – link starszy niż 24 h,
 *   409 token_used    – link już kliknięty (adres jest potwierdzony),
 *   400 bad_token     – link ucięty, zmyślony albo bardzo stary.
 * Limit: 30 prób na godzinę z IP.
 * Pierwsze kliknięcie linku potwierdza adres i od razu loguje (ciasteczko sesji) – link z maila dowodzi,
 * że to właściciel adresu; rejestracja sama nie loguje (najpierw potwierdzenie, potem logowanie).
 */
import { bumpLimit, clientIp, createSession } from "../../_lib/auth";
import { sendWelcome } from "../../_lib/notify";
import { handle, HttpError, json, readJson, store } from "../../_lib/offers";
import { getFirm, getUser, isVerified, putUser } from "../../_lib/tenant";
import { USED_TTL, usedKey, VERIFY_HOURS, VERIFY_TOKEN_RE, verifyKey, type VerifyRecord } from "../../_lib/weryfikacja";

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 2_000)) as { token?: unknown } | null;
  const token = typeof b?.token === "string" ? b.token : "";
  const bad = new HttpError(
    400,
    "bad_token",
    "Ten link jest nieprawidłowy albo bardzo stary. Sprawdź, czy otworzył się w całości, albo wpisz e-mail i hasło w oknie logowania panelu – pojawi się „Wyślij link ponownie”.",
  );
  if (!VERIFY_TOKEN_RE.test(token)) throw bad;
  await bumpLimit(kv, `rate:verify:${clientIp(ctx)}`, 30, 3600, "Za dużo prób. Spróbuj za godzinę.");

  const key = await verifyKey(token);
  const raw = await kv.get(key);
  if (!raw) {
    const usedBy = await kv.get(await usedKey(token));
    if (usedBy) {
      throw new HttpError(409, "token_used", "Ten link był już użyty – adres e-mail jest potwierdzony. Możesz zalogować się do panelu.", { email: usedBy });
    }
    throw bad;
  }
  const rec = JSON.parse(raw) as VerifyRecord;
  if (Date.parse(rec.exp) < Date.now()) {
    throw new HttpError(
      410,
      "token_expired",
      `Link wygasł – działa przez ${VERIFY_HOURS} godziny od wysłania. Wpisz e-mail i hasło w oknie logowania panelu i kliknij „Wyślij link ponownie”.`,
    );
  }
  const user = await getUser(kv, rec.email);
  if (!user || user.id !== rec.userId) throw bad; // konto usunięte albo założone od nowa na ten sam adres

  const already = isVerified(user);
  if (!already) await putUser(kv, { ...user, emailVerified: true, emailVerifiedAt: new Date().toISOString() });
  await kv.put(await usedKey(token), user.email, { expirationTtl: USED_TTL });
  await kv.delete(key);
  const firm = await getFirm(kv, user.firmId);
  // Pierwsze potwierdzenie właściciela: mail powitalny (3 kroki na start, koniec okresu próbnego).
  if (!already && firm && user.role === "owner") {
    const sending = sendWelcome(ctx.env, { to: user.email, imie: user.name, firma: firm.name, origin: new URL(ctx.request.url).origin, trialEnds: firm.status === "trial" ? (firm.trialEnds ?? null) : null });
    if (ctx.waitUntil) ctx.waitUntil(sending);
    else await sending;
  }
  if (!firm || firm.status === "suspended") return json({ ok: true, email: user.email, already, zalogowany: false });
  const cookie = await createSession(kv, { ...user, emailVerified: true }, ctx.request);
  return json({ ok: true, email: user.email, already, zalogowany: true }, 200, { "set-cookie": cookie });
});
