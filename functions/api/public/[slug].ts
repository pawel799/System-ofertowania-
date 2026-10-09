/*
 * GET /api/public/:slug – publiczny podgląd oferty dla strony klienta.
 * Zwraca tylko materiały i podstawowe dane (bez kontaktu, historii, PIN-u).
 * Oferta z PIN-em wymaga nagłówka X-Offer-Pin.
 */
import { handle, json, publicView, resolvePublic } from "../../_lib/offers";

export const onRequestGet = handle(async (ctx) => {
  const { offer } = await resolvePublic(ctx);
  return json({ offer: publicView(offer) });
});
