import { FIRMA } from "@/content/firma";
import { COUNTERTOPS, FRONTS, HARDWARE } from "@/components/catalog";
import { formatPln, totalPrice } from "@/components/pricing";
import { CENA_ZAKRES, CENA_ZAKRES_MEBLE } from "@/lib/plans";
import { opisGrup, WSZYSTKIE_GRUPY, type GrupyMaterialow } from "@/lib/opcjeProjektu";
import { slowaProjektu, type TypProjektu } from "@/lib/projekt";
import { findMaterial, type KontekstMaterialow } from "@/components/katalogFirmy";
import type { Palette } from "@/components/palettes";

/*
 * Mail z ofertą (HTML zgodny z klientami pocztowymi: Gmail, Outlook, Apple Mail).
 * Zasady: tabele zamiast flex/grid, style inline, bez JS i bez SVG, szerokość 600 px,
 * przycisk działający też w Outlooku (VML). Kolory materiałów to komórki tabeli,
 * więc mail nie potrzebuje obrazków poza logo.
 *
 * Używa go podgląd /podglad-maila; wysyłka (gdy powstanie) użyje tego samego HTML.
 */

export type OfferEmailData = {
  /** Adres strony, np. https://kitchen-offer.pages.dev – do linków i logo. */
  origin: string;
  code: string;
  title: string;
  /** "Panie Janie" / "Pani Anno" / pełne imię – trafia do powitania. */
  greeting: string;
  layout: string;
  front: string;
  countertop: string;
  hardware: string;
  base: number;
  /** Ścieżka oferty, np. "/oferta/k7rp2xmq4h9a" albo "/oferta/demo". */
  offerPath: string;
  /** "15 października" – kiedy link wygasa (opcjonalnie). */
  validUntil?: string;
  pin?: string | null;
  showPrice?: boolean;
  /** Pakiety RAL, katalog firmy i snapshot oferty (bez nich – zestaw wbudowany). */
  materialy?: KontekstMaterialow;
  /** Co projektujemy (teksty) i które materiały oferta ma (opcjeProjektu.ts). Brak = kuchnia, wszystkie. */
  projekt?: TypProjektu;
  grupy?: GrupyMaterialow;
  /** W projekcie są urządzenia AGD (dopisek przy cenie). Brak = tak. */
  agd?: boolean;
  studio: { name: string; phone?: string; email?: string; /** Logo firmy (adres albo data URL); brak = sama nazwa. */ logo?: string | null };
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COUNTERTOP_COLOR: Record<string, string> = {
  "kwarcyt-calacatta": "#ECE8E1",
  "granit-absolute-black": "#1F1F21",
  "laminat-dab": "#B48A5E",
};
const HANDLE_COLOR: Record<string, string> = {
  mosiadz: "#B89552",
  "czarny-mat": "#1B1B1B",
  "push-to-open": "#D6D3D1",
};

export function renderOfferEmail(d: OfferEmailData) {
  // Nazwy i dopłaty: snapshot oferty → katalog firmy / RAL → zestaw wbudowany.
  const m = d.materialy ?? {};
  const front = findMaterial("front", d.front, m) ?? { ...FRONTS[0], zrodlo: "wbudowany" as const };
  const countertop = findMaterial("countertop", d.countertop, m) ?? { ...COUNTERTOPS[0], zrodlo: "wbudowany" as const };
  const hardware = findMaterial("hardware", d.hardware, m) ?? { ...HARDWARE[0], zrodlo: "wbudowany" as const };
  const grupy = d.grupy ?? WSZYSTKIE_GRUPY;
  const slowa = slowaProjektu(d.projekt);
  const zmien = opisGrup(grupy);
  const price = totalPrice({ front: d.front, countertop: d.countertop, hardware: d.hardware }, d.base, (m.palettes ?? []) as Palette[], {
    katalog: m.katalog,
    snapshot: m.snapshot,
    grupy,
  });
  const url = `${d.origin}${d.offerPath}`;
  const showPrice = d.showPrice ?? true;

  const swatch = (color: string) =>
    `<td width="28" style="width:28px;padding:0 12px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="20" height="20" bgcolor="${color}" style="width:20px;height:20px;border-radius:10px;background:${color};border:1px solid #d6d3d1;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>`;

  const row = (label: string, value: string, color?: string) => `
            <tr>
              <td style="padding:10px 0;border-top:1px solid #e7e5e4;font:13px/1.4 Helvetica,Arial,sans-serif;color:#78716c;width:110px;">${label}</td>
              <td style="padding:10px 0;border-top:1px solid #e7e5e4;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${color ? swatch(color) : ""}<td style="font:15px/1.4 Helvetica,Arial,sans-serif;color:#1c1917;">${esc(value)}</td></tr></table>
              </td>
            </tr>`;

  const preheader = `${slowa.twoj} w 3D: obróć ${slowa.zaimek}${zmien ? `, zmień ${zmien}` : ""}${showPrice ? ", cena przeliczy się sama" : ""}.`;

  return `<!doctype html>
<html lang="pl" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Oferta ${esc(d.code)}</title>
<!--[if mso]><style>table,td{font-family:Arial,sans-serif !important;}</style><![endif]-->
<style>
  @media (max-width:620px){ .card{padding:28px 20px !important;} .price{font-size:30px !important;} }
  a{color:#1c1917;}
</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f4" style="background:#f5f5f4;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
        <tr>
          <td style="padding:0 4px 20px;">
            ${
              d.studio.logo
                ? `<img src="${esc(d.studio.logo)}" height="36" alt="${esc(d.studio.name)}" style="display:block;border:0;height:36px;width:auto;max-width:200px;">`
                : `<p style="margin:0;font:600 15px/1.4 Helvetica,Arial,sans-serif;color:#1c1917;">${esc(d.studio.name)}</p>`
            }
          </td>
        </tr>
        <tr>
          <td class="card" bgcolor="#ffffff" style="background:#ffffff;border-radius:16px;padding:40px 40px 36px;border:1px solid #e7e5e4;">
            <p style="margin:0;font:12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#78716c;">Oferta ${esc(d.code)}</p>
            <h1 style="margin:10px 0 0;font:600 26px/1.2 Helvetica,Arial,sans-serif;color:#1c1917;">${esc(d.title)}</h1>
            <p style="margin:18px 0 0;font:16px/1.6 Helvetica,Arial,sans-serif;color:#44403c;">Dzień dobry, ${esc(d.greeting)}!<br>Przygotowaliśmy projekt ${esc(slowa.czego)}. Możesz ${slowa.zaimek} obejrzeć w&nbsp;3D, obrócić${zmien ? `, zmienić ${esc(zmien)}` : ""}${showPrice ? ", a&nbsp;cena przeliczy się od razu" : ""}.</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
              ${row("Układ", d.layout)}
              ${grupy.front ? row("Fronty", front.name, front.color ?? "#d6d3d1") : ""}
              ${grupy.blat ? row("Blat", countertop.name, COUNTERTOP_COLOR[countertop.id] ?? countertop.color ?? "#e7e5e4") : ""}
              ${grupy.okucia ? row("Uchwyty", hardware.name, HANDLE_COLOR[hardware.id] ?? hardware.color ?? "#e7e5e4") : ""}
              <tr><td colspan="2" style="border-top:1px solid #e7e5e4;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            ${
              showPrice
                ? `<p style="margin:20px 0 0;font:12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#78716c;">Szacunek netto</p>
            <p class="price" style="margin:4px 0 0;font:600 34px/1.1 Helvetica,Arial,sans-serif;color:#1c1917;">${formatPln(price)}</p>
            <p style="margin:6px 0 0;font:13px/1.5 Helvetica,Arial,sans-serif;color:#78716c;">${d.agd === false ? CENA_ZAKRES_MEBLE : CENA_ZAKRES}</p>`
                : ""
            }

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0;">
              <tr>
                <td align="center" bgcolor="#1c1917" style="border-radius:999px;background:#1c1917;">
                  <!--[if mso]>
                  <v:roundrect href="${url}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="50%" stroke="f" fillcolor="#1c1917">
                    <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;">Zobacz ${slowa.biernik} w 3D</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${url}" style="display:inline-block;padding:15px 30px;font:600 16px/20px Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;">Zobacz ${slowa.biernik} w 3D &rarr;</a>
                  <!--<![endif]-->
                </td>
              </tr>
            </table>

            ${
              d.pin
                ? `<p style="margin:18px 0 0;font:14px/1.5 Helvetica,Arial,sans-serif;color:#44403c;">PIN do oferty: <strong style="font-family:Courier New,monospace;letter-spacing:3px;color:#1c1917;">${esc(d.pin)}</strong></p>`
                : ""
            }

            <p style="margin:22px 0 0;font:13px/1.6 Helvetica,Arial,sans-serif;color:#78716c;">Przycisk nie działa? Skopiuj adres:<br><a href="${url}" style="color:#44403c;word-break:break-all;">${esc(url)}</a>${d.validUntil ? `<br>Link jest ważny do ${esc(d.validUntil)}.` : ""}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 8px 0;font:13px/1.6 Helvetica,Arial,sans-serif;color:#78716c;">
            Chcesz porozmawiać o projekcie? <a href="${d.origin}${d.offerPath}#pomiar" style="color:#1c1917;">Umów pomiar</a> albo odpisz na tego maila.<br>
            ${[esc(d.studio.name), d.studio.phone ? esc(d.studio.phone) : "", d.studio.email ? `<a href="mailto:${esc(d.studio.email)}" style="color:#78716c;">${esc(d.studio.email)}</a>` : ""].filter(Boolean).join(" · ")}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Data za `days` dni po polsku, np. "1 listopada". */
export function plDate(days: number, from = new Date()) {
  const d = new Date(from.getTime() + days * 86_400_000);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
}

/** Oferta demo: KUCH-2026/12, Kowalski, 24 900 zł netto; link ważny 14 dni od dziś. */
export function demoOfferEmail(origin: string, brand?: { name: string; logo: string | null }) {
  return renderOfferEmail({
    origin,
    code: "KUCH-2026/12",
    title: "Linia dębowa, układ L",
    greeting: "Panie Janie",
    layout: "Narożna (L)",
    front: "dab-naturalny",
    countertop: "kwarcyt-calacatta",
    hardware: "mosiadz",
    base: 24_900,
    offerPath: "/oferta/demo",
    validUntil: plDate(14),
    studio: { name: brand?.name || FIRMA.nazwaHandlowa, logo: brand?.logo ?? null, phone: FIRMA.telefon, email: FIRMA.email },
  });
}
