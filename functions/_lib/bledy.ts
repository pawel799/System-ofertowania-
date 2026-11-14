/*
 * Błędy z produkcji: z przeglądarek (POST /api/bledy – components/ZbieranieBledow.tsx) i z funkcji serwera
 * (handle() w offers.ts). Grupowane po rodzaju (skrót źródła, komunikatu i pierwszej linii stosu):
 * licznik, pierwszy i ostatni raz, do 5 ścieżek. Bez danych osobowych – tylko ścieżka strony (bez ?query i #).
 * Klucz blad:<id>, 30 dni od ostatniego wystąpienia. Podgląd: Ustawienia → Błędy (administrator).
 */
import type { KVNamespace } from "./offers";

export type ZrodloBledu = "przegladarka" | "serwer";
export type Blad = {
  id: string;
  zrodlo: ZrodloBledu;
  msg: string;
  stack: string;
  sciezki: string[];
  ile: number;
  pierwszy: string;
  ostatnio: string;
  ua?: string;
};

const PREFIX = "blad:";
const TTL = 30 * 86400;
const enc = new TextEncoder();
const przytnij = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\r\n?/g, "\n").slice(0, max) : "");

/** Ścieżka bez parametrów i hasha (tam bywają tokeny i projekty klientów). */
export const czystaSciezka = (s: unknown) => przytnij(typeof s === "string" ? s.replace(/[?#][\s\S]*$/, "") : "", 200);

async function skrot(t: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(t)));
  return Array.from(d.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Pierwsza linia stosu bez numerów kolumn (różne wersje plików → ten sam błąd w jednej grupie). */
const odcisk = (stack: string) => (stack.split("\n").find((l) => /at |@/.test(l)) ?? "").replace(/:\d+:\d+\)?$/, "").replace(/\?[^)\s]*/, "").trim();

export async function zapiszBlad(kv: KVNamespace, b: { zrodlo: ZrodloBledu; msg: unknown; stack?: unknown; sciezka?: unknown; ua?: unknown }) {
  const msg = przytnij(b.msg, 300).trim() || "(bez komunikatu)";
  const stack = przytnij(b.stack, 2000);
  const sciezka = czystaSciezka(b.sciezka);
  const id = await skrot(`${b.zrodlo}|${msg}|${odcisk(stack)}`);
  const teraz = new Date().toISOString();
  const raw = await kv.get(PREFIX + id);
  const stary = raw ? (JSON.parse(raw) as Blad) : null;
  const sciezki = stary ? Array.from(new Set([sciezka, ...stary.sciezki].filter(Boolean))).slice(0, 5) : sciezka ? [sciezka] : [];
  const nowy: Blad = {
    id,
    zrodlo: b.zrodlo,
    msg,
    stack: stack || stary?.stack || "",
    sciezki,
    ile: (stary?.ile ?? 0) + 1,
    pierwszy: stary?.pierwszy ?? teraz,
    ostatnio: teraz,
    ...(b.ua || stary?.ua ? { ua: przytnij(b.ua, 200) || stary?.ua } : {}),
  };
  await kv.put(PREFIX + id, JSON.stringify(nowy), { expirationTtl: TTL });
}

/** Najnowsze błędy (do 200), od ostatnio występującego. */
export async function listaBledow(kv: KVNamespace): Promise<Blad[]> {
  const klucze: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: PREFIX, cursor });
    klucze.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && klucze.length < 1000);
  const wartosci = await Promise.all(klucze.slice(0, 1000).map((k) => kv.get(k)));
  return wartosci
    .filter((v): v is string => !!v)
    .map((v) => JSON.parse(v) as Blad)
    .sort((a, b) => b.ostatnio.localeCompare(a.ostatnio))
    .slice(0, 200);
}

export async function usunBledy(kv: KVNamespace, id?: string) {
  if (id) return kv.delete(PREFIX + id.replace(/[^a-f0-9]/g, ""));
  for (const b of await listaBledow(kv)) await kv.delete(PREFIX + b.id);
}
