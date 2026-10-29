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
};

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
