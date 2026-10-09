/*
 * /api/offers/:id  (id = numer oferty z "/" zamienionym na "_", np. KUCH-2026_12)
 *   GET    – jedna oferta
 *   PUT    – zapis zmian z panelu (łączy otwarcia zapisane w międzyczasie przez klienta)
 *   DELETE – usunięcie oferty i jej linku
 * Wszystko wymaga tokenu panelu.
 */
import {
  claimSlug,
  getOffer,
  handle,
  HttpError,
  json,
  KEY_RE,
  offerKey,
  param,
  putOffer,
  readJson,
  requirePanel,
  store,
  validateOffer,
  type Ctx,
} from "../../_lib/offers";

function keyOf(ctx: Ctx) {
  const key = param(ctx, "id");
  if (!KEY_RE.test(key)) throw new HttpError(400, "invalid", "Zły identyfikator oferty.");
  return key;
}

const notFound = () => new HttpError(404, "not_found", "Nie ma takiej oferty.");

export const onRequestGet = handle(async (ctx) => {
  await requirePanel(ctx);
  const offer = await getOffer(store(ctx.env), keyOf(ctx));
  if (!offer) throw notFound();
  return json({ offer });
});

export const onRequestPut = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const key = keyOf(ctx);
  const incoming = validateOffer(await readJson(ctx.request));
  if (offerKey(incoming.id) !== key) throw new HttpError(400, "id_mismatch", "Numer oferty nie pasuje do adresu.");
  const existing = await getOffer(kv, key);
  if (!existing) throw notFound();

  const merged = { ...incoming };
  const oldSlug = existing.link?.slug ?? null;
  const newSlug = merged.link?.slug ?? null;

  if (merged.link && oldSlug === newSlug && existing.link) {
    // Panel mógł mieć starsze dane: nie gubimy otwarć zapisanych przez stronę klienta.
    merged.link = { ...merged.link, views: Math.max(merged.link.views, existing.link.views) };
    const seen = new Set(merged.events.map((e) => JSON.stringify(e)));
    const missing = existing.events.filter((e) => e.k === "open" && !seen.has(JSON.stringify(e)));
    if (missing.length) {
      merged.events = [...merged.events, ...missing];
      if (merged.status === "wyslany") merged.status = "otwarty";
    }
  }

  if (newSlug && newSlug !== oldSlug) await claimSlug(kv, newSlug, key);
  if (oldSlug && oldSlug !== newSlug && (await kv.get(`slug:${oldSlug}`)) === key) {
    await kv.delete(`slug:${oldSlug}`); // link cofnięty albo wymieniony: stary przestaje działać
  }

  const saved = { ...merged, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  await putOffer(kv, saved);
  return json({ offer: saved });
});

export const onRequestDelete = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const key = keyOf(ctx);
  const existing = await getOffer(kv, key);
  if (!existing) throw notFound();
  const slug = existing.link?.slug;
  if (slug && (await kv.get(`slug:${slug}`)) === key) await kv.delete(`slug:${slug}`);
  await kv.delete(`offer:${key}`);
  return new Response(null, { status: 204 });
});
