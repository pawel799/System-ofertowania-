/*
 * POST /api/zgody – rejestr zgód na cookies (rozliczalność, art. 7 ust. 1 RODO: administrator musi wykazać zgodę).
 * Body: { id, wersja, at, analityczne, marketingowe } – id to losowy identyfikator z przeglądarki (src/lib/zgody.ts).
 * Bez adresu IP, bez danych osobowych. Przechowywane 3 lata (przedawnienie roszczeń), potem wygasają same.
 */
import { bumpLimit, clientIp } from "../_lib/auth";
import { handle, HttpError, readJson, store } from "../_lib/offers";

const TTL = 3 * 365 * 86400;

export const onRequestPost = handle(async (ctx) => {
  const kv = store(ctx.env);
  // Hamulec na zalewanie rejestru (licznik po IP żyje godzinę i nie trafia do rejestru).
  await bumpLimit(kv, `rate:zgody:${clientIp(ctx)}`, 30, 3600, "Za dużo zapisów zgód. Spróbuj później.");
  const b = (await readJson(ctx.request)) as Record<string, unknown> | null;
  const id = typeof b?.id === "string" && /^[0-9a-f]{24}$/.test(b.id) ? b.id : null;
  const wersja = typeof b?.wersja === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.wersja) ? b.wersja : null;
  if (!b || !id || !wersja || typeof b.analityczne !== "boolean" || typeof b.marketingowe !== "boolean") {
    throw new HttpError(400, "invalid", "Zły format zgody.");
  }
  const at = new Date().toISOString();
  await kv.put(`zgoda:${at.slice(0, 10)}:${id}:${Date.now().toString(36)}`, JSON.stringify({ id, wersja, analityczne: b.analityczne, marketingowe: b.marketingowe, at }), { expirationTtl: TTL });
  return new Response(null, { status: 204 });
});
