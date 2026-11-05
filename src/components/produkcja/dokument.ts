/*
 * Wydruk produkcyjny (formatki, rozkrój, okucia, blaty) i plik CSV dla hurtowni / piły.
 * SVG arkusza jest wspólny dla okna w panelu i wydruku.
 */
import { blatyNaPlyty, okleinaMb, podsumowanie, type Blat, type Formatka, type MaterialFormatki, type Okucie } from "./formatki";
import type { UstawieniaRozkroju, WynikRozkroju } from "./rozkroj";

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

/** Arkusz jako SVG: formatki z numerami (i wymiarami, gdy się mieszczą). */
export function svgArkusza(a: WynikRozkroju["arkusze"][number], u: UstawieniaRozkroju) {
  const L = u.arkusz.dl;
  const S = u.arkusz.szer;
  const out: string[] = [];
  out.push(`<svg class="ark" viewBox="-2 -2 ${L + 4} ${S + 4}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Arkusz ${L}×${S} mm, ${a.kawalki.length} formatek">`);
  out.push(`<rect class="ark-tlo" x="0" y="0" width="${L}" height="${S}" />`);
  for (const k of a.kawalki) {
    const fs = Math.max(26, Math.min(70, Math.min(k.w, k.h) * 0.32));
    out.push(`<rect class="ark-f" x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" />`);
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    const wym = `${k.obrocona ? k.h : k.w}×${k.obrocona ? k.w : k.h}`;
    const zWymiarem = k.w > fs * 4.2 && k.h > fs * 2.6;
    out.push(`<text class="ark-nr" x="${cx}" y="${zWymiarem ? cy - fs * 0.15 : cy}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${k.nr}</text>`);
    if (zWymiarem) out.push(`<text class="ark-wym" x="${cx}" y="${cy + fs * 0.85}" font-size="${fs * 0.55}" text-anchor="middle" dominant-baseline="central">${wym}${k.obrocona ? " ↻" : ""}</text>`);
  }
  out.push("</svg>");
  return out.join("");
}

