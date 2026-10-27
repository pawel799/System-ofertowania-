/*
 * Oferta handlowa jako HTML do druku (przeglądarka → „Zapisz jako PDF”).
 * Bez serwerowego renderu 3D: opcjonalnie jeden zrzut sceny z przeglądarki.
 * To nie jest lista formatek ani rozkrój.
 */
import { COUNTERTOPS, FRONTS, HARDWARE } from "../catalog";
import { findRalFront, type Palette } from "../palettes";
import { bazaKuchni, cenaElementu, RODZAJ_LABEL, rodzajElementu, STREFA_LABEL, UKLAD_KUCHNI_LABEL, type PlanKuchni } from "@/lib/kuchnia";
import type { ModulCennik } from "@/lib/modul";

export type PdfDane = {
  id: string;
  title: string;
  client: string;
  contact: string;
  firma: string;
  logo: string | null;
  plan: PlanKuchni;
  frontNazwa: string;
  blatNazwa: string;
  okuciaNazwa: string;
  /** cena null = urządzenie AGD, nie wchodzi do sumy. */
  pozycje: { nazwa: string; strefa: string; w: number; h: number; d: number; cena: number | null }[];
  sumaPozycji: number;
  dopFront: number;
  dopBlat: number;
  dopOkucia: number;
  razem: number;
  link3d: string | null;
  data: string;
  zdjecie: string | null;
  cennikUwaga: string | null;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function pln(n: number) {
  const digits = Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${n < 0 ? "−" : ""}${digits}\u00a0zł`;
}

export function danePdf(args: {
  id: string;
  title: string;
  client: string;
  contact: string;
  firma: string;
  logo: string | null;
  plan: PlanKuchni;
  front: string;
  countertop: string;
  hardware: string;
  palettes: Palette[];
  cennik: ModulCennik;
  cennikUwaga: string | null;
  link3d: string | null;
  zdjecie: string | null;
}): PdfDane {
  const frontSw = FRONTS.find((f) => f.id === args.front) ?? findRalFront(args.palettes, args.front);
  const blat = COUNTERTOPS.find((c) => c.id === args.countertop);
  const okucia = HARDWARE.find((h) => h.id === args.hardware);
  const pozycje = args.plan.elementy.map((e) => ({
    nazwa: e.nazwa,
    strefa: `${STREFA_LABEL[e.strefa]}${rodzajElementu(e) === "szafka" ? "" : ` · ${RODZAJ_LABEL[rodzajElementu(e)]}`}`,
    w: e.w,
    h: e.h,
    d: e.d,
    cena: cenaElementu(e, args.cennik),
  }));
  const sumaPozycji = bazaKuchni(args.plan, args.cennik);
  const dopFront = frontSw?.delta ?? 0;
  const dopBlat = blat?.delta ?? 0;
  const dopOkucia = okucia?.delta ?? 0;
  return {
    id: args.id,
    title: args.title,
    client: args.client,
    contact: args.contact,
    firma: args.firma,
    logo: args.logo,
    plan: args.plan,
    frontNazwa: frontSw?.name ?? args.front,
    blatNazwa: blat?.name ?? args.countertop,
    okuciaNazwa: okucia?.name ?? args.hardware,
    pozycje,
    sumaPozycji,
    dopFront,
    dopBlat,
    dopOkucia,
    razem: sumaPozycji + dopFront + dopBlat + dopOkucia,
    link3d: args.link3d,
    data: new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }),
    zdjecie: args.zdjecie && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(args.zdjecie) ? args.zdjecie : null,
    cennikUwaga: args.cennikUwaga,
  };
}

function wierszDop(nazwa: string, kwota: number) {
  if (!kwota) return "";
  const znak = kwota > 0 ? "dopłata" : "opust";
  return `<tr><td>${esc(nazwa)} <span class="muted">(${znak})</span></td><td></td><td class="num">${esc(pln(kwota))}</td></tr>`;
}

export function pdfHtml(d: PdfDane) {
  const uklad = UKLAD_KUCHNI_LABEL[d.plan.uklad];
  const sciany =
    d.plan.uklad === "L"
      ? `ściana A ${d.plan.scianaA} cm, ściana B ${d.plan.scianaB} cm`
      : `ściana ${d.plan.scianaA} cm`;
  const pokoj = d.plan.pomieszczenie ? ` Pomieszczenie ${d.plan.pomieszczenie.szer} × ${d.plan.pomieszczenie.dlug} cm.` : "";
  const wiersze = d.pozycje
    .map(
      (p, i) =>
        `<tr><td>${i + 1}. ${esc(p.nazwa)} <span class="muted">${esc(p.strefa)}</span></td><td class="num">${p.w} × ${p.h} × ${p.d} cm</td><td class="num">${p.cena === null ? '<span class="muted">AGD, poza ceną</span>' : esc(pln(p.cena))}</td></tr>`,
    )
    .join("");
  const logo = d.logo ? `<img class="logo" alt="" src="${esc(d.logo)}" />` : "";
  const zdjecie = d.zdjecie ? `<img class="shot" alt="Podgląd zabudowy" src="${d.zdjecie}" />` : "";
  const link = d.link3d
    ? `<p class="link">Osobny podgląd 3D (interaktywny, nie jest częścią tej wyceny w pliku):<br />${esc(d.link3d)}</p>`
    : `<p class="link">Podgląd 3D wysyłany jest osobno, linkiem z panelu.</p>`;
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8" />
<title>Oferta ${esc(d.id)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1c1917; font: 13px/1.45 "Segoe UI", system-ui, sans-serif; }
  header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 2px solid #1c1917; padding-bottom: 10px; }
  h1 { font-size: 22px; line-height: 1.15; margin: 4px 0 0; }
  .eyebrow { margin: 0; letter-spacing: .14em; text-transform: uppercase; font-size: 11px; color: #57534e; }
  .logo { height: 36px; width: auto; max-width: 160px; object-fit: contain; }
  .meta { margin: 14px 0; }
  .meta p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e7e5e4; vertical-align: top; }
  th { font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: #57534e; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sum td { font-weight: 650; border-bottom: 0; padding-top: 10px; }
  .muted { color: #78716c; }
  .shot { display: block; width: 100%; max-height: 280px; object-fit: contain; margin: 12px 0; background: #141311; }
  .note { margin-top: 16px; color: #44403c; font-size: 12px; }
  .link { word-break: break-all; }
  footer { margin-top: 18px; font-size: 11px; color: #78716c; }
</style>
</head>
<body>
<header>
  <div>
    <p class="eyebrow">${esc(d.firma)}</p>
    <h1>Oferta ${esc(d.id)}</h1>
    <p>${esc(d.title)}</p>
  </div>
  ${logo}
</header>
<section class="meta">
  <p><b>Dla:</b> ${esc(d.client || "—")}${d.contact ? ` · ${esc(d.contact)}` : ""}</p>
  <p><b>Data:</b> ${esc(d.data)}</p>
  <p><b>Układ:</b> ${esc(uklad)}. ${esc(sciany)}.${esc(pokoj)}</p>
  <p><b>Fronty:</b> ${esc(d.frontNazwa)} · <b>Blat:</b> ${esc(d.blatNazwa)} · <b>Okucia:</b> ${esc(d.okuciaNazwa)}</p>
</section>
${zdjecie}
<table>
  <thead><tr><th>Pozycja</th><th class="num">Wymiary (szer. × wys. × gł.)</th><th class="num">Netto</th></tr></thead>
  <tbody>
    ${wiersze || `<tr><td colspan="3">Brak pozycji.</td></tr>`}
    <tr><td>Zabudowa — szafki</td><td></td><td class="num">${esc(pln(d.sumaPozycji))}</td></tr>
    ${wierszDop(`Fronty: ${d.frontNazwa}`, d.dopFront)}
    ${wierszDop(`Blat: ${d.blatNazwa}`, d.dopBlat)}
    ${wierszDop(`Okucia: ${d.okuciaNazwa}`, d.dopOkucia)}
    <tr class="sum"><td>Razem netto</td><td></td><td class="num">${esc(pln(d.razem))}</td></tr>
  </tbody>
</table>
<p class="note">Kwoty netto, bez podatku VAT. Cena szafek wynika z cennika modułów firmy (baza, płyta, front, metr bieżący) i wymiarów. Urządzenia AGD (płyty, okapy, zlewozmywak, bateria, lodówka i mikrofalówka) nie są wliczone. Dopłaty za front, blat i okucia są takie jak na stronie podglądu 3D.</p>
${d.cennikUwaga ? `<p class="note">${esc(d.cennikUwaga)}</p>` : ""}
${link}
<footer>
  Dokument jest ofertą handlową. Nie zawiera rozkroju płyt, nestingu ani listy formatek do cięcia.
</footer>
<script>window.addEventListener("load", () => setTimeout(() => window.print(), 200));</script>
</body>
</html>`;
}

/** Treść maila z ofertą PDF — osobna od maila z linkiem 3D. */
export function pdfTekst(d: PdfDane) {
  const linie = d.pozycje.map(
    (p, i) => `${i + 1}. ${p.nazwa} (${p.strefa}) ${p.w}×${p.h}×${p.d} cm — ${p.cena === null ? "AGD, poza ceną" : pln(p.cena).replaceAll("\u00a0", " ")}`,
  );
  const plnSp = (n: number) => pln(n).replaceAll("\u00a0", " ");
  return [
    "Dzień dobry!",
    "",
    `Przesyłamy ofertę handlową ${d.id}: ${d.title}.`,
    `Układ: ${UKLAD_KUCHNI_LABEL[d.plan.uklad]}.`,
    `Fronty: ${d.frontNazwa}. Blat: ${d.blatNazwa}. Okucia: ${d.okuciaNazwa}.`,
    "",
    "Pozycje (netto):",
    ...(linie.length ? linie : ["(brak pozycji)"]),
    "",
    `Zabudowa — szafki: ${plnSp(d.sumaPozycji)}`,
    ...(d.dopFront ? [`Fronty: ${plnSp(d.dopFront)}`] : []),
    ...(d.dopBlat ? [`Blat: ${plnSp(d.dopBlat)}`] : []),
    ...(d.dopOkucia ? [`Okucia: ${plnSp(d.dopOkucia)}`] : []),
    `Razem netto: ${plnSp(d.razem)}`,
    "",
    "Plik PDF (układ do druku) zapiszesz przyciskiem „Pobierz PDF” w panelu: w oknie drukowania wybierz „Zapisz jako PDF” i dołącz go do tej wiadomości.",
    "Podgląd interaktywny 3D wysyłamy osobno.",
    "",
    "Kwoty netto, bez urządzeń AGD. To oferta handlowa, bez rozkroju płyt.",
    "Pozdrawiamy",
    d.firma,
  ].join("\n");
}

export function otworzPdf(html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
