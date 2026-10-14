/*
 * /api/offers
 *   GET  – lista ofert (panel, wymaga tokenu)
 *   POST – nowa oferta (panel, wymaga tokenu)
 */
import {
  claimSlug,
  getOffer,
  handle,
  HttpError,
  json,
  listOffers,
  offerKey,
  putOffer,
  readJson,
  requirePanel,
  store,
  validateOffer,
} from "../../_lib/offers";
import { checkRefs } from "../../_lib/assets";

export const onRequestGet = handle(async (ctx) => {
  await requirePanel(ctx);
  return json({ offers: await listOffers(store(ctx.env)) });
});

export const onRequestPost = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const offer = validateOffer(await readJson(ctx.request));
  await checkRefs(kv, offer);
  const key = offerKey(offer.id);
  if (await getOffer(kv, key)) {
    throw new HttpError(409, "exists", `Oferta ${offer.id} już istnieje. Odśwież listę.`);
  }
  if (offer.link) await claimSlug(kv, offer.link.slug, key);
  const now = new Date().toISOString();
  const saved = { ...offer, createdAt: now, updatedAt: now };
  await putOffer(kv, saved);
  return json({ offer: saved }, 201, { location: `/api/offers/${key}` });
});
