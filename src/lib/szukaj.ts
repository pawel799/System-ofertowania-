/*
 * Wyszukiwarka katalogu odporna na błędy: polskie znaki (gorne = górne), błędy ortograficzne (gurne, rzaluzja),
 * literówki (szfka), odmiana (szafka = szafki = szafek) i słowa pokrewne (lodówka = chłodziarka, okap = wyciąg).
 * Bez zależności – katalog ma kilkadziesiąt pozycji, liczymy na bieżąco.
 */

/** Zapis „fonetyczny”: bez ogonków, ó = u, rz = ż = z, ch = h, ą/ę → on/en uproszczone do o/e, w = f na końcu… */
export function normuj(t: string): string {
  return t
    .toLowerCase()
    .replace(/ó/g, "u")
    .replace(/rz/g, "z")
    .replace(/ch/g, "h")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Końcówki odmiany (od najdłuższych) – rdzeń słowa do porównań. */
const KONCOWKI = ["ami", "ach", "owi", "ow", "om", "ek", "ka", "ki", "ke", "ce", "ie", "a", "e", "i", "o", "u", "y"];

export function rdzen(slowo: string): string {
  if (/^\d+$/.test(slowo) || slowo.length <= 3) return slowo;
  for (const k of KONCOWKI) if (slowo.length - k.length >= 3 && slowo.endsWith(k)) return slowo.slice(0, -k.length);
  return slowo;
}

/** Słowa pokrewne: każda grupa to jedno pojęcie (pierwsze słowo = główne). Zapis normalny – normuj() robi resztę. */
const POKREWNE: string[][] = [
  ["szafka", "szafa", "szafki", "korpus", "moduł", "mebel"],
  ["górna", "wisząca", "wiszące", "ścienna", "nad"],
  ["dolna", "stojąca", "pod", "blatowa"],
  ["słupek", "kolumna", "wysoka", "wysoki"],
  ["półka", "półki", "regał", "etażerka"],
  ["lodówka", "chłodziarka", "zamrażarka", "lodowka"],
  ["zmywarka", "zmywanie"],
  ["piekarnik", "piec", "pieczenie"],
  ["płyta", "kuchenka", "indukcja", "indukcyjna", "gazowa", "gaz", "kuchnia"],
  ["okap", "wyciąg", "pochłaniacz", "wywiew"],
  ["zlew", "zlewozmywak", "zlewozmywak", "umywalka", "komora"],
  ["bateria", "kran"],
  ["mikrofalówka", "mikrofala", "mikrofale"],
  ["szuflada", "szuflady", "szufladowa", "cargo"],
  ["narożna", "narożnik", "róg", "kąt"],
  ["rtv", "tv", "telewizor", "telewizyjna"],
  ["nocna", "nocny", "stolik"],
  ["łazienka", "łazienkowy", "umywalka"],
  ["przesuwna", "przesuwne", "przesuwane"],
  ["drzwi", "drzwiowa", "skrzydło"],
];

const MAPA_POKREWNYCH = (() => {
  const m = new Map<string, Set<string>>();
  for (const grupa of POKREWNE) {
    const rdzenie = grupa.map((s) => rdzen(normuj(s)));
    for (const r of rdzenie) {
      const set = m.get(r) ?? new Set<string>();
      rdzenie.forEach((x) => set.add(x));
      m.set(r, set);
    }
  }
  return m;
})();

/** Odległość edycyjna (Damerau – zamiana sąsiednich liter to 1 błąd), z przerwaniem powyżej limitu. */
export function odleglosc(a: string, b: string, limit = 3): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let min = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const k = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + k);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      min = Math.min(min, d[i][j]);
    }
    if (min > limit) return limit + 1;
  }
  return d[a.length][b.length];
}

/** Ile błędów wolno w słowie tej długości. */
const dozwolone = (n: number) => (n <= 3 ? 0 : n <= 5 ? 1 : 2);

/** Dopasowanie jednego słowa zapytania do słowa tekstu: 0 = idealne, wyżej = gorzej, null = nie pasuje. */
function dopasujSlowo(q: string, w: string): number | null {
  if (!q) return 0;
  if (w.startsWith(q)) return 0;
  // Liczby (wymiary): tylko początek – „6” pasuje do 60, nie do 45.
  if (/^\d+$/.test(q)) return null;
  const rq = rdzen(q);
  const rw = rdzen(w);
  if (rq === rw || rw.startsWith(rq) || (rq.length >= 4 && rq.startsWith(rw) && rw.length >= 3)) return 0.2;
  // Pokrewne słowa (lodówka = chłodziarka).
  const pokrewne = MAPA_POKREWNYCH.get(rq);
  if (pokrewne?.has(rw)) return 0.4;
  if (pokrewne) for (const p of Array.from(pokrewne)) if (rw.startsWith(p) && p.length >= 3) return 0.5;
  // Literówki: na rdzeniach i na początku słowa (wpisywanie w trakcie: „szfk” → „szafka”).
  const lim = dozwolone(q.length);
  if (!lim) return null;
  // Krótkie rdzenie (3 litery) łatwo pomylić – wtedy liczymy na całych słowach.
  const d = Math.min(
    rq.length >= 4 ? odleglosc(rq, rw, lim) : lim + 1,
    odleglosc(q, w, lim),
    odleglosc(q, w.slice(0, q.length + 1), lim),
    odleglosc(q, w.slice(0, q.length), lim),
  );
  return d <= lim ? 1 + d : null;
}

/**
 * Dopasowanie zapytania do tekstu (nazwa, grupa, słowa kluczowe): każde słowo zapytania musi pasować do jakiegoś słowa
 * tekstu. Zwraca wynik (mniej = lepiej) albo null.
 */
export function dopasuj(zapytanie: string, tekst: string): number | null {
  const q = normuj(zapytanie).split(" ").filter(Boolean);
  if (!q.length) return 0;
  const w = normuj(tekst).split(" ").filter(Boolean);
  let suma = 0;
  for (const s of q) {
    let best: number | null = null;
    for (const x of w) {
      const r = dopasujSlowo(s, x);
      if (r !== null && (best === null || r < best)) best = r;
      if (best === 0) break;
    }
    if (best === null) return null;
    suma += best;
  }
  return suma;
}

/** Podobieństwo do podpowiedzi „Może chodziło o…” (gdy nic nie pasuje): mniejsza liczba = bliżej. */
export function podobienstwo(zapytanie: string, tekst: string): number {
  const q = normuj(zapytanie).split(" ").filter(Boolean);
  const w = normuj(tekst).split(" ").filter(Boolean);
  if (!q.length || !w.length) return Infinity;
  let suma = 0;
  for (const s of q) suma += Math.min(...w.map((x) => odleglosc(rdzen(s), rdzen(x), 6)));
  return suma / q.length;
}
