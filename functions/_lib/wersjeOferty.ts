/*
 * Pola oferty, które pisze tylko serwer (wersje, akceptacja klienta, przypomnienie) – panel ich nie wysyła
 * (validateOffer je pomija), więc przy każdym zapisie przenosimy je z poprzedniego stanu i dopisujemy wersję.
 */
import { dopiszWersje, roznice, skrotOferty } from "../../src/lib/wersje";
import { stampNow, type Offer } from "./offers";

export function zWersjami(incoming: Offer, existing: Offer | null, teraz = new Date()): Offer {
  const out: Offer = { ...incoming };
  delete out.wersje;
  delete out.akceptacja;
  delete out.przypomnienie;
  if (existing?.akceptacja) out.akceptacja = existing.akceptacja;
  // Przypomnienie zostaje, dopóki to ten sam link z tą samą datą ważności (przedłużony link – można przypomnieć znowu).
  if (existing?.przypomnienie && existing.link && out.link && existing.link.slug === out.link.slug && existing.link.expiresAt === out.link.expiresAt) {
    out.przypomnienie = existing.przypomnienie;
  }
  const stare = existing?.wersje ?? [];
  // Wersje liczą się od chwili, gdy klient może ofertę zobaczyć (link); szkic bez linku ich nie robi.
  const wersje = out.link ? dopiszWersje(stare, skrotOferty(out), teraz.toISOString()) : [...stare];
  if (wersje.length) out.wersje = wersje;
  const nowa = wersje.length > stare.length ? wersje[wersje.length - 1] : null;
  if (nowa && stare.length) {
    const zm = roznice(stare[stare.length - 1].skrot, nowa.skrot);
    const opis = `Nowa wersja oferty: ${nowa.nr}${zm.length ? ` (${zm.slice(0, 3).join("; ")}${zm.length > 3 ? "; …" : ""})` : ""}`;
    out.events = [...out.events, { t: stampNow(teraz), k: "edit" as const, x: opis.slice(0, 300) }].slice(-500);
  }
  return out;
}
