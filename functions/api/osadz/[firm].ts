/*
 * GET /api/osadz/:firm – publiczne dane widżetu kuchni 3D (strona /osadz?f=<firm>, w iframe na stronie firmy).
 * Tylko to, czego potrzebuje widżet: tytuł, materiały startowe, cena (jeśli pokazywana), model, pakiety RAL, marka.
 */
import { listPalettes, getModel, publicModel, publicPalettes } from "../../_lib/assets";
import { resolveEmbed } from "../../_lib/embed";
import { handle, HttpError, json, param } from "../../_lib/offers";
import { publicBrand } from "../../_lib/public";
import { FIRM_ID_RE, MAIN_FIRM } from "../../_lib/tenant";

export const onRequestGet = handle(async (ctx) => {
  const firmId = param(ctx, "firm");
  if (firmId !== MAIN_FIRM && !FIRM_ID_RE.test(firmId)) throw new HttpError(404, "embed_off", "Ta kuchnia 3D nie jest teraz dostępna.");
  const { kv, embed } = await resolveEmbed(ctx.env, firmId);
  const model = embed.modelId ? await getModel(kv, embed.modelId) : null;
  return json(
    {
      embed: {
        title: embed.title,
        showPrice: embed.showPrice,
        ...(embed.showPrice ? { base: embed.base } : {}),
        front: embed.front,
        countertop: embed.countertop,
        hardware: embed.hardware,
        model: model ? publicModel(model) : null,
        palettes: publicPalettes(await listPalettes(kv), embed.showPrice),
        brand: await publicBrand(kv),
      },
    },
    200,
    { "cache-control": "public, max-age=60" },
  );
});
