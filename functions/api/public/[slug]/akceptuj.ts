/*
 * POST /api/public/:slug/akceptuj – klient akceptuje ofertę na stronie z linku.
 * Body: { imie: string, wersja: number, zgoda: true, wybor?: string, kwota?: number }
 *   (kwota = szacunek netto, który klient widział z wybranymi materiałami – informacja dla firmy)
 *   - wersja musi być bieżącą wersją oferty (klient akceptuje to, co widzi; po zmianie – 409 i odświeżenie),
 *   - oferta z PIN-em wymaga nagłówka X-Offer-Pin (jak GET),
 *   - zapis: offer.akceptacja, status „zaakceptowany”, zdarzenie „accept”; e-mail do firmy (powiadomienia.ts),
 *   - limit: 5 prób na link na godzinę.
 */
import { handle, HttpError, json, putOffer, readJson, stampNow } from "../../../_lib/offers";
import { resolvePublic } from "../../../_lib/public";
import { powiadomFirme, wTle } from "../../../_lib/powiadomienia";
import { ostatniaWersja } from "../../../../src/lib/wersje";

export const onRequestPost = handle(async (ctx) => {
  const { kv, offer } = await resolvePublic(ctx);
  const link = offer.link!;
  const body = await readJson(ctx.request, 5000);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid", "Oczekiwano obiektu.");
  const b = body as Record<string, unknown>;
  const imie = typeof b.imie === "string" ? b.imie.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (imie.length < 3) throw new HttpError(400, "invalid", "Wpisz imię i nazwisko.");
  if (b.zgoda !== true) throw new HttpError(400, "invalid", "Zaznacz, że akceptujesz ofertę.");
  const wybor = typeof b.wybor === "string" ? b.wybor.replace(/\s+/g, " ").trim().slice(0, 1000) : "";
  const { wersja } = ostatniaWersja(offer.wersje);
  const nr = wersja?.nr ?? 1;
  if (b.wersja !== nr) throw new HttpError(409, "stale", "Oferta została właśnie zmieniona. Odśwież stronę i sprawdź nową wersję.");
  if (offer.akceptacja && offer.akceptacja.wersja === nr) throw new HttpError(409, "accepted", "Ta wersja oferty jest już zaakceptowana.");

  const rateKey = `akceptrate:${link.slug}`;
  const n = Number((await kv.get(rateKey)) ?? 0);
  if (n >= 5) throw new HttpError(429, "too_many", "Za dużo prób. Spróbuj za godzinę albo napisz do nas.");
  await kv.put(rateKey, String(n + 1), { expirationTtl: 3600 });

  const akceptacja = {
    wersja: nr,
    data: new Date().toISOString(),
    imie,
    kwota: link.showPrice ? (typeof b.kwota === "number" && Number.isFinite(b.kwota) && b.kwota > 0 && b.kwota < 10_000_000 ? Math.round(b.kwota) : offer.base) : null,
    ...(wybor ? { wybor } : {}),
  };
  await putOffer(kv, {
    ...offer,
    akceptacja,
    status: "zaakceptowany",
    events: [...offer.events, { t: stampNow(), k: "accept" as const, x: `Klient zaakceptował ofertę (wersja ${nr}, ${imie})` }].slice(-500),
    updatedAt: new Date().toISOString(),
  });
  wTle(
    ctx,
    powiadomFirme(ctx, kv, offer, "akceptacja", [
      ["Zaakceptował(a)", imie],
      ["Wersja", String(nr)],
      ...(akceptacja.kwota !== null ? ([["Kwota netto", `${Math.round(akceptacja.kwota)} zł`]] as [string, string][]) : []),
      ...(wybor ? ([["Wybór klienta w podglądzie", wybor]] as [string, string][]) : []),
    ]),
  );
  return json({ akceptacja: { wersja: nr, data: akceptacja.data, imie } }, 201);
});
