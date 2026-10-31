/*
 * Oferta handlowa jako HTML do druku (przeglądarka → „Zapisz jako PDF”).
 * Bez serwerowego renderu 3D: opcjonalnie jeden zrzut sceny z przeglądarki.
 * To nie jest lista formatek ani rozkrój.
 */
import qrcode from "qrcode-generator";
import type { Palette } from "../palettes";
import { findMaterial, type KatalogPozycja, type MaterialySnapshot } from "../katalogFirmy";
import { opisWnetrza } from "@/lib/wnetrze";
import { cenaElementu, RODZAJ_LABEL, rodzajElementu, STREFA_LABEL, UKLAD_KUCHNI_LABEL, type PlanKuchni } from "@/lib/kuchnia";
import { cennikZPlyta, type ModulCennik } from "@/lib/modul";
import { cenaKoncowa } from "@/lib/cenaKoncowa";
import { grupyMaterialow, maAgd, opisGrup, type GrupyMaterialow } from "@/lib/opcjeProjektu";
import { slowaProjektu, type SlowaProjektu, type TypProjektu } from "@/lib/projekt";

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
  /** Suma mebli (pozycje z ceną). */
  sumaPozycji: number;
  /** Dodatki do ceny (transport, montaż, rabat…) z kwotą – cenaKoncowa. */
  dodatki: { nazwa: string; opis?: string; kwota: number }[];
  /** Płyta korpusów oferty, np. „Egger 18 mm (18 mm)”; null = brak listy płyt w cenniku. */
  plytaNazwa: string | null;
  dopFront: number;
  dopBlat: number;
  dopOkucia: number;
  razem: number;
  link3d: string | null;
  /** Do kiedy działa link 3D (np. „10 listopada 2026”); null = bez daty. */
  link3dWazny: string | null;
  /** Link z PIN-em – PIN idzie do klienta osobno, nie ma go w PDF. */
  link3dPin: boolean;
  data: string;
  zdjecie: string | null;
  cennikUwaga: string | null;
  /** Materiały, które projekt ma (opcjeProjektu.ts) – reszty nie ma w PDF ani w cenie. */
  grupy: GrupyMaterialow;
  /** „Kuchnia w 3D” / „Szafa w 3D” / „Projekt w 3D”. */
  slowa: SlowaProjektu;
  /** Są urządzenia AGD – dopisek, że nie są wliczone. */
  agd: boolean;
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
  /** Katalog materiałów firmy i snapshot oferty (nazwy, grubości, dopłaty). */
  katalog?: readonly KatalogPozycja[];
  snapshot?: MaterialySnapshot | null;
  cennik: ModulCennik;
  cennikUwaga: string | null;
  link3d: string | null;
  link3dWazny?: string | null;
  link3dPin?: boolean;
  zdjecie: string | null;
  /** Modele użyte w planie (oznaczenia ról: front, blat, uchwyt). */
  modele?: readonly { id: string; tags: Record<string, "front" | "blat" | "uchwyt"> }[];
  projekt?: TypProjektu;
}): PdfDane {
  const grupy = grupyMaterialow({ plan: args.plan, modele: args.modele ?? [] });
  // Snapshot oferty → katalog firmy / RAL → zestaw wbudowany (nigdy gołe id w PDF).
  const mctx = { palettes: args.palettes, katalog: args.katalog, snapshot: args.snapshot };
  const frontSw = findMaterial("front", args.front, mctx);
  const blat = findMaterial("countertop", args.countertop, mctx);
  const okucia = findMaterial("hardware", args.hardware, mctx);
  const zGruboscia = (m: { name: string; thicknessMm?: number } | undefined, id: string) =>
    m ? `${m.name}${m.thicknessMm ? ` (${String(m.thicknessMm).replace(".", ",")} mm)` : ""}` : id;
  const cennikPlyty = cennikZPlyta(args.cennik, args.plan.plyta);
  const pozycje = args.plan.elementy.map((e) => ({
    nazwa: e.nazwa,
    // Zapisane wnętrze (półki, szuflady, drążki, drzwi) – klient widzi, co dostaje w środku.
    strefa: `${STREFA_LABEL[e.strefa]}${rodzajElementu(e) === "szafka" ? "" : ` · ${RODZAJ_LABEL[rodzajElementu(e)]}`}${e.wnetrze ? ` · ${opisWnetrza(e.wnetrze)}` : ""}`,
    w: e.w,
    h: e.h,
    d: e.d,
    cena: cenaElementu(e, cennikPlyty),
  }));
  // Meble, dodatki i płyta – ta sama funkcja co cena w kreatorze i na serwerze (cenaKoncowa).
  const cena = cenaKoncowa({ plan: args.plan, cennik: args.cennik, zl: pln });
  const sumaPozycji = cena.meble;
  const dopFront = grupy.front ? (frontSw?.delta ?? 0) : 0;
  const dopBlat = grupy.blat ? (blat?.delta ?? 0) : 0;
  const dopOkucia = grupy.okucia ? (okucia?.delta ?? 0) : 0;
  return {
    id: args.id,
    title: args.title,
    client: args.client,
    contact: args.contact,
    firma: args.firma,
    logo: args.logo,
    plan: args.plan,
    frontNazwa: zGruboscia(frontSw, args.front),
    blatNazwa: zGruboscia(blat, args.countertop),
    okuciaNazwa: okucia?.name ?? args.hardware,
    pozycje,
    sumaPozycji,
    dopFront,
    dopBlat,
    dopOkucia,
    dodatki: cena.skladniki.filter((x) => x.rodzaj === "dodatek").map((x) => ({ nazwa: x.nazwa, opis: x.opis, kwota: x.kwota })),
    plytaNazwa: cena.plyta ? `${cena.plyta.nazwa}` : null,
    razem: cena.baza + dopFront + dopBlat + dopOkucia,
    link3d: args.link3d,
    link3dWazny: args.link3d ? (args.link3dWazny ?? null) : null,
    link3dPin: !!args.link3d && !!args.link3dPin,
    data: new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }),
    zdjecie: args.zdjecie && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(args.zdjecie) ? args.zdjecie : null,
    cennikUwaga: args.cennikUwaga,
    grupy,
    slowa: slowaProjektu(args.projekt),
    agd: maAgd(args.plan),
  };
}

