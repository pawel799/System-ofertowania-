/*
 * GET /api/firma?nip=1234567890 – dane firmy po NIP dla panelu.
 * (Przeniesione z Next route handlera, bo strona to statyczny eksport.)
 *
 * 1. Wykaz podatników VAT (biała lista, Ministerstwo Finansów) – szuka po NIP:
 *    nazwa, adres, REGON, numer KRS, status VAT.
 *    https://wl-api.mf.gov.pl/api/search/nip/{nip}?date=RRRR-MM-DD
 *    Limit: 100 wyszukiwań dziennie z jednego IP.
 * 2. Jeśli firma ma numer KRS – API KRS (Ministerstwo Sprawiedliwości) dokłada
 *    formę prawną i adres w rozbiciu na pola.
 *    https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/{krs}?rejestr=P&format=json
 *
 * Wymaga tokenu panelu (Authorization: Bearer <PANEL_TOKEN>), żeby obcy nie
 * zużywali limitu. Wyniki (firma znaleziona / brak w wykazie) trzymamy 24 h
 * w KV (binding OFFERS, klucz firma:<nip>) – pamięć w funkcji nie przetrwa
 * między instancjami, a Cache API nie działa na domenach *.pages.dev.
 */
import { cleanNip, isValidNip, type CompanyLookup } from "../../src/components/panel/company";
import { cachedLookup } from "../_lib/firma";
import { HttpError, requirePanel, type Ctx } from "../_lib/offers";

function reply(body: CompanyLookup, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestGet(ctx: Ctx) {
  try {
    await requirePanel(ctx);
  } catch (e) {
    if (e instanceof HttpError) return reply({ ok: false, error: e.message }, e.status);
    throw e;
  }

  const raw = new URL(ctx.request.url).searchParams.get("nip") ?? "";
  const nip = cleanNip(raw);
  if (!isValidNip(nip)) {
    return reply({ ok: false, error: "To nie jest poprawny NIP. Sprawdź, czy ma 10 cyfr i nie ma literówki." }, 400);
  }

  const { status, body } = await cachedLookup(ctx.env.OFFERS, nip);
  return reply(body, status);
}
