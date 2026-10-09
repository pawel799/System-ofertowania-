/*
 * POST /api/public/:slug/open – strona klienta zgłasza otwarcie oferty:
 * licznik wyświetleń +1, zdarzenie w historii, status "Wysłana" -> "Otwarta".
 */
import { handle, putOffer, resolvePublic, stampNow } from "../../../_lib/offers";

export const onRequestPost = handle(async (ctx) => {
  const { kv, offer } = await resolvePublic(ctx);
  const link = offer.link!;
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
