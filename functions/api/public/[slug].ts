/*
 * GET /api/public/:slug – publiczny podgląd oferty dla strony klienta.
 * Zwraca tylko materiały, model 3D, pakiety RAL i podstawowe dane (bez kontaktu, historii, PIN-u).
 * Oferta z PIN-em wymaga nagłówka X-Offer-Pin.
 */
import { getModel, listPalettes, publicModel, publicPalettes } from "../../_lib/assets";
import { bazaKuchni, pozycjeKuchni } from "../../_lib/kuchnia";
import { handle, json, publicView } from "../../_lib/offers";
import { publicBrand, resolvePublic } from "../../_lib/public";
import { getCennik, pricedModuly } from "../../_lib/modul";
import { listKatalog, publicznyKatalog } from "../../_lib/katalog";

export const onRequestGet = handle(async (ctx) => {
  const { kv, offer } = await resolvePublic(ctx);
  const model = offer.modelId ? await getModel(kv, offer.modelId) : null;
  const zKreatora = !!offer.kuchnia?.elementy.length;
  const pozycje = zKreatora ? pozycjeKuchni(offer.kuchnia!) : (offer.moduly ?? []);
  const cennik = pozycje.length ? await getCennik(kv) : null;
  const showPrice = !!offer.link?.showPrice;
  // Modele użyte jako pojedyncze elementy kreatora (nie cały katalog firmy).
  const modelIds = Array.from(new Set((offer.kuchnia?.elementy ?? []).flatMap((e) => (e.modelId ? [e.modelId] : []))));
  const modele = (
    await Promise.all(modelIds.map(async (id) => (id === offer.modelId && model ? model : getModel(kv, id))))
  )
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map(publicModel);
  return json({
    offer: {
      ...publicView(offer),
      // Wgrany model 3D (adres pliku + role elementów); null = kuchnia demo.
      // Kuchnia z kreatora ma pierwszeństwo: strona rysuje plan, nie jeden GLB.
      model: model ? publicModel(model) : null,
      ...(modele.length ? { modele } : {}),
      // Pakiety RAL do wyboru frontu (przy ukrytej cenie bez dopłat).
      palettes: publicPalettes(await listPalettes(kv), showPrice),
      // Katalog materiałów firmy (aktywne pozycje + wybrane w ofercie); dopłaty wybranych są w offer.materialy.
      katalog: publicznyKatalog(await listKatalog(kv), offer, showPrice),
      // Nazwa i logo firmy, która wysłała ofertę.
      brand: await publicBrand(kv),
      // Cena zabudowy z kreatora zawsze z aktualnego cennika (nie ze zrzutu przy zapisie).
      ...(zKreatora && showPrice && cennik ? { base: bazaKuchni(offer.kuchnia!, cennik) } : {}),
      // Moduły na wymiar; ceny z cennika firmy (liczone tutaj), tylko gdy oferta pokazuje cenę.
      moduly: pozycje.length ? (showPrice && cennik ? pricedModuly(pozycje, cennik) : pozycje) : [],
    },
  });
});
