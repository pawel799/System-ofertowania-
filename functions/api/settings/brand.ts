/*
 * /api/settings/brand (panel, wymaga kodu dostępu)
 *   GET – { brand: { name, logo } | null }
 *   PUT – { name: string, logo: string | null } – logo jako data URL (PNG/JPG/WebP/SVG, max 200 KB)
 */
import { BRAND_KEY, getBrand, LOGO_MAX_BYTES, LOGO_RE } from "../../_lib/brand";
import { handle, HttpError, json, readJson, requirePanel, store } from "../../_lib/offers";

export const onRequestGet = handle(async (ctx) => {
  await requirePanel(ctx);
  return json({ brand: await getBrand(store(ctx.env)) });
});

export const onRequestPut = handle(async (ctx) => {
  await requirePanel(ctx);
  const kv = store(ctx.env);
  const body = (await readJson(ctx.request, 300_000)) as { name?: unknown; logo?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  let logo: string | null = null;
  if (body?.logo !== null && body?.logo !== undefined && body.logo !== "") {
    if (typeof body.logo !== "string" || !LOGO_RE.test(body.logo)) {
      throw new HttpError(400, "invalid_logo", "Logo musi być plikiem PNG, JPG, WebP albo SVG.");
    }
    const bytes = Math.floor((body.logo.length - body.logo.indexOf(",") - 1) * 0.75);
    if (bytes > LOGO_MAX_BYTES) throw new HttpError(413, "too_large", "Logo jest za duże – maksymalnie 200 KB.");
    logo = body.logo;
  }
  const brand = { name, logo, updatedAt: new Date().toISOString() };
  await kv.put(BRAND_KEY, JSON.stringify(brand));
  return json({ brand });
});
