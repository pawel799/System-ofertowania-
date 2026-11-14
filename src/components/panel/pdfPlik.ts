"use client";

/*
 * Plik PDF z dokumentu HTML (oferta, rysunek techniczny, formatki) – zwykłe pobieranie, bez okna drukowania.
 *
 * Dokument trafia do ukrytej ramki o szerokości strony A4 (bez marginesów). Podział na strony jak w druku:
 * „break-before: page” zaczyna nową stronę, a wiersz tabeli, zdjęcie, karta mebla czy rysunek nie są cięte w połowie
 * (strona kończy się przed nimi). Każdą stronę maluje przeglądarka (html-to-image: SVG foreignObject – ten sam wygląd
 * co na ekranie), a jsPDF składa obrazy w plik A4. Biblioteki ładują się dopiero przy pierwszym pobraniu.
 */

/** Piksele CSS na milimetr (96 dpi). */
const PX_MM = 96 / 25.4;

/** Elementy, których nie tniemy między stronami (gdy mieszczą się na jednej). */
const CALE = "tr, thead, figure, img, svg, header, h1, h2, h3, p, li, .karta, .qr, .arkusz, .rt-rys, .rt-tabelka";

export type OpcjePdf = {
  /** Nazwa pliku (z .pdf albo bez). */
  nazwa: string;
  /** Strona pionowa (domyślnie) albo pozioma – rysunek techniczny. */
  orientacja?: "pionowa" | "pozioma";
  /** Margines strony [mm]. */
  margines?: number;
};

const bezSkryptow = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, "");

/** Nazwa pliku bez polskich znaków i znaków, których nie lubią systemy plików. */
export const nazwaPliku = (s: string) => {
  const ascii = s
    .replace(/\.pdf$/i, "")
    .replace(/[łŁ]/g, (c) => (c === "ł" ? "l" : "L"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
  return `${ascii || "dokument"}.pdf`;
};

async function zaladowany(doc: Document) {
  await Promise.all(
    Array.from(doc.images).map((img) =>
      img.complete
        ? img.decode().catch(() => undefined)
        : new Promise<void>((r) => {
            img.addEventListener("load", () => r(), { once: true });
            img.addEventListener("error", () => r(), { once: true });
          }),
    ),
  );
  await doc.fonts?.ready.catch(() => undefined);
  // Jedna klatka na układ po wczytaniu obrazów.
  await new Promise((r) => requestAnimationFrame(() => r(undefined)));
}

/** Kolory i kreski SVG nadane klasami (arkusze rozkroju, rysunki) – wpisane w element, bo render nie bierze arkusza stylów. */
const STYLE_SVG = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-weight"];
function wpiszStyleSvg(doc: Document) {
  const win = doc.defaultView!;
  for (const el of Array.from(doc.querySelectorAll<SVGElement>("svg *"))) {
    const cs = win.getComputedStyle(el);
    for (const p of STYLE_SVG) el.style.setProperty(p, cs.getPropertyValue(p));
  }
}

/** Granice stron [px od góry dokumentu]: wymuszone podziały, potem jak najwięcej treści bez cięcia elementów. */
function podzial(doc: Document, wysStrony: number): [number, number][] {
  const body = doc.body;
  const win = doc.defaultView!;
  const gora = body.getBoundingClientRect().top;
  const poz = (el: Element) => {
    const b = el.getBoundingClientRect();
    return { t: b.top - gora, b: b.bottom - gora };
  };
  const koniecTresci = Math.ceil(Math.max(body.scrollHeight, ...Array.from(body.children).map((el) => poz(el).b)));
  const cale = Array.from(body.querySelectorAll(CALE))
    .map(poz)
    .filter((a) => a.b - a.t > 0.5 && a.b - a.t <= wysStrony);
  const wymuszone = Array.from(body.querySelectorAll("*"))
    .filter((el) => {
      const cs = win.getComputedStyle(el);
      return cs.breakBefore === "page" || cs.pageBreakBefore === "always";
    })
    .map((el) => poz(el).t)
    .filter((t) => t > 1)
    .sort((a, b) => a - b);
  const wolne = (y: number) => !cale.some((a) => a.t < y - 0.5 && a.b > y + 0.5);

  const strony: [number, number][] = [];
  let y = 0;
  while (y < koniecTresci - 1 && strony.length < 200) {
    let koniec = Math.min(y + wysStrony, koniecTresci);
    const f = wymuszone.find((t) => t > y + 1 && t < koniec);
    if (f !== undefined) koniec = f;
    else if (koniec < koniecTresci) {
      // Najniższe miejsce na stronie, które nie przecina żadnego elementu (ale nie wcześniej niż w 1/3 strony).
      const kand = cale
        .flatMap((a) => [a.t, a.b])
        .filter((c) => c > y + wysStrony / 3 && c <= koniec)
        .sort((a, b) => b - a);
      const ok = kand.find(wolne);
      if (ok !== undefined) koniec = ok;
    }
    strony.push([y, koniec]);
    y = koniec;
  }
  return strony;
}

/** Zamienia dokument HTML w plik PDF i pobiera go (bez okna drukowania). */
export async function pobierzPdf(html: string, o: OpcjePdf): Promise<void> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const pozioma = o.orientacja === "pozioma";
  const W = pozioma ? 297 : 210;
  const H = pozioma ? 210 : 297;
  const m = o.margines ?? 12;
  const szerPx = Math.round((W - 2 * m) * PX_MM);
  const wysPx = Math.floor((H - 2 * m) * PX_MM);

  const ramka = document.createElement("iframe");
  ramka.setAttribute("aria-hidden", "true");
  ramka.tabIndex = -1;
  ramka.style.cssText = `position:fixed;left:-${szerPx + 200}px;top:0;width:${szerPx}px;height:${wysPx}px;border:0;opacity:0;pointer-events:none`;
  document.body.appendChild(ramka);
  try {
    const doc = ramka.contentDocument;
    if (!doc) throw new Error("Przeglądarka nie pozwoliła przygotować pliku.");
    doc.open();
    doc.write(bezSkryptow(html));
    doc.close();
    // Marginesy daje strona PDF; przyciski „Drukuj” z okna wydruku znikają.
    const st = doc.createElement("style");
    st.textContent = `html,body{margin:0!important;padding:0!important;background:#fff!important;width:${szerPx}px}.btns{display:none!important}`;
    doc.head.appendChild(st);
    await zaladowany(doc);
    wpiszStyleSvg(doc);

    const strony = podzial(doc, wysPx);
    const pdf = new jsPDF({ orientation: pozioma ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
    for (let i = 0; i < strony.length; i++) {
      const [od, doY] = strony[i];
      const h = Math.max(1, Math.ceil(doY - od));
      const canvas = await toCanvas(doc.body, {
        width: szerPx,
        height: h,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
        style: { transform: `translateY(${-od}px)`, transformOrigin: "0 0", margin: "0" },
      });
      if (i) pdf.addPage();
      pdf.addImage(canvas, "JPEG", m, m, W - 2 * m, h / PX_MM, undefined, "FAST");
    }
    pdf.save(nazwaPliku(o.nazwa));
  } finally {
    ramka.remove();
  }
}
