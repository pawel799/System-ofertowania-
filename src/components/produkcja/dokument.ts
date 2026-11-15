/*
 * Wydruk produkcyjny (formatki, rozkrój, okucia, blaty) i plik CSV dla hurtowni / piły.
 * SVG arkusza jest wspólny dla okna w panelu i wydruku.
 */
import qrcode from "qrcode-generator";
import { blatyNaPlyty, okleinaMb, podsumowanie, type Blat, type Formatka, type MaterialFormatki, type Okucie } from "./formatki";
import { odpadLaczny, type UstawieniaRozkroju, type WynikRozkroju } from "./rozkroj";

/** Ustawienia do opisu w dokumencie: rozkrój + grubość okleiny odejmowana od wymiaru gotowego (0 = bez). */
export type UstawieniaDokumentu = UstawieniaRozkroju & { okleinaOdejmij?: number };

export type DaneProdukcji = {
  formatki: Formatka[];
  materialy: MaterialFormatki[];
  blaty?: Blat[];
  blatNazwa?: string;
  okucia?: Okucie[];
  pominiete?: { mebel: string; powod: string }[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Nazwa z grubością, chyba że nazwa już ją ma („Biały 18 mm”). */
export const nazwaZGruboscia = (m: Pick<MaterialFormatki, "nazwa" | "grubosc">) => (/\d\s*mm\b/i.test(m.nazwa) ? m.nazwa : `${m.nazwa} · ${m.grubosc} mm`);

const pl = (n: number, d = 1) => n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Wymiar w mm: całe bez przecinka, części milimetra z przecinkiem (563,5). */
export const mmTxt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pl-PL", { maximumFractionDigits: 1 }));
/** Wymiar gotowy (z okleiną), gdy różni się od wymiaru do cięcia. */
export const gotowaTxt = (f: Pick<Formatka, "gotowe">) => (f.gotowe ? `gotowa ${mmTxt(f.gotowe.dl)}×${mmTxt(f.gotowe.szer)}` : "");
const uwagiTxt = (f: Pick<Formatka, "gotowe" | "uwagi">) => [gotowaTxt(f), f.uwagi ?? ""].filter(Boolean).join(" · ");

/** Jedno zdanie o wymiarach: czy tniemy wymiar z listy, czy gotowy minus okleina. */
export const wymiaryOpis = (okleinaOdejmij = 0) =>
  okleinaOdejmij > 0
    ? `Wymiary do cięcia: gotowe minus okleina ${mmTxt(okleinaOdejmij)} mm na każdej oklejanej krawędzi`
    : "Wymiary tniemy tak, jak w liście (bez odejmowania okleiny)";

/** Zdanie pod zestawieniem: dlaczego odpad jest liczony per materiał. */
export const legendaOdpadu = (laczny: number) =>
  `Odpad liczony osobno dla każdego materiału – różnych dekorów i grubości nie układa się na jednym arkuszu, więc przy kilku formatkach z jednej płyty wysoki odpad to koszt osobnego arkusza, nie błąd rozkroju. Odpad łączny (ważony powierzchnią arkuszy): ${pl(laczny * 100)}%.`;

/** Numery formatek (1…N) w kolejności materiałów – te same w tabeli, na arkuszach i w CSV. */
export function numeruj(d: Pick<DaneProdukcji, "formatki" | "materialy">) {
  const nr = new Map<string, number>();
  let i = 0;
  for (const m of d.materialy) for (const f of d.formatki) if (f.material === m.klucz) nr.set(f.id, ++i);
  return nr;
}

export const okleinaTekst = (f: Pick<Formatka, "okleina">) =>
  (["d1", "d2", "s1", "s2"] as const)
    .filter((k) => f.okleina[k])
    .map((k) => k.toUpperCase())
    .join(" ") || "–";

/**
 * Arkusz jako SVG: formatki z numerami (i wymiarami, gdy się mieszczą), resztki do odłożenia zakreskowane.
 * Napisy duże (czytelne na wydruku A4 przy pile); w wąskiej, wysokiej listwie tekst idzie wzdłuż niej.
 */
export function svgArkusza(a: WynikRozkroju["arkusze"][number], u: UstawieniaRozkroju) {
  // Własne id wzoru w każdym SVG (wzór z ukrytego, zwiniętego arkusza nie maluje się w innych), stałe między renderami.
  const k0 = a.kawalki[0];
  const wzor = `ark-szraf-${(k0 ? `${k0.ref}-${k0.nr}-${a.kawalki.length}-${Math.round(a.pole)}` : "pusty").replace(/[^\w-]/g, "_")}`;
  const L = u.arkusz.dl;
  const S = u.arkusz.szer;
  const out: string[] = [];
  out.push(`<svg class="ark" viewBox="-2 -2 ${L + 4} ${S + 4}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arkusz ${L}×${S} mm, ${a.kawalki.length} formatek">`);
  out.push(`<defs><pattern id="${wzor}" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="40" height="40" class="ark-r" /><line x1="0" y1="0" x2="0" y2="40" class="ark-rl" /></pattern></defs>`);
  out.push(`<rect class="ark-tlo" x="0" y="0" width="${L}" height="${S}" />`);
  for (const r of a.resztki ?? []) {
    out.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#${wzor})" class="ark-rr" />`);
    const t = `resztka ${mmTxt(r.w)}×${mmTxt(r.h)}`;
    // Napis mieści się w resztce (szerokość znaku ok. 0,58 wysokości); inaczej mniejszy albo żaden.
    const fs = Math.min(110, Math.min(r.w, r.h) * 0.22, (r.w - 40) / (t.length * 0.58));
    if (fs >= 30 && r.h > fs * 1.6)
      out.push(`<text class="ark-wym" x="${r.x + r.w / 2}" y="${r.y + r.h / 2}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${t}</text>`);
  }
  for (const k of a.kawalki) {
    out.push(`<rect class="ark-f" x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" />`);
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    // Wąska wysoka listwa: tekst obrócony wzdłuż dłuższego boku.
    const pion = k.h > k.w * 1.4;
    const dlugi = pion ? k.h : k.w;
    const krotki = pion ? k.w : k.h;
    const fs = Math.max(40, Math.min(150, krotki * 0.42));
    const wym = `${mmTxt(k.obrocona ? k.h : k.w)}×${mmTxt(k.obrocona ? k.w : k.h)}${k.obrocona ? " ↻" : ""}`;
    const fsW = fs * 0.6;
    const zWymiarem = dlugi > fsW * 0.62 * wym.length + 20 && krotki > fs * 1.9;
    const obr = pion ? ` transform="rotate(-90 ${cx} ${cy})"` : "";
    out.push(`<g${obr}>`);
    out.push(`<text class="ark-nr" x="${cx}" y="${zWymiarem ? cy - fs * 0.32 : cy}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${k.nr}</text>`);
    if (zWymiarem) out.push(`<text class="ark-wym" x="${cx}" y="${cy + fs * 0.62}" font-size="${fsW}" text-anchor="middle" dominant-baseline="central">${wym}</text>`);
    out.push(`</g>`);
  }
  out.push("</svg>");
  return out.join("");
}

/** CSV (średnik, UTF-8 z BOM – Excel otwiera polskie znaki): jeden wiersz na formatkę. */
export function csvFormatek(d: Pick<DaneProdukcji, "formatki" | "materialy">) {
  // Liczby po polsku (przecinek) – Excel z separatorem średnika czyta je jako liczby.
  const n = (v: number) => mmTxt(v);
  const zGotowymi = d.formatki.some((f) => f.gotowe);
  const nr = numeruj(d);
  const mat = new Map(d.materialy.map((m) => [m.klucz, m]));
  const pole = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const wiersze = [
    [
      "Nr", "Materiał", "Grubość [mm]", "Długość [mm]", "Szerokość [mm]", "Ilość", "Słoje", "Okleina D1", "Okleina D2", "Okleina S1", "Okleina S2", "Mebel", "Element", "Uwagi",
      ...(zGotowymi ? ["Długość gotowa [mm]", "Szerokość gotowa [mm]"] : []),
    ],
  ];
  const posort = [...d.formatki].sort((a, b) => (nr.get(a.id) ?? 0) - (nr.get(b.id) ?? 0));
  for (const f of posort) {
    const m = mat.get(f.material);
    wiersze.push([
      String(nr.get(f.id) ?? ""),
      m?.nazwa ?? f.material,
      String(m?.grubosc ?? ""),
      n(f.dl),
      n(f.szer),
      String(f.ilosc),
      m?.sloje ? "wzdłuż długości" : "dowolnie",
      f.okleina.d1 ? "1" : "",
      f.okleina.d2 ? "1" : "",
      f.okleina.s1 ? "1" : "",
      f.okleina.s2 ? "1" : "",
      f.mebel,
      f.element,
      f.uwagi ?? "",
      ...(zGotowymi ? [n(f.gotowe?.dl ?? f.dl), n(f.gotowe?.szer ?? f.szer)] : []),
    ]);
  }
  return "﻿" + wiersze.map((w) => w.map(pole).join(";")).join("\r\n") + "\r\n";
}

export type MetaProdukcji = { firma: string; tytul: string; kod: string; data: string };

const CSS = `
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#1c1917;margin:0;padding:24px;font-size:11px}
h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:18px 0 6px;break-after:avoid}h3{font-size:12px;margin:12px 0 4px;break-after:avoid}
.meta{color:#57534e;margin-bottom:12px}
table{border-collapse:collapse;width:100%;margin:4px 0 8px}
th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:#57534e;border-bottom:1.5px solid #1c1917;padding:4px 6px 4px 0}
td{border-bottom:1px solid #e7e5e4;padding:3px 6px 3px 0;vertical-align:top}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
tr{break-inside:avoid}
.arkusze{display:grid;grid-template-columns:1fr;gap:10px}
.arkusz{break-inside:avoid;border:1px solid #e7e5e4;padding:6px}
.arkusz p{margin:0 0 4px;font-weight:bold}
.ark{width:100%;height:auto;max-height:118mm;display:block;margin:0 auto}
.ark-tlo{fill:#f5f5f4;stroke:#1c1917;stroke-width:4}
.ark-f{fill:#fff;stroke:#1c1917;stroke-width:3}
.ark-nr{fill:#1c1917;font-weight:bold;font-family:Arial,sans-serif}
.ark-wym{fill:#44403c;font-family:Arial,sans-serif}
.ark-r{fill:#f0fdf4}.ark-rl{stroke:#86efac;stroke-width:6}.ark-rr{stroke:#16a34a;stroke-width:4;stroke-dasharray:24 16}
tr.razem td{font-weight:bold;border-top:1.5px solid #1c1917}
.uw{color:#57534e;font-size:10px}
.btns{position:fixed;top:12px;right:12px;display:flex;gap:6px}
.btns button{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid #1c1917;background:#fff;cursor:pointer}
@media print{.btns{display:none}body{padding:0}@page{size:A4;margin:12mm}}
`;

export function produkcjaDokument(d: DaneProdukcji, wyniki: Map<string, WynikRozkroju>, u: UstawieniaDokumentu, meta: MetaProdukcji, drukuj = false) {
  const nr = numeruj(d);
  const pods = podsumowanie(d);
  const h: string[] = [];
  h.push(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Formatki i rozkrój · ${esc(meta.tytul)}</title><style>${CSS}</style></head><body>`);
  h.push(`<h1>Formatki i rozkrój</h1><div class="meta">${esc(meta.firma)} · ${esc(meta.kod)} · ${esc(meta.tytul)} · ${esc(meta.data)}</div>`);
  h.push(`<h2>Zestawienie płyt</h2><table><thead><tr><th>Materiał</th><th class="n">Grubość</th><th class="n">Formatek</th><th class="n">m²</th><th class="n">Arkusze ${u.arkusz.dl}×${u.arkusz.szer}</th><th class="n">Odpad</th><th class="n">Okleina mb</th></tr></thead><tbody>`);
  for (const p of pods) {
    const w = wyniki.get(p.material.klucz);
    h.push(
      `<tr><td>${esc(p.material.nazwa)}${p.material.sloje ? " <span class='uw'>(słoje)</span>" : ""}</td><td class="n">${p.material.grubosc} mm</td><td class="n">${p.sztuk}</td><td class="n">${pl(p.m2, 2)}</td><td class="n">${w ? w.arkusze.length : "–"}</td><td class="n">${w ? `${pl(w.odpad * 100)}%` : "–"}</td><td class="n">${pl(p.okleinaMb)}</td></tr>`,
    );
  }
  const wszystkie = Array.from(wyniki.values());
  if (pods.length > 1) {
    h.push(
      `<tr class="razem"><td>Razem</td><td></td><td class="n">${pods.reduce((s, p) => s + p.sztuk, 0)}</td><td class="n">${pl(pods.reduce((s, p) => s + p.m2, 0), 2)}</td><td class="n">${wszystkie.reduce((s, w) => s + w.arkusze.length, 0)}</td><td class="n">${pl(odpadLaczny(wszystkie) * 100)}%</td><td class="n">${pl(pods.reduce((s, p) => s + p.okleinaMb, 0))}</td></tr>`,
    );
  }
  h.push(
    `</tbody></table><p class="uw">${legendaOdpadu(odpadLaczny(wszystkie))}</p><p class="uw">Rzaz ${mmTxt(u.rzaz)} mm, formatowanie arkusza ${mmTxt(u.obrzeze)} mm (pas odcinany z surowej krawędzi płyty – to nie okleina). ${wymiaryOpis(u.okleinaOdejmij)}. Długość = wzdłuż słojów.${u.resztka ? ` Resztki o krótszym boku od ${u.resztka} mm zakreskowane – do odłożenia.` : ""}</p>`,
  );

  for (const m of d.materialy) {
    const lista = d.formatki.filter((f) => f.material === m.klucz);
    if (!lista.length) continue;
    h.push(`<h2>${esc(nazwaZGruboscia(m))}</h2><table><thead><tr><th class="n">Nr</th><th>Mebel</th><th>Element</th><th class="n">Dł.</th><th class="n">Szer.</th><th class="n">Szt.</th><th>Okleina</th><th>Uwagi</th></tr></thead><tbody>`);
    for (const f of lista)
      h.push(
        `<tr><td class="n">${nr.get(f.id)}</td><td>${esc(f.mebel)}</td><td>${esc(f.element)}</td><td class="n">${mmTxt(f.dl)}</td><td class="n">${mmTxt(f.szer)}</td><td class="n">${f.ilosc}</td><td>${okleinaTekst(f)}</td><td class="uw">${esc(uwagiTxt(f))}</td></tr>`,
      );
    h.push(`</tbody></table>`);
  }

  if (d.okucia?.length) {
    h.push(`<h2>Okucia</h2><table><thead><tr><th>Pozycja</th><th class="n">Ilość</th></tr></thead><tbody>`);
    for (const o of d.okucia) h.push(`<tr><td>${esc(o.nazwa)}</td><td class="n">${o.ilosc} ${o.jednostka}</td></tr>`);
    h.push(`</tbody></table>`);
  }
  if (d.blaty?.length) {
    const b = blatyNaPlyty(d.blaty);
    h.push(`<h2>Blaty · ${esc(d.blatNazwa ?? "")}</h2><table><thead><tr><th>Gdzie</th><th class="n">Dł.</th><th class="n">Gł.</th><th>Uwagi</th></tr></thead><tbody>`);
    for (const x of d.blaty) h.push(`<tr><td>${esc(x.mebel)}</td><td class="n">${x.dl}</td><td class="n">${x.szer}</td><td class="uw">${esc(x.uwagi ?? "")}</td></tr>`);
    h.push(`</tbody></table><p class="uw">Płyt blatowych 4100 mm: ${b.plyty}${b.lacz.length ? ` · ${b.lacz.length} blat(y) dłuższe niż płyta – łączenie` : ""}.</p>`);
  }
  if (d.pominiete?.length) {
    h.push(`<h3>Bez formatek</h3><ul class="uw">${d.pominiete.map((p) => `<li>${esc(p.mebel)} – ${esc(p.powod)}</li>`).join("")}</ul>`);
  }

  // Bez wymuszonej nowej strony: krótkie zestawienie nie zostawia pustej połowy – pierwszy arkusz wchodzi pod nie.
  h.push(`<h2>Rozkrój</h2>`);
  for (const m of d.materialy) {
    const w = wyniki.get(m.klucz);
    if (!w || !w.arkusze.length) continue;
    const naglowek = `${esc(nazwaZGruboscia(m))} · ${w.arkusze.length} ark. · odpad ${pl(w.odpad * 100)}%`;
    h.push(`<div class="arkusze">`);
    // Nazwa materiału w ramce arkusza – nagłówek nie zostaje sam na dole strony, gdy rysunek przechodzi na następną.
    w.arkusze.forEach((a, i) => h.push(`<div class="arkusz"><p>${naglowek} · arkusz ${i + 1}/${w.arkusze.length} · ${a.kawalki.length} formatek</p>${svgArkusza(a, u)}</div>`));
    h.push(`</div>`);
    if (w.zaDuze.length) h.push(`<p class="uw">Za duże na arkusz: ${w.zaDuze.map((z) => `nr ${z.nr} (${mmTxt(z.dl)}×${mmTxt(z.szer)})`).join(", ")}</p>`);
    const resztki = w.arkusze.flatMap((a, i) => a.resztki.map((r) => `ark. ${i + 1}: ${mmTxt(r.w)}×${mmTxt(r.h)}`));
    if (resztki.length) h.push(`<p class="uw">Resztki do odłożenia: ${resztki.join(", ")}.</p>`);
  }
  h.push(`<p class="uw">Okleina razem: ${pl(d.formatki.reduce((s, f) => s + okleinaMb(f), 0))} mb.</p>`);
  if (drukuj) h.push(`<script>setTimeout(()=>print(),400)</script>`);
  h.push(`</body></html>`);
  return h.join("");
}

/* ---------- Etykiety na formatki ---------- */

/** Tekst bez polskich znaków – do kodu QR (czytniki przy pile nie zawsze czytają UTF-8) i DXF. */
const ascii = (t: string) =>
  t
    .replace(/[łŁ]/g, (c) => (c === "ł" ? "l" : "L"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "");

function qr(text: string) {
  const q = qrcode(0, "M");
  q.addData(ascii(text));
  q.make();
  const n = q.getModuleCount();
  const m = 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  const size = n + 2 * m;
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

const CSS_ETYKIET = `
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;padding:0}
.ety{display:grid;grid-template-columns:repeat(3,70mm);grid-auto-rows:37mm}
.etykieta{width:70mm;height:37mm;padding:2.5mm 3mm;display:flex;gap:2mm;overflow:hidden;border:0.2mm dashed #d6d3d1;break-inside:avoid}
.e-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:0.6mm;font-size:7.5pt;line-height:1.15}
.e-nr{font-size:20pt;font-weight:bold;line-height:1}
.e-nr small{font-size:8pt;font-weight:normal;color:#444;margin-left:1.5mm}
.e-wym{font-size:11pt;font-weight:bold}
.e-mat,.e-el{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.e-okl{font-family:monospace;font-size:8pt}
.qr{width:21mm;height:21mm;flex:none;align-self:center}
`;

/**
 * Etykiety do naklejenia na pocięte formatki: arkusz A4 3 × 8 (70 × 37 mm, typowe naklejki), jedna na sztukę.
 * Numer, wymiar, materiał, mebel i element, okleina, słoje i kod QR z tymi samymi danymi.
 */
export function etykietyDokument(d: Pick<DaneProdukcji, "formatki" | "materialy">, meta: MetaProdukcji) {
  const nr = numeruj(d);
  const mat = new Map(d.materialy.map((m) => [m.klucz, m]));
  const posort = [...d.formatki].sort((a, b) => (nr.get(a.id) ?? 0) - (nr.get(b.id) ?? 0));
  const h: string[] = [`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Etykiety · ${esc(meta.tytul)}</title><style>${CSS_ETYKIET}</style></head><body><div class="ety">`];
  for (const f of posort) {
    const m = mat.get(f.material);
    const n = nr.get(f.id) ?? 0;
    const wym = `${mmTxt(f.dl)} × ${mmTxt(f.szer)}`;
    const okl = okleinaTekst(f);
    const sloje = m?.sloje ? "słoje wzdłuż dł." : "";
    const dane = [meta.kod, `nr ${n}`, `${mmTxt(f.dl)}x${mmTxt(f.szer)} mm`, m ? nazwaZGruboscia(m) : f.material, `${f.mebel} / ${f.element}`, `okleina ${okl}`, sloje].filter(Boolean).join(" | ");
    const kod = qr(dane);
    for (let i = 1; i <= f.ilosc; i++) {
      h.push(
        `<div class="etykieta"><div class="e-txt"><div class="e-nr">${n}${f.ilosc > 1 ? `<small>${i}/${f.ilosc}</small>` : ""}</div><div class="e-wym">${wym}</div><div class="e-mat">${esc(m ? nazwaZGruboscia(m) : f.material)}</div><div class="e-el">${esc(f.mebel)} · ${esc(f.element)}</div><div class="e-okl">${okl === "–" ? "bez okleiny" : `okl. ${okl}`}${sloje ? ` · ${sloje}` : ""}</div></div>${kod}</div>`,
      );
    }
  }
  h.push(`</div></body></html>`);
  return h.join("");
}

/* ---------- DXF ---------- */

/**
 * Rozkrój jako DXF (R12, ASCII – otwiera AutoCAD, LibreCAD, QCAD i oprogramowanie pił/CNC).
 * Jednostki: mm. Materiały jeden pod drugim, arkusze materiału obok siebie (odstęp 200 mm), oś Y w górę.
 * Warstwy: ARKUSZ (obrys płyty), FORMATOWANIE (pole po odcięciu krawędzi), FORMATKI, RESZTKI, OPISY.
 */
export function dxfRozkroju(d: Pick<DaneProdukcji, "formatki" | "materialy">, wyniki: Map<string, WynikRozkroju>, u: UstawieniaRozkroju) {
  const L = u.arkusz.dl;
  const S = u.arkusz.szer;
  const e: string[] = [];
  const num = (v: number) => (Math.round(v * 100) / 100).toString();
  const linia = (warstwa: string, x1: number, y1: number, x2: number, y2: number) =>
    e.push("0", "LINE", "8", warstwa, "10", num(x1), "20", num(y1), "30", "0", "11", num(x2), "21", num(y2), "31", "0");
  const prost = (warstwa: string, x: number, y: number, w: number, h: number) => {
    linia(warstwa, x, y, x + w, y);
    linia(warstwa, x + w, y, x + w, y + h);
    linia(warstwa, x + w, y + h, x, y + h);
    linia(warstwa, x, y + h, x, y);
  };
  const tekst = (x: number, y: number, h: number, t: string, srodek = true, obrot = 0) => {
    e.push("0", "TEXT", "8", "OPISY", "10", num(x), "20", num(y), "30", "0", "40", num(h), "1", ascii(t));
    if (obrot) e.push("50", num(obrot));
    if (srodek) e.push("72", "1", "73", "2", "11", num(x), "21", num(y), "31", "0");
  };
  let y0 = 0;
  for (const m of d.materialy) {
    const w = wyniki.get(m.klucz);
    if (!w || !w.arkusze.length) continue;
    tekst(0, y0 + S + 80, 60, `${nazwaZGruboscia(m)} - ${w.arkusze.length} ark., odpad ${pl(w.odpad * 100)}%`, false);
    w.arkusze.forEach((a, i) => {
      const x0 = i * (L + 200);
      // SVG ma y w dół, DXF w górę: y_dxf = y0 + S − y − h.
      const Y = (y: number, h: number) => y0 + S - y - h;
      prost("ARKUSZ", x0, y0, L, S);
      if (u.obrzeze > 0) prost("FORMATOWANIE", x0 + u.obrzeze, y0 + u.obrzeze, L - 2 * u.obrzeze, S - 2 * u.obrzeze);
      tekst(x0, y0 - 70, 45, `Arkusz ${i + 1} - ${L}x${S} mm`, false);
      for (const r of a.resztki) {
        prost("RESZTKI", x0 + r.x, Y(r.y, r.h), r.w, r.h);
        tekst(x0 + r.x + r.w / 2, Y(r.y, r.h) + r.h / 2, Math.max(25, Math.min(80, Math.min(r.w, r.h) * 0.15)), `resztka ${mmTxt(r.w)}x${mmTxt(r.h)}`);
      }
      for (const k of a.kawalki) {
        const y = Y(k.y, k.h);
        prost("FORMATKI", x0 + k.x, y, k.w, k.h);
        const pion = k.h > k.w * 1.4;
        const fs = Math.max(20, Math.min(90, (pion ? k.w : k.h) * 0.3));
        const wym = `${mmTxt(k.obrocona ? k.h : k.w)}x${mmTxt(k.obrocona ? k.w : k.h)}`;
        tekst(x0 + k.x + k.w / 2, y + k.h / 2, fs, `${k.nr}  ${wym}`, true, pion ? 90 : 0);
      }
    });
    y0 -= S + 400;
  }
  return ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES", ...e, "0", "ENDSEC", "0", "EOF"].join("\r\n") + "\r\n";
}
