/*
 * GET /api/models/:id/file – plik GLB modelu (publiczny: potrzebuje go strona klienta).
 * Adres w ofercie ma ?v=<wersja>, więc plik można trzymać w cache bez końca.
 * Id modelu jest losowe (16 znaków), jak link do oferty.
 */
import { bucket, getModel, modelId } from "../../../_lib/assets";
import { handle, HttpError, param, store } from "../../../_lib/offers";
import { MAIN_FIRM, scoped } from "../../../_lib/tenant";

export const onRequestGet = handle(async (ctx) => {
  const id = modelId(param(ctx, "id"));
  const root = store(ctx.env);
  // Modele firm z kontami leżą w ich przestrzeni KV; brak wpisu = firma "main".
  const firmId = (await root.get(`modelowner:${id}`)) ?? MAIN_FIRM;
  const m = await getModel(scoped(root, firmId), id);
  if (!m) throw new HttpError(404, "not_found", "Nie ma takiego modelu.");
  const obj = await bucket(ctx.env).get(m.file);
  if (!obj) throw new HttpError(404, "not_found", "Brak pliku modelu.");
  const etag = obj.httpEtag;
  if (ctx.request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag } });
  return new Response(obj.body, {
    headers: {
      "content-type": "model/gltf-binary",
      "content-length": String(obj.size),
      "cache-control": "public, max-age=31536000, immutable",
      etag,
    },
  });
});
