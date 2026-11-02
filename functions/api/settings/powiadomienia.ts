/*
 * /api/settings/powiadomienia (panel) – które e-maile wysyłamy (powiadomienia.ts).
 *   GET – { powiadomienia, adresy, poczta }  (adresy = dokąd idą powiadomienia firmy; poczta = czy Resend skonfigurowany)
 *   PUT – { otwarcie, akceptacja, uwagi, wybor, przypomnienia } (tylko właściciel konta)
 */
import { panel, requireOwner } from "../../_lib/auth";
import { mailConfigured } from "../../_lib/notify";
import { handle, json, readJson } from "../../_lib/offers";
import { adresyFirmy, getPowiadomienia, parsePowiadomienia, putPowiadomienia } from "../../_lib/powiadomienia";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  return json({ powiadomienia: await getPowiadomienia(kv), adresy: await adresyFirmy(ctx.env, kv), poczta: mailConfigured(ctx.env) });
});

export const onRequestPut = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  requireOwner(session);
  const u = parsePowiadomienia(await readJson(ctx.request, 2_000));
  await putPowiadomienia(kv, u);
  return json({ powiadomienia: u, adresy: await adresyFirmy(ctx.env, kv), poczta: mailConfigured(ctx.env) });
});
