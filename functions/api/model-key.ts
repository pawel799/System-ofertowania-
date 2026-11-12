/*
 * GET /api/model-key – klucz do odszyfrowania modelu 3D strony (public/models/kitchen.enc).
 *
 * Wydawany tylko zapytaniom ze skryptu tej strony (nagłówki Sec-Fetch-* ustawia przeglądarka
 * i strona nie może ich podrobić): nie da się go otworzyć wpisując adres, z innej domeny
 * ani z linku do pobrania. Do tego limit zapytań na IP i brak cache.
 *
 * To utrudnia pobranie modelu, ale go nie uniemożliwia: model wyświetlany w WebGL musi trafić
 * do przeglądarki, więc zdeterminowana osoba z narzędziami deweloperskimi może go wyciągnąć.
 * Szczegóły: docs/ochrona-modeli.md.
 */
import { bumpLimit, clientIp } from "../_lib/auth";
import { handle, HttpError, json, store } from "../_lib/offers";

type KeyEnv = { MODEL_KEY?: string };

export const onRequestGet = handle(async (ctx) => {
  const h = ctx.request.headers;
  const site = h.get("sec-fetch-site");
  const dest = h.get("sec-fetch-dest");
  const mode = h.get("sec-fetch-mode");
  if (site !== "same-origin" || dest !== "empty" || (mode !== "cors" && mode !== "same-origin")) {
    throw new HttpError(403, "forbidden", "Brak dostępu.");
  }
  const hex = ((ctx.env as KeyEnv).MODEL_KEY ?? "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new HttpError(503, "no_model_key", "Na serwerze nie ustawiono sekretu MODEL_KEY.");
  }
  await bumpLimit(store(ctx.env), `rate:modelkey:${clientIp(ctx)}`, 60, 600, "Za dużo zapytań. Spróbuj za kilka minut.");
  const bin = hex.match(/../g)!.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
  return json({ key: btoa(bin) }, 200, { "cache-control": "no-store, private", vary: "sec-fetch-site, sec-fetch-dest" });
});
