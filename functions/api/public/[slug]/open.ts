/*
 * POST /api/public/:slug/open – strona klienta zgłasza otwarcie oferty:
 * licznik wyświetleń +1, zdarzenie w historii, status "Wysłana" -> "Otwarta".
 * Jedno IP liczy się raz na 30 minut (odświeżanie strony ani zapętlone wywołania
 * nie zaśmiecają historii i nie zużywają zapisów do KV).
 */
import { handle, putOffer, resolvePublic, stampNow } from "../../../_lib/offers";

export const onRequestPost = handle(async (ctx) => {
  const { kv, offer } = await resolvePublic(ctx);
  const link = offer.link!;
  const seenKey = `openseen:${link.slug}:${ctx.request.headers.get("cf-connecting-ip") ?? "unknown"}`;
  if (await kv.get(seenKey)) return new Response(null, { status: 204 });
  await kv.put(seenKey, "1", { expirationTtl: 30 * 60 });
  const first = link.views === 0;
  await putOffer(kv, {
    ...offer,
    status: offer.status === "wyslany" ? "otwarty" : offer.status,
    link: { ...link, views: link.views + 1 },
    events: [
      ...offer.events,
      { t: stampNow(), k: "open" as const, x: first ? "Klient otworzył ofertę" : "Klient otworzył ofertę ponownie" },
    ].slice(-500),
    updatedAt: new Date().toISOString(),
  });
  return new Response(null, { status: 204 });
});
