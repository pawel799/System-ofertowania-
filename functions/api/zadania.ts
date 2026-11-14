/*
 * POST /api/zadania – zadania w tle na żądanie (codziennie z GitHub Actions: .github/workflows/zadania.yml).
 * Wymaga nagłówka Authorization: Bearer <CRON_SECRET>. Bez ustawionego CRON_SECRET – 404 (wyłączone);
 * zadania i tak ruszają przy okazji ruchu na /api/* (najwyżej raz na godzinę).
 */
import { safeEqual } from "../_lib/auth";
import { handle, HttpError, json, store } from "../_lib/offers";
import { uruchomZadania } from "../_lib/zadania";

export const onRequestPost = handle(async (ctx) => {
  const sekret = ctx.env.CRON_SECRET;
  if (!sekret) throw new HttpError(404, "not_found", "Nie ma takiego adresu.");
  const podany = (ctx.request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!podany || !safeEqual(podany, sekret)) throw new HttpError(401, "unauthorized", "Zły sekret.");
  const wynik = await uruchomZadania(ctx.env, store(ctx.env), new URL(ctx.request.url).origin, true);
  return json({ ok: true, ...wynik });
});
