/*
 * POST /api/offers/:id/przypomnij – panel: wyślij klientowi teraz przypomnienie o ofercie (e-mail z linkiem).
 * Wymaga linku i adresu e-mail w kontakcie. Limit: 3 na ofertę na dobę.
 */
import { panel } from "../../../_lib/auth";
import { mailConfigured } from "../../../_lib/notify";
import { getOffer, handle, HttpError, json, KEY_RE, param, putOffer, stampNow } from "../../../_lib/offers";
import { przypomnijKlientowi } from "../../../_lib/powiadomienia";

export const onRequestPost = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const key = param(ctx, "id");
  if (!KEY_RE.test(key)) throw new HttpError(400, "invalid", "Zły identyfikator oferty.");
  const offer = await getOffer(kv, key);
  if (!offer) throw new HttpError(404, "not_found", "Nie ma takiej oferty.");
  if (!offer.link) throw new HttpError(400, "no_link", "Oferta nie ma linku dla klienta.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(offer.contact.trim())) throw new HttpError(400, "no_email", "W kontakcie klienta nie ma adresu e-mail.");
  if (!mailConfigured(ctx.env)) throw new HttpError(503, "mail_off", "Wysyłka e-maili nie jest skonfigurowana (RESEND_API_KEY).");
  const limitKey = `przypomnijrate:${key}`;
  const n = Number((await kv.get(limitKey)) ?? 0);
  if (n >= 3) throw new HttpError(429, "too_many", "Przypomnienie wysłano już 3 razy dzisiaj.");
  await kv.put(limitKey, String(n + 1), { expirationTtl: 24 * 3600 });
  if (!(await przypomnijKlientowi(ctx.env, kv, new URL(ctx.request.url).origin, offer))) {
    throw new HttpError(502, "mail_failed", "Nie udało się wysłać e-maila. Spróbuj za chwilę.");
  }
  const saved = {
    ...offer,
    przypomnienie: new Date().toISOString(),
    events: [...offer.events, { t: stampNow(), k: "remind" as const, x: `Przypomnienie wysłane do ${offer.contact.trim()}` }].slice(-500),
  };
  await putOffer(kv, saved);
  return json({ offer: saved });
});
