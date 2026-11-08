"use client";

/*
 * Zgody na pliki cookies + Google Consent Mode v2.
 *
 * Kategorie:
 *   niezbędne     – zawsze (sesja, ochrona przed botami, ustawienia) → security_storage, functionality_storage = granted
 *   analityczne   – analytics_storage
 *   marketingowe  – ad_storage, ad_user_data, ad_personalization
 *
 * Kolejność (wymóg Consent Mode v2): w <head> SKRYPT_ZGOD ustawia gtag('consent','default', …) = denied ZANIM
 * załaduje się jakikolwiek tag; zapisany wybór od razu idzie jako 'update'. Baner (ZgodyCookies.tsx) po decyzji
 * woła zapiszZgody() → 'update', zapis w przeglądarce i rejestr zgody na serwerze (/api/zgody, bez danych osobowych).
 *
 * Tagi Google ładujemy dopiero po zgodzie na analityczne albo marketingowe (tryb „basic” – bez pingów bez zgody),
 * i tylko gdy podano identyfikator przy budowaniu: NEXT_PUBLIC_GA_ID (GA4, G-XXXX) albo NEXT_PUBLIC_GTM_ID (GTM-XXXX).
 * Bez identyfikatora: Consent Mode i baner działają, ale żaden tag się nie ładuje.
 */
import { useSyncExternalStore } from "react";

import { KLUCZ_ZGOD, WAZNOSC_DNI, WERSJA_ZGOD } from "./zgodyStale";
export { KLUCZ_ZGOD, WAZNOSC_DNI, WERSJA_ZGOD };

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";

export type Zgody = { analityczne: boolean; marketingowe: boolean };
export type ZapisZgod = Zgody & { wersja: string; at: string; id: string };

type Gtag = (...a: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/** Sygnały Consent Mode v2 dla wyboru użytkownika. */
export function sygnaly(z: Zgody) {
  const m = z.marketingowe ? "granted" : "denied";
  return {
    ad_storage: m,
    ad_user_data: m,
    ad_personalization: m,
    analytics_storage: z.analityczne ? "granted" : "denied",
    functionality_storage: "granted",
    personalization_storage: "denied",
    security_storage: "granted",
  } as const;
}

/** Strony bez tagów i bez banera: kuchnia osadzona u firmy, podgląd maila, linki ofert firm (ich klienci). */
export function stronaBezZgod(sciezka: string) {
  if (sciezka.startsWith("/osadz") || sciezka.startsWith("/podglad-maila")) return true;
  // /oferta/<link firmy> – dane klientów firm; tylko /oferta/demo i /oferta/modul są naszymi stronami.
  return sciezka.startsWith("/oferta/") && !/^\/oferta\/(demo|modul)(\/|$)/.test(sciezka);
}

/* ---------- zapis ---------- */

export function odczytaj(): ZapisZgod | null {
  try {
    const z = JSON.parse(localStorage.getItem(KLUCZ_ZGOD) ?? "null") as ZapisZgod | null;
    if (!z || z.wersja !== WERSJA_ZGOD || typeof z.analityczne !== "boolean" || typeof z.marketingowe !== "boolean") return null;
    if (Date.now() - Date.parse(z.at) > WAZNOSC_DNI * 86400_000) return null;
    return z;
  } catch {
    return null;
  }
}

let stan: ZapisZgod | null | undefined;
let otwartePanel = false;
const sluchacze = new Set<() => void>();
const emit = () => sluchacze.forEach((l) => l());
const subskrybuj = (l: () => void) => {
  sluchacze.add(l);
  return () => {
    sluchacze.delete(l);
  };
};

export function useZgody() {
  return useSyncExternalStore(
    subskrybuj,
    () => {
      if (stan === undefined) stan = odczytaj();
      return stan;
    },
    () => null,
  );
}

export const usePanelZgod = () => useSyncExternalStore(subskrybuj, () => otwartePanel, () => false);

/** Otwiera ustawienia cookies (link w stopce, polityka cookies) – zmiana albo wycofanie zgody. */
export function otworzUstawieniaZgod() {
  otwartePanel = true;
  emit();
}
export function zamknijUstawieniaZgod() {
  otwartePanel = false;
  emit();
}

/** Zapasowy gtag, gdyby skrypt z <head> się nie wykonał. Wrzuca obiekt arguments (nie tablicę) – jak fragment kodu Google. */
const gtag: Gtag = function () {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
};

export function zapiszZgody(z: Zgody) {
  const poprzedni = stan ?? odczytaj();
  const zapis: ZapisZgod = { ...z, wersja: WERSJA_ZGOD, at: new Date().toISOString(), id: poprzedni?.id ?? losoweId() };
  try {
    localStorage.setItem(KLUCZ_ZGOD, JSON.stringify(zapis));
  } catch {
    /* bez pamięci – wybór działa do końca wizyty */
  }
  stan = zapis;
  otwartePanel = false;
  (window.gtag ?? gtag)("consent", "update", sygnaly(z));
  if (z.analityczne || z.marketingowe) zaladujTagi();
  // Cofnięcie zgody: usuwamy pliki Google z tej domeny (tagi i tak już nic nie zapiszą – consent = denied).
  if (!z.analityczne || !z.marketingowe) usunPlikiGoogle(z);
  // Rejestr zgody (rozliczalność, art. 7 ust. 1 RODO): losowy identyfikator, wersja, wybór, czas – bez IP i danych osobowych.
  void fetch("/api/zgody", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(zapis), keepalive: true }).catch(() => {});
  emit();
}

function losoweId() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function usunPlikiGoogle(z: Zgody) {
  const nazwy = document.cookie.split(";").map((c) => c.trim().split("=")[0]);
  const doUsuniecia = nazwy.filter((n) => (!z.analityczne && /^_ga(_|$)/.test(n)) || (!z.marketingowe && /^(_gcl_|_gac_|IDE|_fbp)/.test(n)));
  const domeny = ["", location.hostname, `.${location.hostname.split(".").slice(-2).join(".")}`];
  for (const n of doUsuniecia) for (const d of domeny) document.cookie = `${n}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
}

/* ---------- tagi Google (dopiero po zgodzie) ---------- */

let zaladowane = false;
export function zaladujTagi() {
  if (zaladowane || (!GA_ID && !GTM_ID) || stronaBezZgod(location.pathname)) return;
  zaladowane = true;
  if (GTM_ID) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
    document.head.appendChild(s);
  }
  if (GA_ID) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
    const g = window.gtag ?? gtag;
    g("js", new Date());
    g("config", GA_ID, { anonymize_ip: true });
  }
}
