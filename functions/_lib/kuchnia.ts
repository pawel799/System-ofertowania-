/*
 * Cena kuchni z kreatora. Serwer nadpisuje base sumą pozycji: z cennika firmy (ceny „cennik”) albo z kwot
 * wpisanych przez firmę przy elementach (ceny „reczne” – plan.ceny, element.cena) – plus dodatki.
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
