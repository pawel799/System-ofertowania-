/*
 * GET /api/rejestracja/firma?nip=1234567890 – publiczne podpowiadanie nazwy firmy w formularzu
 * rejestracji (/rejestracja). Bez tokenu panelu, dlatego:
 *   - zwraca tylko nazwę i miejscowość (bez REGON, KRS, adresu, statusu VAT),
 *   - limit 10 zapytań na godzinę z jednego IP (klucz rate:rej:<ip> w KV),
 *   - limit 50 zapytań dziennie do wykazu VAT dla całej strony (rate:rej-dzien:<data>),
 *     żeby rejestracja nie zjadła panelowi dziennego limitu 100 wyszukiwań MF.
 *     Wyniki z bufora KV (firma:<nip>, 24 h) nie liczą się do limitu dziennego.
 * Panel dalej używa /api/firma z tokenem i pełnymi danymi.
 */
import { cleanNip, isValidNip } from "../../../src/components/panel/company";
import { cachedLookup } from "../../_lib/firma";
import type { Ctx } from "../../_lib/offers";

const PER_IP_HOUR = 10;
const PER_DAY = 50;

type Reply = { ok: true; name: string; city: string } | { ok: false; error: string };

function reply(body: Reply, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function bump(kv: NonNullable<Ctx["env"]["OFFERS"]>, key: string, limit: number, ttl: number) {
  const n = Number((await kv.get(key)) ?? 0);
  if (n >= limit) return false;
  await kv.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
}

export async function onRequestGet(ctx: Ctx) {
  const kv = ctx.env.OFFERS;
  if (!kv) return reply({ ok: false, error: "Wyszukiwanie firm jest chwilowo niedostępne. Wpisz nazwę ręcznie." }, 503);

  const nip = cleanNip(new URL(ctx.request.url).searchParams.get("nip") ?? "");
  if (!isValidNip(nip)) {
    return reply({ ok: false, error: "To nie jest poprawny NIP. Sprawdź, czy ma 10 cyfr i nie ma literówki." }, 400);
  }

  const ip = ctx.request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await bump(kv, `rate:rej:${ip}`, PER_IP_HOUR, 3600))) {
    return reply({ ok: false, error: "Za dużo wyszukiwań. Wpisz nazwę firmy ręcznie albo spróbuj za godzinę." }, 429);
  }

  // Najpierw bufor: znana firma nie zużywa dziennego limitu.
  const cachedRaw = await kv.get(`firma:${nip}`).catch(() => null);
  if (!cachedRaw) {
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
    if (!(await bump(kv, `rate:rej-dzien:${day}`, PER_DAY, 26 * 3600))) {
      return reply({ ok: false, error: "Wyszukiwanie firm jest na dziś niedostępne. Wpisz nazwę ręcznie." }, 429);
    }
  }

  const { status, body } = await cachedLookup(kv, nip);
  if (!body.ok) return reply({ ok: false, error: body.error }, status);
  return reply({ ok: true, name: body.company.name, city: body.company.city }, 200);
}
