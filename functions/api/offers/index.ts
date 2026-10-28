/*
 * /api/offers
 *   GET  – lista ofert (panel, wymaga tokenu)
 *   POST – nowa oferta (panel, wymaga tokenu)
 */
import { claimSlug, getOffer, handle, HttpError, json, listOffers, offerKey, putOffer, readJson, validateOffer } from "../../_lib/offers";
import { panel } from "../../_lib/auth";
import { checkRefs } from "../../_lib/assets";
import { checkKatalogRefs, snapshotOferty } from "../../_lib/katalog";
import { zCenaKuchni } from "../../_lib/kuchnia";
import { assertCanWrite, assertLimit, firmPlan, isActiveOffer } from "../../_lib/plan";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  return json({ offers: await listOffers(kv) });
});

export const onRequestPost = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  const fp = await firmPlan(ctx.env, session);
  assertCanWrite(fp);
  const offer = await zCenaKuchni(kv, validateOffer(await readJson(ctx.request)));
  if (fp.plan?.limits.activeOffers != null) {
    assertLimit(fp, "activeOffers", (await listOffers(kv)).filter((o) => isActiveOffer(o)).length);
  }
  await checkRefs(kv, offer);
  await checkKatalogRefs(kv, offer);
  offer.materialy = await snapshotOferty(kv, offer);
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
