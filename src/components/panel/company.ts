/*
 * Dane firmy klienta. Wspólne dla formularza w panelu i endpointu /api/firma.
 */

export type CompanyData = {
  name: string;
  nip: string;
  regon: string;
  krs: string;
  /** Forma prawna z KRS, np. "SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ". */
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  /** Status w wykazie VAT: "Czynny", "Zwolniony" albo "Niezarejestrowany". */
  vatStatus: string;
};

export type CompanyLookup =
  | { ok: true; company: CompanyData; sources: ("vat" | "krs")[] }
  | { ok: false; error: string };

/** Sama cyfra z wpisanego NIP-u (bez kresek, spacji i prefiksu PL). */
export function cleanNip(value: string) {
  return value.replace(/^PL/i, "").replace(/\D/g, "");
}

/** Suma kontrolna NIP: wagi 6,5,7,2,3,4,5,6,7, reszta z 11 = ostatnia cyfra. */
export function isValidNip(value: string) {
  const nip = cleanNip(value);
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0);
  const check = sum % 11;
  return check !== 10 && check === Number(nip[9]);
}

/** Zapis do wyświetlenia: 526-025-02-74. */
export function formatNip(value: string) {
  const n = cleanNip(value);
  return n.length === 10 ? `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}` : value;
}