function wierszDop(nazwa: string, kwota: number) {
  if (!kwota) return "";
  const znak = kwota > 0 ? "dopłata" : "opust";
  return `<tr><td>${esc(nazwa)} <span class="muted">(${znak})</span></td><td></td><td class="num">${esc(pln(kwota))}</td></tr>`;
}

/** „Fronty: … · Blat: … · Okucia: …” – tylko materiały, które projekt ma. */
function materialyTekst(d: PdfDane, sep: string) {
  return [
    d.grupy.front ? `Fronty: ${d.frontNazwa}` : null,
    d.grupy.blat ? `Blat: ${d.blatNazwa}` : null,
    d.grupy.okucia ? `Okucia: ${d.okuciaNazwa}` : null,
  ]
    .filter(Boolean)
    .join(sep);
}

function materialyHtml(d: PdfDane) {
  const czesci = [
    d.grupy.front ? `<b>Fronty:</b> ${esc(d.frontNazwa)}` : null,
    d.grupy.blat ? `<b>Blat:</b> ${esc(d.blatNazwa)}` : null,
    d.grupy.okucia ? `<b>Okucia:</b> ${esc(d.okuciaNazwa)}` : null,
  ].filter(Boolean);
  return czesci.length ? `<p>${czesci.join(" · ")}</p>` : "";
}

