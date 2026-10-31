/*
 * Dodatki do ceny oferty: pozycje z cennika firmy (Ustawienia → Cennik modułów → „Własne pozycje”)
 * i pozycje wpisane w samej ofercie (np. „Demontaż starej zabudowy”). Zapis w planie (plan.dodatki),
 * walidacja w parseKuchnia, suma w cenie oferty (bazaKuchni) – ta sama w kreatorze, panelu, u klienta i na serwerze.
 *
 * Pozycja z cennika: nazwa, cena i jednostka zawsze z aktualnego cennika (oferta pamięta tylko id i ilość).
 * Pozycja własna oferty (id zaczyna się od „w”): nazwa, cena i jednostka zapisane w planie.
 * Bez importów z kuchnia.ts (kuchnia.ts korzysta z tego pliku).
 */
import { JEDNOSTKI, MAX_POZYCJI, type JednostkaPozycji, type ModulCennik } from "./modul";

export type DodatekOferty = {
  /** Id pozycji z cennika albo „w…” – własna pozycja tej oferty. */
  id: string;
  /** Ilość: szt. – sztuki, mb – metry (brak = z planu), kpl i % – pomijana. */
  ilosc?: number;
  /** Tylko pozycja własna oferty. */
  nazwa?: string;
  cena?: number;
  jednostka?: JednostkaPozycji;
};

export type DodatekWyceniony = {
  id: string;
  nazwa: string;
  jednostka: JednostkaPozycji;
  /** Ilość użyta w cenie (mb z planu, gdy nie wpisano). */
  ilosc: number;
  /** Cena za jednostkę albo procent. */
  cena: number;
  kwota: number;
  /** Pozycja z cennika, której już nie ma – nie liczy się. */
  brak?: boolean;
};

export const wlasnyDodatek = (id: string) => id.startsWith("w");

const zaokr = (n: number) => Math.round(n * 100) / 100;

/**
 * Wycena dodatków. meble – suma mebli (podstawa dla %), mb – metry bieżące zabudowy z planu.
 * Kwoty do pełnych złotych, jak ceny modułów.
 */
export function wycenDodatki(dodatki: readonly DodatekOferty[] | undefined, cennik: ModulCennik, ctx: { meble: number; mb: number }): DodatekWyceniony[] {
  if (!dodatki?.length) return [];
  const zCennika = new Map((cennik.pozycje ?? []).map((p) => [p.id, p]));
  return dodatki.map((d) => {
    const wzor = wlasnyDodatek(d.id) ? null : zCennika.get(d.id);
    const nazwa = wzor ? wzor.nazwa : (d.nazwa ?? "Pozycja");
    const cena = wzor ? wzor.cena : (d.cena ?? 0);
    const jednostka = wzor ? wzor.jednostka : (d.jednostka ?? "kpl");
    if (!wzor && !wlasnyDodatek(d.id)) return { id: d.id, nazwa: d.nazwa ?? "Pozycja usunięta z cennika", jednostka, ilosc: 0, cena: 0, kwota: 0, brak: true };
    const ilosc = jednostka === "kpl" || jednostka === "proc" ? 1 : jednostka === "mb" ? zaokr(d.ilosc ?? ctx.mb) : (d.ilosc ?? 1);
    const kwota = jednostka === "proc" ? Math.round((ctx.meble * cena) / 100) : Math.round(cena * ilosc);
    return { id: d.id, nazwa, jednostka, ilosc, cena, kwota };
  });
}

/** Nowa oferta: pozycje cennika oznaczone „dodawaj do każdej oferty”. */
export const dodatkiDomyslne = (cennik: ModulCennik): DodatekOferty[] => (cennik.pozycje ?? []).filter((p) => p.domyslna).map((p) => ({ id: p.id }));

/* ---------- walidacja (serwer) ---------- */

const ID_RE = /^[A-Za-z0-9-]{1,24}$/;

export function parseDodatki(v: unknown): DodatekOferty[] {
  const zle = (m: string): never => {
    throw new Error(`Dodatki: ${m}`);
  };
  if (!Array.isArray(v) || v.length > MAX_POZYCJI) zle(`do ${MAX_POZYCJI} pozycji.`);
  const ids = new Set<string>();
  return (v as unknown[]).map((x, i) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) zle(`pozycja ${i + 1} ma zły format.`);
    const o = x as Record<string, unknown>;
    const id = typeof o.id === "string" && ID_RE.test(o.id) ? o.id : zle(`pozycja ${i + 1}: zły identyfikator.`);
    if (ids.has(id)) zle(`pozycja ${i + 1} jest dwa razy.`);
    ids.add(id);
    const out: DodatekOferty = { id };
    if (o.ilosc !== undefined && o.ilosc !== null) {
      if (typeof o.ilosc !== "number" || !Number.isFinite(o.ilosc) || o.ilosc < 0 || o.ilosc > 10_000) zle(`pozycja ${i + 1}: ilość od 0 do 10 000.`);
      out.ilosc = zaokr(o.ilosc as number);
    }
    if (wlasnyDodatek(id)) {
      const nazwa = typeof o.nazwa === "string" ? o.nazwa.replace(/\s+/g, " ").trim().slice(0, 80) : "";
      if (!nazwa) zle(`pozycja ${i + 1}: podaj nazwę.`);
      const jednostka = JEDNOSTKI.includes(o.jednostka as JednostkaPozycji) ? (o.jednostka as JednostkaPozycji) : "kpl";
      const [min, max] = jednostka === "proc" ? [-50, 100] : [-1_000_000, 1_000_000];
      if (typeof o.cena !== "number" || !Number.isFinite(o.cena) || o.cena < min || o.cena > max) zle(`„${nazwa}”: kwota od ${min} do ${max}.`);
      Object.assign(out, { nazwa, cena: zaokr(o.cena as number), jednostka });
    }
    return out;
  });
}
