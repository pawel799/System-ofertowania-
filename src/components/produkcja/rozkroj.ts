/*
 * Rozkrój formatek na arkusze płyty – cięcie gilotynowe (każde cięcie przez cały kawałek, jak na pile panelowej).
 *
 * Arkusz: `dl` × `szer` mm (słoje wzdłuż `dl`), formatowanie (pas surowej krawędzi) odcinane z każdej strony,
 * rzaz piły między formatkami. Wymiary mogą mieć części milimetra (0,1 mm).
 * Formatka leży `dl` wzdłuż arkusza; bez słojów może się obrócić o 90°.
 * Heurystyka: najlepsze dopasowanie krótszego boku (BSSF) w wolnych prostokątach wszystkich otwartych arkuszy,
 * kilka kolejności i reguł podziału – wygrywa wynik z najmniejszą liczbą arkuszy, potem z największym kawałkiem resztek.
 */

export type UstawieniaRozkroju = {
  arkusz: { dl: number; szer: number };
  /** Szerokość rzazu piły [mm]. */
  rzaz: number;
  /**
   * Formatowanie: pas odcinany z każdej surowej krawędzi arkusza [mm]. Pole nazywa się `obrzeze` z powodów
   * historycznych (zapisane ustawienia) – to nie jest okleina formatki.
   */
  obrzeze: number;
  /** Najkrótszy bok resztki, którą warto odłożyć [mm]; mniejsze kawałki to odpad. 0 = nie wyróżniaj resztek. */
  resztka?: number;
};

export const ROZKROJ_DOMYSLNY: UstawieniaRozkroju = { arkusz: { dl: 2800, szer: 2070 }, rzaz: 4, obrzeze: 10, resztka: 300 };

export type DoRozkroju = { ref: string; nr: number; dl: number; szer: number; ilosc: number };

/** Położenie formatki na arkuszu: x wzdłuż długości arkusza, y w poprzek; w × h po ewentualnym obrocie. */
export type Polozenie = { ref: string; nr: number; x: number; y: number; w: number; h: number; obrocona: boolean };
/** Wolny prostokąt arkusza (po cięciu gilotynowym), np. resztka do odłożenia. */
export type Prostokat = { x: number; y: number; w: number; h: number };
export type ArkuszRozkroju = { kawalki: Polozenie[]; pole: number; resztki: Prostokat[] };
export type WynikRozkroju = {
  arkusze: ArkuszRozkroju[];
  /** Formatki większe niż arkusz (po obrzeżu). */
  zaDuze: DoRozkroju[];
  /** Udział odpadu we wszystkich użytych arkuszach (0–1). */
  odpad: number;
  /** Pole wszystkich użytych arkuszy i pole formatek [mm²] – do odpadu łącznego kilku materiałów. */
  poleArkuszy: number;
  poleFormatek: number;
};

/** Odpad łączny kilku materiałów, ważony powierzchnią arkuszy (0–1). */
export function odpadLaczny(wyniki: readonly WynikRozkroju[]) {
  let ark = 0;
  let f = 0;
  for (const w of wyniki) {
    ark += w.poleArkuszy;
    f += w.poleFormatek;
  }
  return ark ? 1 - f / ark : 0;
}

type Wolny = { x: number; y: number; w: number; h: number };
type Szt = { ref: string; nr: number; dl: number; szer: number };
type Podzial = "krotsza" | "dluzsza" | "pole";

