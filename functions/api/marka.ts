/*
 * GET /api/marka – nazwa i logo firmy (strona oferty demo, podgląd maila, nagłówek panelu).
 * Zalogowana firma (ciasteczko sesji) dostaje swoją markę; bez logowania – marka właściciela systemu.
 * Bez danych kontaktowych. Brak ustawień = { brand: null } (strona używa nazwy z src/content/firma.ts).
 */
import { readSession } from "../_lib/auth";
import { getBrand } from "../_lib/brand";
import { handle, json } from "../_lib/offers";
import { MAIN_FIRM, scoped } from "../_lib/tenant";

export const onRequestGet = handle(async (ctx) => {
  const kv = ctx.env.OFFERS;
  if (!kv) return json({ brand: null });
  const session = await readSession(ctx).catch(() => null);
  const firmId = session?.user.firmId ?? MAIN_FIRM;
  const brand = await getBrand(scoped(kv, firmId));
  return json(
    { brand: brand ? { name: brand.name, logo: brand.logo } : null },
    200,
    // Odpowiedź zależy od zalogowania – nie trzymamy jej we wspólnym cache.
    { "cache-control": session ? "private, no-store" : "public, max-age=60", vary: "cookie" },
  );
});
