/*
 * POST /api/public/:slug/comment – uwagi klienta do projektu ze strony oferty.
 * Body: { text: string, choice?: { front, countertop, hardware } }
 *   - działa tylko, gdy link ma włączone uwagi (link.comments),
 *   - oferta z PIN-em wymaga nagłówka X-Offer-Pin (jak GET),
 *   - limit: 10 uwag na link na godzinę (licznik w KV),
 *   - zapis: offer.comment (ostatnie uwagi), zdarzenie "comment" w historii,
 *     status -> "poprawki" (chyba że oferta jest już zaakceptowana).
 */
import { findMaterial } from "../../../../src/components/katalogFirmy";
import { listPalettes } from "../../../_lib/assets";
import { listKatalog } from "../../../_lib/katalog";
import { handle, HttpError, json, putOffer, readJson, stampNow } from "../../../_lib/offers";
import { resolvePublic } from "../../../_lib/public";

const MAX_PER_HOUR = 10;

export const onRequestPost = handle(async (ctx) => {
  const { kv, offer } = await resolvePublic(ctx);
  const link = offer.link!;
  if (!link.comments) throw new HttpError(403, "comments_off", "Uwagi do tej oferty są wyłączone.");

  const body = await readJson(ctx.request);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid", "Oczekiwano obiektu.");
  const b = body as Record<string, unknown>;
  if (typeof b.text !== "string") throw new HttpError(400, "invalid", "Napisz, co chcesz zmienić.");
  const text = b.text.replace(/\r\n?/g, "\n").trim();
  if (text.length < 3) throw new HttpError(400, "too_short", "Napisz, co chcesz zmienić.");
  if (text.length > 1800) throw new HttpError(400, "too_long", "Uwagi są za długie (max 1800 znaków).");

  const rateKey = `commentrate:${link.slug}`;
  const sent = Number((await kv.get(rateKey)) ?? 0);
  if (sent >= MAX_PER_HOUR) {
    throw new HttpError(429, "comment_limit", "Wysłano już dużo uwag. Spróbuj za godzinę albo napisz do nas.");
  }
  await kv.put(rateKey, String(sent + 1), { expirationTtl: 3600 });

  // Materiały, które klient miał wybrane w podglądzie (jeśli różnią się od oferty).
  let choiceNote = "";
  if (b.choice && typeof b.choice === "object" && !Array.isArray(b.choice)) {
    const c = b.choice as Record<string, unknown>;
    const ctxM = { palettes: await listPalettes(kv), katalog: await listKatalog(kv) };
    const nazwa = (rola: "front" | "countertop" | "hardware", v: unknown) => (typeof v === "string" ? findMaterial(rola, v, ctxM)?.name : undefined);
    const front = nazwa("front", c.front);
    const countertop = nazwa("countertop", c.countertop);
    const hardware = nazwa("hardware", c.hardware);
    const differs = c.front !== offer.front || c.countertop !== offer.countertop || c.hardware !== offer.hardware;
    if (front && countertop && hardware && differs) {
      choiceNote = ` (Wybór klienta w podglądzie: front ${front}, blat ${countertop}, okucia ${hardware}.)`;
    }
  }

  const comment = `${text}${choiceNote}`;
  const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;
  await putOffer(kv, {
    ...offer,
    comment,
    status: offer.status === "zaakceptowany" ? offer.status : "poprawki",
    events: [...offer.events, { t: stampNow(), k: "comment" as const, x: `Uwagi klienta: ${snippet}` }].slice(-500),
    updatedAt: new Date().toISOString(),
  });
  return json({ ok: true }, 201);
});
