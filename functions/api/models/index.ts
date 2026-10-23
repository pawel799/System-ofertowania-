/*
 * /api/models  (panel, wymaga tokenu)
 *   GET  – lista wgranych modeli 3D
 *   POST – nowy model: treść = plik GLB (już zoptymalizowany w przeglądarce),
 *          nagłówek X-Model-Name = nazwa (zakodowana encodeURIComponent).
 */
import { bucket, cleanName, isGlb, listModels, MAX_MODEL_BYTES, putModel, type ModelMeta } from "../../_lib/assets";
import { handle, HttpError, json, randomId } from "../../_lib/offers";
import { panel } from "../../_lib/auth";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  return json({ models: await listModels(kv) });
});

export const onRequestPost = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const r2 = bucket(ctx.env);
  const tooBig = new HttpError(413, "too_large", `Plik jest za duży (max ${MAX_MODEL_BYTES / 1024 / 1024} MB po optymalizacji).`);
  const declared = Number(ctx.request.headers.get("content-length") ?? 0);
  if (declared > MAX_MODEL_BYTES) throw tooBig;

  let rawName = "";
  try {
    rawName = decodeURIComponent(ctx.request.headers.get("x-model-name") ?? "");
  } catch {
    throw new HttpError(400, "invalid", "Zła nazwa modelu.");
  }
  const name = cleanName(rawName, "name");

  const buf = await ctx.request.arrayBuffer();
  if (buf.byteLength > MAX_MODEL_BYTES) throw tooBig;
  if (!isGlb(buf)) throw new HttpError(400, "not_glb", "To nie jest plik GLB (binarny glTF 2.0).");

  const id = randomId(16);
  const file = `models/${id}/1.glb`;
  await r2.put(file, buf, { httpMetadata: { contentType: "model/gltf-binary" } });
  const now = new Date().toISOString();
  const meta: ModelMeta = { id, name, size: buf.byteLength, version: 1, file, tags: {}, createdAt: now, updatedAt: now };
  await putModel(kv, meta);
  // Plik modelu jest publiczny (strona klienta) – zapamiętujemy, do której firmy należy.
  await kv.root.put(`modelowner:${id}`, kv.firmId);
  return json({ model: meta }, 201, { location: `/api/models/${id}` });
});
