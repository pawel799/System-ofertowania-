/*
 * /api/offers
 *   GET  – lista ofert (panel, wymaga tokenu); przy okazji w tle wysyła klientom przypomnienia
 *          o linkach wygasających w ciągu 3 dni (Pages Functions nie mają crona – panel firmy jest otwierany
 *          codziennie, więc to wystarcza; powiadomienia.ts)
 *   POST – nowa oferta (panel, wymaga tokenu)
 */
import { claimSlug, getOffer, handle, HttpError, json, listOffers, offerKey, putOffer, readJson, stampNow, validateOffer } from "../../_lib/offers";
import { doPrzypomnienia, getPowiadomienia, przypomnijKlientowi, wTle } from "../../_lib/powiadomienia";
import { mailConfigured } from "../../_lib/notify";
import { panel } from "../../_lib/auth";
import { checkRefs } from "../../_lib/assets";
import { checkKatalogRefs, snapshotOferty } from "../../_lib/katalog";
import { zCenaKuchni } from "../../_lib/kuchnia";
import { assertCanWrite, assertLimit, firmPlan, isActiveOffer } from "../../_lib/plan";
import { zWersjami } from "../../_lib/wersjeOferty";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const offers = await listOffers(kv);
  const doWyslania = offers.filter((o) => doPrzypomnienia(o));
  if (doWyslania.length && mailConfigured(ctx.env)) {
    wTle(
      ctx,
      (async () => {
        if (!(await getPowiadomienia(kv)).przypomnienia) return;
        const origin = new URL(ctx.request.url).origin;
        for (const o of doWyslania.slice(0, 20)) {
          // Znacznik przed wysyłką: dwa panele otwarte naraz nie wyślą klientowi dwóch maili.
          const flaga = `przypomnienie:${offerKey(o.id)}:${o.link!.slug}:${o.link!.expiresAt}`;
          if (await kv.get(flaga)) continue;
          await kv.put(flaga, "1", { expirationTtl: 7 * 24 * 3600 });
          if (!(await przypomnijKlientowi(ctx.env, kv, origin, o))) continue;
          const teraz = await getOffer(kv, offerKey(o.id));
          if (!teraz) continue;
          await putOffer(kv, {
            ...teraz,
            przypomnienie: new Date().toISOString(),
            events: [...teraz.events, { t: stampNow(), k: "remind" as const, x: `Przypomnienie o ważności linku wysłane do ${o.contact.trim()}` }].slice(-500),
          });
        }
      })(),
    );
  }
  return json({ offers });
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
  const saved = { ...zWersjami(offer, null), createdAt: now, updatedAt: now };
  await putOffer(kv, saved);
  return json({ offer: saved }, 201, { location: `/api/offers/${key}` });
});
