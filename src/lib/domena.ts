/*
 * Zamawiana domena (Ustawienia → Domena → „Zamów domenę”): poprawny zapis nazwy i wynik sprawdzenia,
 * czy domena już istnieje (functions/api/domena.ts pyta DNS). Wspólne dla panelu i serwera.
 */

/** Wynik sprawdzenia: zajeta = true (domena istnieje w DNS), false (brak w DNS – zwykle wolna), null (nie wiadomo). */
export type SprawdzenieDomeny = { domena: string; zajeta: boolean | null };

const ETYKIETA = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^(?:[a-z]{2,24}|xn--[a-z0-9-]{1,59})$/;

/**
 * Nazwa domeny do sprawdzenia: małe litery, bez „https://”, „www.” i ścieżki, polskie znaki jako punycode
 * (przez URL). null = to nie jest poprawna nazwa domeny (np. „kuchnie”, „a..pl”, „-x.pl”).
 */
export function normalizujDomene(wpis: string): string | null {
  let s = wpis.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  if (s.startsWith("www.")) s = s.slice(4);
  let host: string;
  try {
    host = new URL(`http://${s}`).hostname;
  } catch {
    return null;
  }
  if (host.length > 253) return null;
  const czesci = host.split(".");
  if (czesci.length < 2 || czesci.length > 4) return null;
  if (!czesci.every((c) => ETYKIETA.test(c))) return null;
  if (!TLD.test(czesci[czesci.length - 1])) return null;
  return host;
}

/** Kilka propozycji w jednym polu („a.pl, b.pl” albo w osobnych liniach) – bez powtórzeń. */
export const listaDomen = (tekst: string) =>
  Array.from(new Set(tekst.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))).slice(0, 10);
