/*
 * POST /api/auth/register – nowe konto firmy (stolarni) z kontem właściciela.
 * Body: { firma, nip, imie, email, haslo, plan?, zgoda: true }
 *   - jedna firma na NIP i jedno konto na e-mail,
 *   - okres próbny TRIAL_DAYS dni na wybranym planie,
 *   - Turnstile (gdy ustawiony TURNSTILE_SECRET_KEY),
 *   - limit 5 rejestracji na godzinę z jednego IP.
 * Odpowiedź: { user, firm } + ciasteczko sesji (od razu zalogowany).
 */
import { cleanNip, formatNip, isValidNip } from "../../../src/components/panel/company";
import { isPlanId, TRIAL_DAYS, type PlanId } from "../../../src/lib/plans";
import { bumpLimit, checkPasswordRules, clientIp, createSession, hashPassword, iterationsFor, requireTurnstile } from "../../_lib/auth";
import { BRAND_KEY } from "../../_lib/brand";
import { handle, HttpError, json, randomId, readJson, store } from "../../_lib/offers";
import {
  EMAIL_RE,
  firmView,
  getUser,
  normEmail,
  putFirm,
  putUser,
  scoped,
  setFirmEmails,
  userView,
  type Firm,
  type User,
} from "../../_lib/tenant";

const text = (v: unknown, field: string, min: number, max: number) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (s.length < min) throw new HttpError(400, "invalid", `Uzupełnij pole: ${field}.`);
  if (s.length > max) throw new HttpError(400, "invalid", `Pole ${field} jest za długie.`);
  return s;
};

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 20_000)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new HttpError(400, "invalid", "Oczekiwano obiektu.");

  const firmName = text(b.firma, "nazwa firmy", 2, 160);
  const nip = cleanNip(typeof b.nip === "string" ? b.nip : "");
  if (!isValidNip(nip)) throw new HttpError(400, "invalid_nip", "Wpisz poprawny NIP firmy (10 cyfr).");
  const name = text(b.imie, "imię i nazwisko", 2, 120);
  const email = normEmail(typeof b.email === "string" ? b.email : "");
  if (!EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, "invalid_email", "Wpisz poprawny adres e-mail.");
  const password = checkPasswordRules(b.haslo);
  if (b.zgoda !== true) throw new HttpError(400, "terms", "Zaakceptuj regulamin, żeby założyć konto.");
  const plan: PlanId = isPlanId(b.plan) ? b.plan : "pracownia";

  await bumpLimit(kv, `rate:reg:${clientIp(ctx)}`, 5, 3600, "Za dużo rejestracji z tego adresu. Spróbuj za godzinę.");
  await requireTurnstile(ctx, b.turnstile);
  if (await getUser(kv, email)) {
    throw new HttpError(409, "email_taken", "Konto z tym adresem e-mail już istnieje. Zaloguj się albo zmień hasło.");
  }
  if (await kv.get(`firmnip:${nip}`)) {
    throw new HttpError(409, "nip_taken", "Ta firma ma już konto. Poproś właściciela konta o dodanie Cię do zespołu.");
  }

  const now = new Date();
  const firm: Firm = {
    id: randomId(12),
    name: firmName,
    nip: formatNip(nip),
    plan,
    status: "trial",
    trialEnds: new Date(now.getTime() + TRIAL_DAYS * 86400_000).toISOString(),
    paidUntil: null,
    billing: { provider: "manual" },
    createdAt: now.toISOString(),
  };
  const user: User = {
    id: randomId(12),
    email,
    name,
    firmId: firm.id,
    role: "owner",
    pw: await hashPassword(password, iterationsFor(ctx.env)),
    createdAt: now.toISOString(),
    lastLogin: now.toISOString(),
  };
  await putFirm(kv, firm);
  await kv.put(`firmnip:${nip}`, firm.id);
  await putUser(kv, user);
  await setFirmEmails(kv, firm.id, [email]);
  // Nazwa firmy od razu jako marka w ofertach (logo można dodać w Ustawieniach).
  await scoped(kv, firm.id).put(BRAND_KEY, JSON.stringify({ name: firmName, logo: null, updatedAt: now.toISOString() }));

  const cookie = await createSession(kv, user, ctx.request);
  return json({ user: userView(user), firm: firmView(firm) }, 201, { "set-cookie": cookie });
});
