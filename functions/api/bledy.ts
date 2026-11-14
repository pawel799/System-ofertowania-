/*
 * /api/bledy – błędy z produkcji (functions/_lib/bledy.ts).
 *   POST   – z przeglądarki (components/ZbieranieBledow.tsx): { msg, stack?, sciezka? }; limit 30/h z IP.
 *   GET    – lista dla administratora (kod PANEL_TOKEN).
 *   DELETE – administrator: ?id=<id> jeden albo wszystkie.
 */
import { bumpLimit, clientIp, panel, requireAdmin } from "../_lib/auth";
import { listaBledow, usunBledy, zapiszBlad } from "../_lib/bledy";
import { handle, HttpError, json, readJson, store } from "../_lib/offers";

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  const b = (await readJson(ctx.request, 8_000)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || typeof b.msg !== "string") throw new HttpError(400, "invalid", "Oczekiwano { msg }.");
  await bumpLimit(kv, `rate:bledy:${clientIp(ctx)}`, 30, 3600, "Za dużo zgłoszeń błędów.");
  await zapiszBlad(kv, { zrodlo: "przegladarka", msg: b.msg, stack: b.stack, sciezka: b.sciezka, ua: ctx.request.headers.get("user-agent") });
  return json({ ok: true });
});

export const onRequestGet = handle(async (ctx) => {
  const { session } = await panel(ctx);
  requireAdmin(session);
  return json({ bledy: await listaBledow(store(ctx.env)) });
});

export const onRequestDelete = handle(async (ctx) => {
  const { session } = await panel(ctx);
  requireAdmin(session);
  await usunBledy(store(ctx.env), new URL(ctx.request.url).searchParams.get("id") ?? undefined);
  return json({ ok: true });
});
