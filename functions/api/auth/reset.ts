/*
 * POST /api/auth/reset – { email } → mail z linkiem do ustawienia nowego hasła (ważny 1 godzinę).
 * Zawsze ta sama odpowiedź (nie zdradzamy, czy konto istnieje). Bez skonfigurowanej poczty (RESEND_API_KEY)
 * odpowiedź mówi { mail: false } – strona prosi wtedy o kontakt z właścicielem konta albo z nami.
 * Limit: 5 próśb na godzinę z IP.
 */
import { bumpLimit, clientIp } from "../../_lib/auth";
import { mailConfigured, sendPasswordReset } from "../../_lib/notify";
import { handle, json, randomId, readJson, store } from "../../_lib/offers";
import { EMAIL_RE, getUser, normEmail } from "../../_lib/tenant";

async function sha256hex(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 2_000)) as { email?: unknown } | null;
  const email = normEmail(typeof b?.email === "string" ? b.email : "");
  const mail = mailConfigured(ctx.env);
  if (!EMAIL_RE.test(email)) return json({ ok: true, mail });
  await bumpLimit(kv, `rate:reset:${clientIp(ctx)}`, 5, 3600, "Za dużo próśb o zmianę hasła. Spróbuj za godzinę.");
  const user = await getUser(kv, email);
  if (user && mail) {
    const token = randomId(40);
    await kv.put(`pwreset:${await sha256hex(token)}`, user.email, { expirationTtl: 3600 });
    const link = `${new URL(ctx.request.url).origin}/reset-hasla?t=${token}`;
    const sending = sendPasswordReset(ctx.env, user.email, link);
    if (ctx.waitUntil) ctx.waitUntil(sending);
    else await sending;
  }
  return json({ ok: true, mail });
});
