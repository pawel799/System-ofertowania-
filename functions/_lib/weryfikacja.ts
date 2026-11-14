/*
 * Potwierdzenie adresu e-mail konta firmy (po rejestracji).
 *
 * Link: <origin>/potwierdz-email?t=<token>. W KV tylko skrót tokenu (emailverify:<sha256>), jak przy zmianie hasła.
 * Link działa VERIFY_HOURS godzin; rekord trzymamy dłużej (7 dni), żeby po kliknięciu starego linku
 * powiedzieć „wygasł”, a nie „nieprawidłowy”. Użyty link zostawia ślad emailverify-used:<sha256> (30 dni),
 * więc drugie kliknięcie mówi „adres jest już potwierdzony”.
 * Strona wysyła token POST-em z przeglądarki – skanery linków w poczcie (GET bez JS) nie zużyją tokenu.
 */
import { sha256hex } from "./auth";
import { sendEmailVerification } from "./notify";
import { randomId, type Env, type KVNamespace } from "./offers";
import type { User } from "./tenant";

export const VERIFY_HOURS = 24;
const RECORD_TTL = 7 * 86400;
export const USED_TTL = 30 * 86400;

export type VerifyRecord = { email: string; userId: string; exp: string };

export const verifyKey = async (token: string) => `emailverify:${await sha256hex(token)}`;
export const usedKey = async (token: string) => `emailverify-used:${await sha256hex(token)}`;
export const VERIFY_TOKEN_RE = /^[A-Za-z0-9]{20,64}$/;

/** Nowy token dla konta i mail z linkiem. Zwraca, czy poczta przyjęła wiadomość. */
export async function sendVerifyLink(env: Env, kv: KVNamespace, origin: string, user: User, firmName: string) {
  const token = randomId(40);
  const record: VerifyRecord = { email: user.email, userId: user.id, exp: new Date(Date.now() + VERIFY_HOURS * 3600_000).toISOString() };
  await kv.put(await verifyKey(token), JSON.stringify(record), { expirationTtl: RECORD_TTL });
  return sendEmailVerification(env, {
    email: user.email,
    name: user.name,
    firm: firmName,
    link: `${origin}/potwierdz-email?t=${token}`,
    hours: VERIFY_HOURS,
  });
}
