/*
 * GET /api/marka – publiczna nazwa i logo firmy (strona oferty, podgląd maila, nagłówek panelu).
 * Bez danych kontaktowych. Brak ustawień = { brand: null } (strona używa nazwy z src/content/firma.ts).
 */
import { getBrand } from "../_lib/brand";
import { handle, json } from "../_lib/offers";

export const onRequestGet = handle(async (ctx) => {
  const kv = ctx.env.OFFERS;
  const brand = kv ? await getBrand(kv) : null;
  return json({ brand: brand ? { name: brand.name, logo: brand.logo } : null }, 200, { "cache-control": "public, max-age=60" });
});
