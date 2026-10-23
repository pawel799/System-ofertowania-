import { safeEqual } from "./auth";
/*
 * Strona klienta (/oferta/<link>): szukanie oferty po linku w przestrzeni właściwej firmy.
 * Link (slug) jest wspólny dla wszystkich firm – jego wartość mówi, do której firmy należy oferta.
 */
import { getBrand } from "./brand";
import { getOffer, HttpError, param, SLUG_RE, store, type Ctx, type KVNamespace, type Offer } from "./offers";
import { getFirm, MAIN_FIRM, parseSlugValue, scoped, type ScopedKV } from "./tenant";

/** Nazwa i logo firmy dla strony klienta (bez danych kontaktowych). */
export async function publicBrand(kv: KVNamespace) {
  const b = await getBrand(kv);
  return b ? { name: b.name, logo: b.logo } : null;
}

/** Szuka aktywnego linku i sprawdza ważność oraz PIN. Rzuca HttpError z polskim komunikatem. */
export async function resolvePublic(ctx: Ctx): Promise<{ kv: ScopedKV; key: string; offer: Offer }> {
  const root = store(ctx.env);
  const slug = param(ctx, "slug");
  const notFound = new HttpError(404, "not_found", "Nie znaleźliśmy tej oferty.");
  if (!SLUG_RE.test(slug)) throw notFound;
  const raw = await root.get(`slug:${slug}`);
  if (!raw) throw notFound;
  const { firmId, key } = parseSlugValue(raw);
  if (firmId !== MAIN_FIRM) {
    const firm = await getFirm(root, firmId);
    // Zawieszona firma: linki jej klientów przestają działać tak samo jak usunięte.
    if (!firm || firm.status === "suspended") throw notFound;
  }
  const kv = scoped(root, firmId);
  const offer = await getOffer(kv, key);
  if (!offer || !offer.link || offer.link.slug !== slug) throw notFound;
  const brand = await publicBrand(kv);
  if (offer.link.expiresAt && Date.parse(offer.link.expiresAt) < Date.now()) {
    throw new HttpError(410, "expired", "Link do tej oferty wygasł.", { brand });
  }
  if (offer.link.pin) {
    // Licznik błędnych PIN-ów jest wspólny (klucz po linku), niezależnie od firmy.
    const failKey = `pinfail:${slug}`;
    const fails = Number((await root.get(failKey)) ?? 0);
    if (fails >= 10) throw new HttpError(429, "pin_locked", "Za dużo prób PIN-u. Spróbuj za godzinę.", { brand });
    const given = ctx.request.headers.get("x-offer-pin") ?? "";
    if (!given) throw new HttpError(401, "pin_required", "Ta oferta jest chroniona PIN-em.", { brand });
    if (!safeEqual(given, offer.link.pin)) {
      await root.put(failKey, String(fails + 1), { expirationTtl: 3600 });
      throw new HttpError(401, "pin_wrong", "Nieprawidłowy PIN.", { brand });
    }
  }
  return { kv, key, offer };
}
