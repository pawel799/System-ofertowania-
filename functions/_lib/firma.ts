/*
 * Wyszukiwanie firmy po NIP (wspólne dla /api/firma z panelu i /api/rejestracja/firma).
 * Nie eksportuje handlerów onRequest*, więc Cloudflare nie robi z tego trasy.
 *
 * 1. Wykaz podatników VAT (MF): nazwa, adres, REGON, KRS, status VAT. Limit: 100 wyszukiwań dziennie z IP.
 * 2. API KRS (MS): forma prawna i adres w rozbiciu, jeśli firma ma numer KRS.
 * Wyniki (firma znaleziona / brak w wykazie) trzymamy 24 h w KV pod firma:<nip>.
 */
import type { CompanyData, CompanyLookup } from "../../src/components/panel/company";
import type { KVNamespace } from "./offers";

const DAY_S = 24 * 60 * 60;

type VatSubject = {
  name?: string | null;
  nip?: string | null;
  regon?: string | null;
  krs?: string | null;
  statusVat?: string | null;
  workingAddress?: string | null;
  residenceAddress?: string | null;
};

type KrsAddress = {
  ulica?: string;
  nrDomu?: string;
  nrLokalu?: string;
  kodPocztowy?: string;
  miejscowosc?: string;
};

type KrsOdpis = {
  odpis?: {
    dane?: {
      dzial1?: {
        danePodmiotu?: { nazwa?: string; formaPrawna?: string };
        siedzibaIAdres?: { adres?: KrsAddress };
      };
    };
  };
};

function warsawDate() {
  // Wykaz VAT wymaga daty "na dzień" w strefie polskiej.
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
}

/** "ŚWIĘTOKRZYSKA 12, 00-916 WARSZAWA" → ulica, kod, miasto. */
function splitAddress(raw: string | null | undefined) {
  if (!raw) return { street: "", postalCode: "", city: "" };
  const match = /^(.*?),?\s*(\d{2}-\d{3})\s+(.+)$/.exec(raw.trim());
  if (!match) return { street: raw.trim(), postalCode: "", city: "" };
  return { street: match[1].replace(/,\s*$/, "").trim(), postalCode: match[2], city: match[3].trim() };
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Zostawiamy null – obsłużymy niżej jako błąd usługi.
  }
  return { status: res.status, json };
}

export async function lookup(nip: string): Promise<{ status: number; body: CompanyLookup }> {
  // 1. Wykaz VAT
  let vat: { status: number; json: unknown };
  try {
    vat = await fetchJson(`https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${warsawDate()}`);
  } catch {
    return { status: 502, body: { ok: false, error: "Wykaz VAT nie odpowiada. Spróbuj za chwilę albo wpisz dane ręcznie." } };
  }

  const vatJson = vat.json as { result?: { subject?: VatSubject | null }; message?: string } | null;
  if (vat.status === 429 || /limit/i.test(vatJson?.message ?? "")) {
    return { status: 429, body: { ok: false, error: "Dzisiejszy limit zapytań do wykazu VAT się wyczerpał. Wpisz dane ręcznie." } };
  }
  if (vat.status >= 500 || !vatJson) {
    return { status: 502, body: { ok: false, error: "Wykaz VAT nie odpowiada. Spróbuj za chwilę albo wpisz dane ręcznie." } };
  }

  const subject = vatJson.result?.subject;
  if (!subject) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "Nie ma tego NIP-u w wykazie podatników VAT. Firma może nie być czynnym podatnikiem VAT. Wpisz dane ręcznie.",
      },
    };
  }

  const address = splitAddress(subject.workingAddress ?? subject.residenceAddress);
  const company: CompanyData = {
    name: subject.name ?? "",
    nip,
    regon: subject.regon ?? "",
    krs: subject.krs ?? "",
    legalForm: "",
    street: address.street,
    postalCode: address.postalCode,
    city: address.city,
    vatStatus: subject.statusVat ?? "",
  };
  const sources: ("vat" | "krs")[] = ["vat"];

  // 2. KRS (tylko spółki i inne podmioty wpisane do KRS; JDG są w CEIDG)
  if (company.krs) {
    for (const rejestr of ["P", "S"]) {
      try {
        const krs = await fetchJson(
          `https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${company.krs}?rejestr=${rejestr}&format=json`,
        );
        if (krs.status !== 200 || !krs.json) continue;
        const dzial1 = (krs.json as KrsOdpis).odpis?.dane?.dzial1;
        const podmiot = dzial1?.danePodmiotu;
        const adres = dzial1?.siedzibaIAdres?.adres;
        if (podmiot?.nazwa) company.name = podmiot.nazwa;
        if (podmiot?.formaPrawna) company.legalForm = podmiot.formaPrawna;
        if (adres?.miejscowosc) {
          const number = [adres.nrDomu, adres.nrLokalu].filter(Boolean).join("/");
          company.street = [adres.ulica, number].filter(Boolean).join(" ") || company.street;
          company.postalCode = adres.kodPocztowy ?? company.postalCode;
          company.city = adres.miejscowosc;
        }
        sources.push("krs");
        break;
      } catch {
        // KRS jest tylko uzupełnieniem – dane z wykazu VAT wystarczą.
        break;
      }
    }
  }

  return { status: 200, body: { ok: true, company, sources } };
}

/** lookup() z buforem w KV. Zwraca też, czy wynik przyszedł z bufora (nie zużył limitu wykazu VAT). */
export async function cachedLookup(
  kv: KVNamespace | undefined,
  nip: string,
): Promise<{ status: number; body: CompanyLookup; cached: boolean }> {
  const key = `firma:${nip}`;
  try {
    const hit = kv ? await kv.get(key) : null;
    if (hit) return { ...(JSON.parse(hit) as { status: number; body: CompanyLookup }), cached: true };
  } catch {
    // Bufor jest tylko przyspieszeniem – bez niego pytamy usługi.
  }
  const { status, body } = await lookup(nip);
  // Buforujemy znalezione firmy i "brak w wykazie"; błędów usługi i limitu nie.
  if (kv && (status === 200 || status === 404)) {
    await kv.put(key, JSON.stringify({ status, body }), { expirationTtl: DAY_S }).catch(() => {});
  }
  return { status, body, cached: false };
}
