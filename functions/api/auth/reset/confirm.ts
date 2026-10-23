/* POST /api/auth/reset/confirm – { token, haslo } → nowe hasło; stare sesje przestają działać. */
import { checkPasswordRules, hashPassword, iterationsFor } from "../../../_lib/auth";
import { handle, HttpError, json, readJson, store } from "../../../_lib/offers";
import { getUser, putUser } from "../../../_lib/tenant";

async function sha256hex(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 2_000)) as { token?: unknown; haslo?: unknown } | null;
  const token = typeof b?.token === "string" ? b.token : "";
  const expired = new HttpError(400, "bad_token", "Link do zmiany hasła wygasł albo był już użyty. Poproś o nowy.");
  if (!/^[A-Za-z0-9]{20,64}$/.test(token)) throw expired;
  const key = `pwreset:${await sha256hex(token)}`;
  const email = await kv.get(key);
  if (!email) throw expired;
  const password = checkPasswordRules(b?.haslo);
  const user = await getUser(kv, email);
  if (!user) throw expired;
  await putUser(kv, { ...user, pw: await hashPassword(password, iterationsFor(ctx.env)), pwChangedAt: new Date().toISOString() });
  await kv.delete(key);
  return json({ ok: true });
});
