/*
 * GET /api/domena?d=kuchnie-kowalski.pl – czy domena już istnieje (Ustawienia → Domena → „Zamów domenę”).
 * Pytamy DNS (Cloudflare DNS over HTTPS, rekordy NS): NOERROR = domena istnieje (zajęta),
 * NXDOMAIN = brak w DNS (zwykle wolna – ostatecznie potwierdza rejestrator przy zakupie), inne = nie wiadomo.
 * Tylko dla zalogowanego panelu, limit 120 sprawdzeń na godzinę na firmę.
 */
import { bumpLimit, panel } from "../_lib/auth";
import { handle, HttpError, json, store } from "../_lib/offers";
import { normalizujDomene, type SprawdzenieDomeny } from "../../src/lib/domena";

export const onRequestGet = handle(async (ctx) => {
  const { session } = await panel(ctx);
  const wpis = new URL(ctx.request.url).searchParams.get("d") ?? "";
  const domena = normalizujDomene(wpis);
  if (!domena) throw new HttpError(400, "invalid", "To nie jest poprawna nazwa domeny, np. kuchnie-kowalski.pl.");
  await bumpLimit(store(ctx.env), `rate:domena:${session.firmId}`, 120, 3600, "Za dużo sprawdzeń domen. Spróbuj za godzinę.");
  let zajeta: boolean | null = null;
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domena)}&type=NS`, {
      headers: { accept: "application/dns-json" },
    });
    if (res.ok) {
      const d = (await res.json()) as { Status?: number };
      zajeta = d.Status === 0 ? true : d.Status === 3 ? false : null;
    }
  } catch {
    zajeta = null;
  }
  const wynik: SprawdzenieDomeny = { domena, zajeta };
  return json(wynik);
});