const NOTA_AGD = "Urządzenia AGD (płyty, okapy, zlewozmywak, bateria, lodówka i mikrofalówka) nie są wliczone.";

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
    ? `<p class="link">${esc(d.slowa.nazwa)} w 3D (interaktywna, nie jest częścią tej wyceny w pliku):<br />${esc(d.link3d)}</p>`
    : `<p class="link">Podgląd 3D wysyłany jest osobno, linkiem z panelu.</p>`;
  const qr = d.link3d
    ? `<section class="qr">
  ${qrSvg(d.link3d)}
  <div>
    <p class="eyebrow">${esc(d.slowa.nazwa)} w 3D</p>
    <p><b>Zeskanuj kod telefonem</b> – otworzysz ${esc(d.slowa.biernik)} w 3D, obrócisz ${d.slowa.zaimek}${opisGrup(d.grupy) ? ` i zmienisz ${esc(opisGrup(d.grupy))}` : ""}.</p>
    <p class="muted">${esc(d.link3d.replace(/^https?:\/\//, ""))}${d.link3dWazny ? ` · ważny do ${esc(d.link3dWazny)}` : ""}${d.link3dPin ? " · PIN otrzymasz osobno" : ""}</p>
  </div>
</section>`
    : "";
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
  .qr { display: flex; gap: 14px; align-items: center; margin: 0 0 12px; padding: 10px 12px; border: 1px solid #e7e5e4; border-radius: 8px; break-inside: avoid; }
  .qr svg { width: 30mm; height: 30mm; flex: none; }
  .qr p { margin: 2px 0; }
  .qr .muted { word-break: break-all; font-size: 11.5px; }
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
  ${materialyHtml(d)}
</section>
${qr}
${zdjecie}
<table>
  <thead><tr><th>Pozycja</th><th class="num">Wymiary (szer. × wys. × gł.)</th><th class="num">Netto</th></tr></thead>
  <tbody>
    ${wiersze || `<tr><td colspan="3">Brak pozycji.</td></tr>`}
    <tr><td>${d.slowa.nazwa === "Kuchnia" ? "Zabudowa — szafki" : "Meble na wymiar"}${d.plytaNazwa ? ` <span class="muted">(${esc(d.plytaNazwa)})</span>` : ""}</td><td></td><td class="num">${esc(pln(d.sumaPozycji))}</td></tr>
    ${d.dodatki.map((x) => `<tr><td>${esc(x.nazwa)}${x.opis ? ` <span class="muted">(${esc(x.opis)})</span>` : ""}</td><td></td><td class="num">${esc(pln(x.kwota))}</td></tr>`).join("")}
    ${wierszDop(`Fronty: ${d.frontNazwa}`, d.dopFront)}
    ${wierszDop(`Blat: ${d.blatNazwa}`, d.dopBlat)}
    ${wierszDop(`Okucia: ${d.okuciaNazwa}`, d.dopOkucia)}
    <tr class="sum"><td>Razem netto</td><td></td><td class="num">${esc(pln(d.razem))}</td></tr>
  </tbody>
</table>
<p class="note">Kwoty netto, bez podatku VAT. Cena mebli wynika z cennika modułów firmy (baza, płyta, front, metr bieżący) i wymiarów.${d.agd ? ` ${NOTA_AGD}` : ""}${opisGrup(d.grupy) ? ` Dopłaty za ${esc(opisGrup(d.grupy))} są takie jak na stronie podglądu 3D.` : ""}</p>
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
    ...(materialyTekst(d, ". ") ? [`${materialyTekst(d, ". ")}.`] : []),
    "",
    "Pozycje (netto):",
    ...(linie.length ? linie : ["(brak pozycji)"]),
    "",
    `${d.slowa.nazwa === "Kuchnia" ? "Zabudowa — szafki" : "Meble na wymiar"}${d.plytaNazwa ? ` (${d.plytaNazwa})` : ""}: ${plnSp(d.sumaPozycji)}`,
    ...d.dodatki.map((x) => `${x.nazwa}${x.opis ? ` (${x.opis.replaceAll("\u00a0", " ")})` : ""}: ${plnSp(x.kwota)}`),
    ...(d.dopFront ? [`Fronty: ${plnSp(d.dopFront)}`] : []),
    ...(d.dopBlat ? [`Blat: ${plnSp(d.dopBlat)}`] : []),
    ...(d.dopOkucia ? [`Okucia: ${plnSp(d.dopOkucia)}`] : []),
    `Razem netto: ${plnSp(d.razem)}`,
    "",
    "Plik PDF (układ do druku) zapiszesz przyciskiem „Pobierz PDF” w panelu: w oknie drukowania wybierz „Zapisz jako PDF” i dołącz go do tej wiadomości.",
    ...(d.link3d
      ? [`${d.slowa.biernik.charAt(0).toUpperCase()}${d.slowa.biernik.slice(1)} w 3D otworzysz z kodu QR w pliku PDF albo tutaj: ${d.link3d}${d.link3dWazny ? ` (link ważny do ${d.link3dWazny})` : ""}.`]
      : ["Podgląd interaktywny 3D wysyłamy osobno."]),
    "",
    d.agd ? "Kwoty netto, bez urządzeń AGD. To oferta handlowa, bez rozkroju płyt." : "Kwoty netto. To oferta handlowa, bez rozkroju płyt.",
    "Pozdrawiamy",
    d.firma,
  ].join("\n");
}

/**
 * Kod QR jako SVG (wektor – ostry na wydruku). Poziom korekcji M, margines 4 moduły (norma).
 * Generowany w przeglądarce, bez zewnętrznej usługi: link klienta nie wychodzi poza system.
 */
export function qrSvg(text: string) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const m = 4;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  const size = n + 2 * m;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Kod QR do podglądu 3D"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** Okno PDF otwierane od razu po kliknięciu (inaczej przeglądarka je zablokuje); treść dochodzi po utworzeniu linku. */
export function oknoPdf() {
  return window.open("", "_blank");
}

export function wpiszPdf(w: Window, html: string) {
  if (w.closed) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function otworzPdf(html: string) {
  const w = oknoPdf();
  return w ? wpiszPdf(w, html) : false;
}