function ulozenie(sztuki: Szt[], obrot: boolean, u: UstawieniaRozkroju, podzial: Podzial) {
  const L = u.arkusz.dl - 2 * u.obrzeze;
  const S = u.arkusz.szer - 2 * u.obrzeze;
  const k = u.rzaz;
  const arkusze: { wolne: Wolny[]; kawalki: Polozenie[]; pole: number }[] = [];
  const nowy = () => {
    const a = { wolne: [{ x: u.obrzeze, y: u.obrzeze, w: L, h: S }], kawalki: [] as Polozenie[], pole: 0 };
    arkusze.push(a);
    return a;
  };
  for (const s of sztuki) {
    const opcje: [number, number, boolean][] = [[s.dl, s.szer, false]];
    if (obrot && s.dl !== s.szer) opcje.push([s.szer, s.dl, true]);
    let best: { a: number; f: number; o: number; wynik: number; drugi: number } | null = null;
    const szukaj = (ai: number) => {
      arkusze[ai].wolne.forEach((f, fi) => {
        opcje.forEach(([pw, ph], oi) => {
          if (pw > f.w || ph > f.h) return;
          const wynik = Math.min(f.w - pw, f.h - ph);
          const drugi = Math.max(f.w - pw, f.h - ph);
          if (!best || wynik < best.wynik || (wynik === best.wynik && drugi < best.drugi)) best = { a: ai, f: fi, o: oi, wynik, drugi };
        });
      });
    };
    arkusze.forEach((_, ai) => szukaj(ai));
    if (!best) {
      nowy();
      szukaj(arkusze.length - 1);
    }
    if (!best) continue; // nie mieści się w ogóle – wyłapane wcześniej
    const b = best as { a: number; f: number; o: number };
    const a = arkusze[b.a];
    const f = a.wolne[b.f];
    const [pw, ph, obr] = opcje[b.o];
    a.kawalki.push({ ref: s.ref, nr: s.nr, x: f.x, y: f.y, w: pw, h: ph, obrocona: obr });
    a.pole += pw * ph;
    const restW = f.w - pw - k;
    const restH = f.h - ph - k;
    // Podział gilotynowy pozostałego miejsca na dwa prostokąty.
    const poziomo =
      podzial === "krotsza" ? f.w - pw < f.h - ph : podzial === "dluzsza" ? f.w - pw >= f.h - ph : restW * ph < f.w * restH; // pole: większy kawałek zostaje w całości
    const prawy: Wolny = { x: f.x + pw + k, y: f.y, w: restW, h: poziomo ? ph : f.h };
    const gorny: Wolny = { x: f.x, y: f.y + ph + k, w: poziomo ? f.w : pw, h: restH };
    a.wolne.splice(b.f, 1);
    for (const r of [prawy, gorny]) if (r.w > 0 && r.h > 0) a.wolne.push(r);
  }
  return arkusze;
}

export function rozkroj(lista: readonly DoRozkroju[], sloje: boolean, u: UstawieniaRozkroju = ROZKROJ_DOMYSLNY): WynikRozkroju {
  const L = u.arkusz.dl - 2 * u.obrzeze;
  const S = u.arkusz.szer - 2 * u.obrzeze;
  const miesci = (p: DoRozkroju) => (p.dl <= L && p.szer <= S) || (!sloje && p.szer <= L && p.dl <= S);
  const zaDuze = lista.filter((p) => !miesci(p));
  const sztuki: Szt[] = [];
  for (const p of lista) if (miesci(p)) for (let i = 0; i < p.ilosc; i++) sztuki.push({ ref: p.ref, nr: p.nr, dl: p.dl, szer: p.szer });

  const kolejnosci: ((a: Szt, b: Szt) => number)[] = [
    (a, b) => b.dl * b.szer - a.dl * a.szer,
    (a, b) => Math.max(b.dl, b.szer) - Math.max(a.dl, a.szer) || b.dl * b.szer - a.dl * a.szer,
    (a, b) => b.szer - a.szer || b.dl - a.dl,
    (a, b) => b.dl - a.dl || b.szer - a.szer,
  ];
  const podzialy: Podzial[] = ["krotsza", "dluzsza", "pole"];
  let najlepszy: ReturnType<typeof ulozenie> | null = null;
  const ocena = (a: ReturnType<typeof ulozenie>) => [a.length, a.length ? a[a.length - 1].pole : 0] as const;
  for (const sort of kolejnosci)
    for (const p of podzialy) {
      const wynik = ulozenie([...sztuki].sort(sort), !sloje, u, p);
      if (!najlepszy) najlepszy = wynik;
      else {
        const [n1, r1] = ocena(wynik);
        const [n0, r0] = ocena(najlepszy);
        if (n1 < n0 || (n1 === n0 && r1 < r0)) najlepszy = wynik;
      }
    }
  // Resztki: wolne prostokąty, których krótszy bok ≥ progu (prostokąty z cięcia gilotynowego się nie nakładają).
  const prog = u.resztka ?? 0;
  const arkusze = (najlepszy ?? []).map((a) => ({
    kawalki: a.kawalki,
    pole: a.pole,
    resztki: prog > 0 ? a.wolne.filter((f) => Math.min(f.w, f.h) >= prog).sort((x, y) => y.w * y.h - x.w * x.h) : [],
  }));
  const calosc = arkusze.length * u.arkusz.dl * u.arkusz.szer;
  const zajete = arkusze.reduce((s, a) => s + a.pole, 0);
  return { arkusze, zaDuze, odpad: calosc ? 1 - zajete / calosc : 0, poleArkuszy: calosc, poleFormatek: zajete };
}
