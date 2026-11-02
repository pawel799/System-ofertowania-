/*
 * POST /api/public/:slug/wybor – strona klienta zgłasza, że klient zmienia kolory / materiały w podglądzie.
 * Body: { opis: string } (np. „kolory: fronty Grafit, boki Dąb…; blat …; okucia …”).
 * Nic nie zmienia w ofercie – tylko informacja dla firmy: zdarzenie w historii (najwyżej raz na 30 min)
 * i e-mail (najwyżej raz na 6 godzin na link), jeśli firma włączyła to powiadomienie.
 */
import { handle, HttpError, putOffer, readJson, stampNow } from "../../../_lib/offers";
import { resolvePublic } from "../../../_lib/public";
import { powiadomFirme, wTle } from "../../../_lib/powiadomienia";

export const onRequestPost = handle(async (ctx) => {
  const { kv, offer } = await resolvePublic(ctx);
  const link = offer.link!;
  const body = await readJson(ctx.request, 5000);
  const opis = body && typeof body === "object" && typeof (body as Record<string, unknown>).opis === "string" ? ((body as Record<string, string>).opis).replace(/\s+/g, " ").trim().slice(0, 600) : "";
  if (!opis) throw new HttpError(400, "invalid", "Brak opisu wyboru.");
  const zdarzenieKey = `wyborseen:${link.slug}`;
  if (await kv.get(zdarzenieKey)) return new Response(null, { status: 204 });
  await kv.put(zdarzenieKey, "1", { expirationTtl: 30 * 60 });
  await putOffer(kv, {
    ...offer,
    events: [...offer.events, { t: stampNow(), k: "wybor" as const, x: `Klient zmienia kolory: ${opis}`.slice(0, 300) }].slice(-500),
    updatedAt: new Date().toISOString(),
  });
  const mailKey = `wybormail:${link.slug}`;
  if (!(await kv.get(mailKey))) {
    await kv.put(mailKey, "1", { expirationTtl: 6 * 3600 });
    wTle(ctx, powiadomFirme(ctx, kv, offer, "wybor", [["Wybór w podglądzie", opis]]));
  }
  return new Response(null, { status: 204 });
});
