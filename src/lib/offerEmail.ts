import { COUNTERTOPS, FRONTS, HARDWARE } from "@/components/catalog";
import { formatPln, totalPrice } from "@/components/pricing";

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
  studio: { name: string; phone: string; email: string };
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
  const front = FRONTS.find((f) => f.id === d.front) ?? FRONTS[0];
  const countertop = COUNTERTOPS.find((c) => c.id === d.countertop) ?? COUNTERTOPS[0];
  const hardware = HARDWARE.find((h) => h.id === d.hardware) ?? HARDWARE[0];
  const price = totalPrice({ front: d.front, countertop: d.countertop, hardware: d.hardware }, d.base);
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

  const preheader = `Twoja kuchnia w 3D: obróć ją, zmień fronty i blat${showPrice ? ", cena przeliczy się sama" : ""}.`;

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
            <img src="${d.origin}/mail/logo.png" width="36" height="36" alt="${esc(d.studio.name)}" style="display:block;border:0;width:36px;height:36px;">
          </td>
        </tr>
        <tr>
          <td class="card" bgcolor="#ffffff" style="background:#ffffff;border-radius:16px;padding:40px 40px 36px;border:1px solid #e7e5e4;">
            <p style="margin:0;font:12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#78716c;">Oferta ${esc(d.code)}</p>
            <h1 style="margin:10px 0 0;font:600 26px/1.2 Helvetica,Arial,sans-serif;color:#1c1917;">${esc(d.title)}</h1>
            <p style="margin:18px 0 0;font:16px/1.6 Helvetica,Arial,sans-serif;color:#44403c;">Dzień dobry, ${esc(d.greeting)}!<br>Przygotowaliśmy projekt Twojej kuchni. Możesz ją obejrzeć w&nbsp;3D, obrócić, zmienić fronty, blat i&nbsp;uchwyty${showPrice ? ", a&nbsp;cena przeliczy się od razu" : ""}.</p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
              ${row("Układ", d.layout)}
              ${row("Fronty", front.name, front.color)}
              ${row("Blat", countertop.name, COUNTERTOP_COLOR[countertop.id] ?? "#e7e5e4")}
              ${row("Uchwyty", hardware.name, HANDLE_COLOR[hardware.id] ?? "#e7e5e4")}
              <tr><td colspan="2" style="border-top:1px solid #e7e5e4;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            ${
              showPrice
                ? `<p style="margin:20px 0 0;font:12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#78716c;">Szacunek netto</p>
            <p class="price" style="margin:4px 0 0;font:600 34px/1.1 Helvetica,Arial,sans-serif;color:#1c1917;">${formatPln(price)}</p>
            <p style="margin:6px 0 0;font:13px/1.5 Helvetica,Arial,sans-serif;color:#78716c;">Bez AGD. Montaż wyceniamy po pomiarze.</p>`
                : ""
            }

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0;">
              <tr>
                <td align="center" bgcolor="#1c1917" style="border-radius:999px;background:#1c1917;">
                  <!--[if mso]>
                  <v:roundrect href="${url}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="50%" stroke="f" fillcolor="#1c1917">
                    <w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;">Zobacz kuchnię w 3D</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a href="${url}" style="display:inline-block;padding:15px 30px;font:600 16px/20px Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;">Zobacz kuchnię w 3D &rarr;</a>
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
            Chcesz porozmawiać o projekcie? <a href="${d.origin}${d.offerPath}#wycena" style="color:#1c1917;">Umów pomiar</a> albo odpisz na tego maila.<br>
            ${esc(d.studio.name)} · ${esc(d.studio.phone)} · <a href="mailto:${esc(d.studio.email)}" style="color:#78716c;">${esc(d.studio.email)}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Oferta demo z planu: KUCH-2026/12, Kowalski, 24 900 zł netto. */
export function demoOfferEmail(origin: string) {
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
    validUntil: "17 października",
    studio: { name: "Studio Kuchnie", phone: "+48 000 000 000", email: "kontakt@example.com" },
  });
}