/** CSV (średnik, UTF-8 z BOM – Excel otwiera polskie znaki): jeden wiersz na formatkę. */
export function csvFormatek(d: Pick<DaneProdukcji, "formatki" | "materialy">) {
  const nr = numeruj(d);
  const mat = new Map(d.materialy.map((m) => [m.klucz, m]));
  const pole = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const wiersze = [["Nr", "Materiał", "Grubość [mm]", "Długość [mm]", "Szerokość [mm]", "Ilość", "Słoje", "Okleina D1", "Okleina D2", "Okleina S1", "Okleina S2", "Mebel", "Element", "Uwagi"]];
  const posort = [...d.formatki].sort((a, b) => (nr.get(a.id) ?? 0) - (nr.get(b.id) ?? 0));
  for (const f of posort) {
    const m = mat.get(f.material);
    wiersze.push([
      String(nr.get(f.id) ?? ""),
      m?.nazwa ?? f.material,
      String(m?.grubosc ?? ""),
      String(f.dl),
      String(f.szer),
      String(f.ilosc),
      m?.sloje ? "wzdłuż długości" : "dowolnie",
      f.okleina.d1 ? "1" : "",
      f.okleina.d2 ? "1" : "",
      f.okleina.s1 ? "1" : "",
      f.okleina.s2 ? "1" : "",
      f.mebel,
      f.element,
      f.uwagi ?? "",
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
.arkusze{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.arkusz{break-inside:avoid;border:1px solid #e7e5e4;padding:6px}
.arkusz p{margin:0 0 4px;font-weight:bold}
.ark{width:100%;height:auto;display:block}
.ark-tlo{fill:#f5f5f4;stroke:#1c1917;stroke-width:4}
.ark-f{fill:#fff;stroke:#1c1917;stroke-width:3}
.ark-nr{fill:#1c1917;font-weight:bold;font-family:Arial,sans-serif}
.ark-wym{fill:#57534e;font-family:Arial,sans-serif}
.uw{color:#57534e;font-size:10px}
.btns{position:fixed;top:12px;right:12px;display:flex;gap:6px}
.btns button{font:inherit;padding:6px 12px;border-radius:6px;border:1px solid #1c1917;background:#fff;cursor:pointer}
@media print{.btns{display:none}body{padding:0}@page{size:A4;margin:12mm}}
`;

export function produkcjaDokument(d: DaneProdukcji, wyniki: Map<string, WynikRozkroju>, u: UstawieniaRozkroju, meta: MetaProdukcji, drukuj = false) {
  const nr = numeruj(d);
  const pods = podsumowanie(d);
  const h: string[] = [];
  h.push(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Formatki i rozkrój · ${esc(meta.tytul)}</title><style>${CSS}</style></head><body>`);
  h.push(`<div class="btns"><button onclick="print()">Drukuj / zapisz PDF</button></div>`);
  h.push(`<h1>Formatki i rozkrój</h1><div class="meta">${esc(meta.firma)} · ${esc(meta.kod)} · ${esc(meta.tytul)} · ${esc(meta.data)}</div>`);
  h.push(`<h2>Zestawienie płyt</h2><table><thead><tr><th>Materiał</th><th class="n">Grubość</th><th class="n">Formatek</th><th class="n">m²</th><th class="n">Arkusze ${u.arkusz.dl}×${u.arkusz.szer}</th><th class="n">Odpad</th><th class="n">Okleina mb</th></tr></thead><tbody>`);
  for (const p of pods) {
    const w = wyniki.get(p.material.klucz);
    h.push(
      `<tr><td>${esc(p.material.nazwa)}${p.material.sloje ? " <span class='uw'>(słoje)</span>" : ""}</td><td class="n">${p.material.grubosc} mm</td><td class="n">${p.sztuk}</td><td class="n">${pl(p.m2, 2)}</td><td class="n">${w ? w.arkusze.length : "–"}</td><td class="n">${w ? `${pl(w.odpad * 100)}%` : "–"}</td><td class="n">${pl(p.okleinaMb)}</td></tr>`,
    );
  }
  h.push(`</tbody></table><p class="uw">Rzaz ${u.rzaz} mm, obrzeże arkusza ${u.obrzeze} mm. Wymiary formatek gotowe (z okleiną). Długość = wzdłuż słojów.</p>`);

  for (const m of d.materialy) {
    const lista = d.formatki.filter((f) => f.material === m.klucz);
    if (!lista.length) continue;
    h.push(`<h2>${esc(nazwaZGruboscia(m))}</h2><table><thead><tr><th class="n">Nr</th><th>Mebel</th><th>Element</th><th class="n">Dł.</th><th class="n">Szer.</th><th class="n">Szt.</th><th>Okleina</th><th>Uwagi</th></tr></thead><tbody>`);
    for (const f of lista)
      h.push(
        `<tr><td class="n">${nr.get(f.id)}</td><td>${esc(f.mebel)}</td><td>${esc(f.element)}</td><td class="n">${f.dl}</td><td class="n">${f.szer}</td><td class="n">${f.ilosc}</td><td>${okleinaTekst(f)}</td><td class="uw">${esc(f.uwagi ?? "")}</td></tr>`,
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

  h.push(`<h2 style="break-before:page">Rozkrój</h2>`);
  for (const m of d.materialy) {
    const w = wyniki.get(m.klucz);
    if (!w || !w.arkusze.length) continue;
    h.push(`<h3>${esc(nazwaZGruboscia(m))} · ${w.arkusze.length} ark. · odpad ${pl(w.odpad * 100)}%</h3>`);
    if (w.zaDuze.length) h.push(`<p class="uw">Za duże na arkusz: ${w.zaDuze.map((z) => `nr ${z.nr} (${z.dl}×${z.szer})`).join(", ")}</p>`);
    h.push(`<div class="arkusze">`);
    w.arkusze.forEach((a, i) => h.push(`<div class="arkusz"><p>Arkusz ${i + 1} · ${a.kawalki.length} formatek</p>${svgArkusza(a, u)}</div>`));
    h.push(`</div>`);
  }
  h.push(`<p class="uw">Okleina razem: ${pl(d.formatki.reduce((s, f) => s + okleinaMb(f), 0))} mb.</p>`);
  if (drukuj) h.push(`<script>setTimeout(()=>print(),400)</script>`);
  h.push(`</body></html>`);
  return h.join("");
}
