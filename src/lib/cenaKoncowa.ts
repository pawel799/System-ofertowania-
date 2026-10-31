/*
 * Cena końcowa oferty z kreatora – jedna funkcja, która zlicza każdą składową:
 *   meble      – moduły i modele z cennika (z płytą wybraną w ofercie i dopłatą za wnętrze),
 *   dodatki    – własne pozycje z cennika i z oferty (kpl., szt., mb zabudowy, % ceny mebli, rabat),
 *   materiały  – dopłaty za front, blat i okucia (tylko grupy, które projekt ma – opcjeProjektu.ts).
 * razem = max(1, meble + dodatki) + materiały – dokładnie tyle co base oferty (bazaKuchni) + dopłaty (totalPrice),
 * więc kreator, panel, PDF i strona klienta pokazują tę samą kwotę. W React: useCenaKoncowa (panel/useCenaKoncowa.ts).
 */
import { wycenDodatki, type DodatekWyceniony } from "./dodatki";
import { metryBiezace, plytaProjektu, sumaMebli, type PlanKuchni } from "./kuchnia";
import { JEDNOSTKA_LABEL, plytaOferty, powierzchniaArkusza, type ModulCennik } from "./modul";

export type SkladnikCeny = {
  klucz: string;
  rodzaj: "meble" | "dodatek" | "material";
  nazwa: string;
  /** Np. „12 mb × 150 zł”, „10% od 18 400 zł”. */
  opis?: string;
  kwota: number;
};

export type CenaKoncowa = {
  meble: number;
  dodatki: number;
  materialy: number;
  /** Kwota jak base oferty: meble + dodatki, min. 1 zł przy niepustym projekcie. */
  baza: number;
  razem: number;
  skladniki: SkladnikCeny[];
  dodatkiWycenione: DodatekWyceniony[];
  /** Metry bieżące zabudowy (dodatki „za mb”). */
  mb: number;
  /** Płyta korpusów oferty i ile jej idzie (orientacyjnie, z odpadem). */
  plyta: { nazwa: string; grubosc: number; cenaM2: number; m2: number; arkusze: number; format: string } | null;
};

const liczba = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export function cenaKoncowa(args: {
  plan: PlanKuchni;
  cennik: ModulCennik;
  /** Dopłaty za materiały (już po filtrze grup); nazwa trafia do rozbicia. */
  doplaty?: readonly { klucz: string; nazwa: string; kwota: number }[];
  /** Formatowanie kwot w opisach (np. formatPln); domyślnie „123 zł”. */
  zl?: (n: number) => string;
}): CenaKoncowa {
  const { plan, cennik } = args;
  const zl = args.zl ?? ((n: number) => `${Math.round(n)} zł`);
  const pusty = !plan.elementy.length;
  const meble = pusty ? 0 : sumaMebli(plan, cennik);
  const mb = metryBiezace(plan);
  const dodatkiWycenione = pusty ? [] : wycenDodatki(plan.dodatki, cennik, { meble, mb });
  const dodatki = dodatkiWycenione.reduce((s, d) => s + d.kwota, 0);
  const baza = pusty ? 0 : Math.max(1, meble + dodatki);
  const doplaty = (args.doplaty ?? []).filter((d) => d.kwota !== 0);
  const materialy = pusty ? 0 : doplaty.reduce((s, d) => s + d.kwota, 0);

  const { plyta: p, cenaM2 } = plytaOferty(cennik, plan.plyta);
  const m2 = plytaProjektu(plan);
  const odpad = cennik.odpadPlyty ?? 0;
  const plyta =
    p && !pusty
      ? {
          nazwa: p.nazwa,
          grubosc: p.grubosc,
          cenaM2,
          m2,
          arkusze: Math.ceil((m2 * (1 + odpad / 100)) / Math.max(0.01, powierzchniaArkusza(p))),
          format: `${p.dl} × ${p.szer} mm`,
        }
      : null;

  const skladniki: SkladnikCeny[] = [];
  if (!pusty) {
    skladniki.push({
      klucz: "meble",
      rodzaj: "meble",
      nazwa: "Meble na wymiar",
      opis: plyta ? `${plyta.nazwa}, ${liczba(m2)} m² płyty` : undefined,
      kwota: meble,
    });
    for (const d of dodatkiWycenione) {
      if (d.brak) continue;
      const opis =
        d.jednostka === "proc"
          ? `${liczba(d.cena)}% od ${zl(meble)}`
          : d.jednostka === "kpl"
            ? undefined
            : `${liczba(d.ilosc)} ${JEDNOSTKA_LABEL[d.jednostka]} × ${zl(d.cena)}`;
      skladniki.push({ klucz: `d:${d.id}`, rodzaj: "dodatek", nazwa: d.nazwa, opis, kwota: d.kwota });
    }
    for (const d of doplaty) skladniki.push({ klucz: `m:${d.klucz}`, rodzaj: "material", nazwa: d.nazwa, kwota: d.kwota });
  }
  return { meble, dodatki, materialy, baza, razem: baza + materialy, skladniki, dodatkiWycenione, mb, plyta };
}
