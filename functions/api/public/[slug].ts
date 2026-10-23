/*
 * GET /api/public/:slug – publiczny podgląd oferty dla strony klienta.
 * Zwraca tylko materiały, model 3D, pakiety RAL i podstawowe dane (bez kontaktu, historii, PIN-u).
 * Oferta z PIN-em wymaga nagłówka X-Offer-Pin.
 */
import { getModel, listPalettes, publicModel, publicPalettes } from "../../_lib/assets";
import { handle, json, publicView } from "../../_lib/offers";
import { publicBrand, resolvePublic } from "../../_lib/public";

export const onRequestGet = handle(async (ctx) => {
  const { kv, offer } = await resolvePublic(ctx);
  const model = offer.modelId ? await getModel(kv, offer.modelId) : null;
  return json({
    offer: {
      ...publicView(offer),
      // Wgrany model 3D (adres pliku + role elementów); null = kuchnia demo.
      model: model ? publicModel(model) : null,
      // Pakiety RAL do wyboru frontu (przy ukrytej cenie bez dopłat).
      palettes: publicPalettes(await listPalettes(kv), !!offer.link?.showPrice),
      // Nazwa i logo firmy, która wysłała ofertę.
      brand: await publicBrand(kv),
    },
  });
});
