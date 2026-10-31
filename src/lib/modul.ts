/*
 * Moduły parametryczne (szafka z płyty 18 mm, src/components/modul/Szafka.tsx) i ich cena
 * z cennika firmy. Wspólne dla strony (podgląd ceny) i functions/ (cena liczona na serwerze –
 * klient nigdy nie wysyła ceny modułu).
 *
 * Cena modułu (zł netto) = baza + płyta [m²] × plytaM2 + front [m²] × frontM2 + szerokość [m] × mb
 *   płyta (jak geometria w Szafka.tsx): 2 boki (wys × gł), wieniec dolny i półka (szer × gł),
 *   2 listwy górne (szer × 10 cm)
 *   front: szer × wys
 */
export type ModulDims = {
  /** szerokość [cm] */
  w: number;
  /** wysokość [cm] */
  h: number;
  /** głębokość [cm] */
  d: number;
};

export type ModulItem = ModulDims & { nazwa: string };

export type ModulCennik = {
  /** Cena bazowa za moduł (okucia, montaż) */
  baza: number;
  /** Płyta korpusu za m² */
  plytaM2: number;
  /** Front za m² */
  frontM2: number;
  /** Za metr bieżący szerokości (np. blat, cokół) */
  mb: number;
  /** Szuflada we wnętrzu modułu (prowadnice, za sztukę). Brak w starych cennikach = domyślna. */
  szuflada?: number;
  /** Drążek w szafie (za sztukę). */
  drazek?: number;
  /**
   * Płyty korpusów do wyboru w ofercie (grubość, format arkusza, cena za arkusz). Brak = jedna płyta 18 mm
   * z ceną plytaM2. Przy zapisie cennika plytaM2 = cena za m² płyty domyślnej (stare wyliczenia działają dalej).
   */
  plyty?: PlytaKorpusu[];
  /** Id płyty domyślnej (nowe oferty i oferty bez wybranej płyty). */
  plytaDomyslna?: string;
  /** Odpad przy rozkroju [%] – doliczany do ceny za m² i do liczby arkuszy. */
  odpadPlyty?: number;
  /** Własne pozycje w cenie (transport, montaż, LED, rabat…) – dolicza je oferta (dodatki.ts). */
  pozycje?: PozycjaCennika[];
};

/** Płyta korpusu: grubość [mm], format arkusza [mm] i cena za arkusz [zł netto]. */
export type PlytaKorpusu = { id: string; nazwa: string; grubosc: number; dl: number; szer: number; cenaArkusza: number };

/**
 * Jednostka własnej pozycji: kpl – ryczałt, szt – ilość wpisana w ofercie, mb – metr bieżący zabudowy
 * (liczony z planu, można poprawić), proc – procent ceny mebli (np. 10 = 10%, −5 = rabat 5%).
 */
export type JednostkaPozycji = "kpl" | "szt" | "mb" | "proc";
export type PozycjaCennika = {
  id: string;
  nazwa: string;
  /** Kwota za jednostkę [zł netto] albo procent (jednostka proc). Ujemna = rabat. */
  cena: number;
  jednostka: JednostkaPozycji;
  /** Dodawana sama do każdej nowej oferty (można ją potem usunąć). */
  domyslna?: boolean;
};

export const JEDNOSTKA_LABEL: Record<JednostkaPozycji, string> = { kpl: "kpl.", szt: "szt.", mb: "mb", proc: "%" };
export const JEDNOSTKI: readonly JednostkaPozycji[] = ["kpl", "szt", "mb", "proc"];
export const MAX_PLYT = 12;
export const MAX_POZYCJI = 30;

/** Standardowy arkusz płyty meblowej 2800 × 2070 mm. */
export const FORMAT_STANDARD = { dl: 2800, szer: 2070 } as const;

export const powierzchniaArkusza = (p: Pick<PlytaKorpusu, "dl" | "szer">) => (p.dl * p.szer) / 1_000_000;

/** Cena płyty za m² z ceny arkusza i odpadu [%], do 0,01 zł. */
export function cenaPlytyM2(p: Pick<PlytaKorpusu, "dl" | "szer" | "cenaArkusza">, odpad = 0) {
  const pole = powierzchniaArkusza(p);
  return pole > 0 ? Math.round((p.cenaArkusza / pole) * (1 + Math.max(0, odpad) / 100) * 100) / 100 : 0;
}

/** Płyty cennika; stary cennik bez listy – jedna płyta 18 mm odtworzona z plytaM2 (cena za m² ta sama). */
export function plytyCennika(c: ModulCennik): PlytaKorpusu[] {
  if (c.plyty?.length) return c.plyty;
  return [{ id: "p18", nazwa: "Płyta 18 mm", grubosc: 18, ...FORMAT_STANDARD, cenaArkusza: Math.round(c.plytaM2 * powierzchniaArkusza(FORMAT_STANDARD) * 100) / 100 }];
}

/** Płyta oferty (id z planu) albo domyślna; cenaM2 – do wzoru modułu. */
export function plytaOferty(c: ModulCennik, id?: string | null): { plyta: PlytaKorpusu | null; cenaM2: number } {
  if (!c.plyty?.length) return { plyta: null, cenaM2: c.plytaM2 };
  const p = c.plyty.find((x) => x.id === id) ?? c.plyty.find((x) => x.id === c.plytaDomyslna) ?? c.plyty[0];
  return { plyta: p, cenaM2: cenaPlytyM2(p, c.odpadPlyty) };
}

/** Cennik z ceną płyty wybranej w ofercie – reszta wzorów (moduł, wnętrze) liczy jak dotąd. */
export const cennikZPlyta = (c: ModulCennik, id?: string | null): ModulCennik => ({ ...c, plytaM2: plytaOferty(c, id).cenaM2 });

export const DEFAULT_CENNIK: ModulCennik = { baza: 250, plytaM2: 120, frontM2: 380, mb: 0, szuflada: 90, drazek: 35 };
export const DOMYSLNE_DODATKI = { szuflada: 90, drazek: 35 } as const;

/** Szafka z płyty — suwak na stronie modułu i formularz „szafki na wymiar”. */
export const MODUL_LIMITS = {
  w: { min: 20, max: 120 },
  h: { min: 30, max: 220 },
  d: { min: 20, max: 70 },
} as const;

/**
 * Absolutny zakres pozycji z kreatora (szafka, AGD, półka).
 * Cieńsze od szafki są płyta, bateria i półka ścienna; narożna bywa głębsza niż 70 cm.
 * Formularz samych szafek nadal używa MODUL_LIMITS.
 */
export const LINIA_LIMITS = {
  w: { min: 4, max: 120 },
  h: { min: 4, max: 240 },
  d: { min: 4, max: 120 },
} as const;

export const MAX_MODULY = 30;

export function modulPowierzchnie(m: ModulDims) {
  const w = m.w / 100;
  const h = m.h / 100;
  const d = m.d / 100;
  return { plyta: 2 * h * d + 2 * w * d + 2 * w * 0.1, front: w * h, mb: w };
}

export function modulCena(m: ModulDims, c: ModulCennik) {
  const p = modulPowierzchnie(m);
  return Math.round(c.baza + p.plyta * c.plytaM2 + p.front * c.frontM2 + p.mb * c.mb);
}

export const sumaModulow = (list: ModulItem[], c: ModulCennik) => list.reduce((s, m) => s + modulCena(m, c), 0);
