/*
 * /api/settings/cennik (panel) – cennik modułów parametrycznych firmy.
 *   GET – { cennik }
 *   PUT – { baza, plytaM2, frontM2, mb, szuflada, drazek, plyty, plytaDomyslna, odpadPlyty, pozycje } (tylko właściciel konta)
 */
import { panel, requireOwner } from "../../_lib/auth";
import { CENNIK_KEY, getCennik, validateCennik } from "../../_lib/modul";
import { handle, json, readJson } from "../../_lib/offers";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  return json({ cennik: await getCennik(kv) });
});

export const onRequestPut = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  requireOwner(session);
  const cennik = validateCennik(await readJson(ctx.request, 24_000));
  await kv.put(CENNIK_KEY, JSON.stringify({ ...cennik, updatedAt: new Date().toISOString() }));
  return json({ cennik });
});
