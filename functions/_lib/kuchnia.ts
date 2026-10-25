/*
 * Cena kuchni z kreatora. Panel przysyła układ i wymiary, nigdy kwotę pozycji.
 * Serwer nadpisuje base i moduly sumą z cennika firmy — tak samo jak szafki na wymiar.
 */
import { bazaKuchni, pozycjeKuchni } from "../../src/lib/kuchnia";

export { bazaKuchni, pozycjeKuchni };
import { getCennik } from "./modul";
import type { KVNamespace, Offer } from "./offers";

export async function zCenaKuchni(kv: KVNamespace, offer: Offer): Promise<Offer> {
  if (!offer.kuchnia?.elementy.length) return offer;
  const cennik = await getCennik(kv);
  return {
    ...offer,
    moduly: pozycjeKuchni(offer.kuchnia),
    base: bazaKuchni(offer.kuchnia, cennik),
    layout: offer.kuchnia.uklad === "L" ? "L" : "I",
  };
}
