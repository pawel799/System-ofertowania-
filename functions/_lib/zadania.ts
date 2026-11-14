/*
 * Zadania w tle bez crona (Pages Functions go nie mają): uruchamiane przy okazji ruchu na /api/* najwyżej raz
 * na godzinę (_middleware.ts, blokada w KV) i raz dziennie z GitHub Actions (POST /api/zadania z CRON_SECRET).
 *
 * Teraz: maile o końcu okresu próbnego do właścicieli firm (potwierdzone adresy):
 *   7 dni przed, 2 dni przed, w ostatnim dniu i dzień po końcu (do 7 dni po – starszych już nie budzimy).
 * Każdy etap wychodzi raz (flaga trialmail:<firma>:<koniec>:<etap>, 60 dni); w kluczu jest data końca,
 * więc przedłużenie okresu próbnego przez administratora zaczyna przypomnienia od nowa.
 */
import { mailConfigured, sendTrialReminder } from "./notify";
import type { Env, KVNamespace } from "./offers";
import { firmUsers, isVerified, listFirms, type Firm } from "./tenant";

const DZIEN = 86_400_000;
const BLOKADA = "zadania:ostatnio";

export type EtapTrial = "7" | "2" | "0" | "po";

/** Etap przypomnienia dla firmy teraz (null = nic do wysłania). */
export function etapTrial(f: Pick<Firm, "status" | "trialEnds">, now = Date.now()): EtapTrial | null {
  if (f.status !== "trial" || !f.trialEnds) return null;
  const koniec = Date.parse(f.trialEnds);
  if (!Number.isFinite(koniec)) return null;
  const zostalo = koniec - now;
  if (zostalo < -7 * DZIEN) return null;
  if (zostalo <= 0) return "po";
  if (zostalo <= DZIEN) return "0";
  if (zostalo <= 2 * DZIEN) return "2";
  if (zostalo <= 7 * DZIEN) return "7";
  return null;
}

const KOLEJNOSC: EtapTrial[] = ["7", "2", "0", "po"];
const flaga = (f: Firm, e: EtapTrial) => `trialmail:${f.id}:${f.trialEnds}:${e}`;

/** Przypomnienia o końcu okresu próbnego dla wszystkich firm. Zwraca liczbę wysłanych maili. */
export async function przypomnieniaTrial(env: Env, kv: KVNamespace, origin: string, now = Date.now()) {
  if (!mailConfigured(env)) return 0;
  let wyslane = 0;
  for (const f of await listFirms(kv)) {
    const etap = etapTrial(f, now);
    if (!etap || (await kv.get(flaga(f, etap)))) continue;
    const wlasciciele = (await firmUsers(kv, f.id)).filter((u) => u.role === "owner" && isVerified(u));
    // Flaga przed wysyłką – dwa równoległe przebiegi nie wyślą dwóch maili; wcześniejsze etapy też odhaczone.
    for (const e of KOLEJNOSC.slice(0, KOLEJNOSC.indexOf(etap) + 1)) await kv.put(flaga(f, e), "1", { expirationTtl: 60 * 86400 });
    if (!wlasciciele.length) continue;
    const ok = await sendTrialReminder(env, {
      to: wlasciciele.map((u) => u.email),
      imie: wlasciciele[0].name,
      firma: f.name,
      etap,
      koniec: f.trialEnds!,
      link: `${origin}/panel/ustawienia?tab=plan`,
    });
    if (ok) wyslane++;
  }
  return wyslane;
}

/**
 * Wszystkie zadania w tle. Bez `wymus` – najwyżej raz na godzinę (blokada w KV), żeby ruch na API nie
 * przeglądał firm przy każdym zapytaniu.
 */
export async function uruchomZadania(env: Env, kv: KVNamespace, origin: string, wymus = false) {
  if (!wymus) {
    if (await kv.get(BLOKADA)) return null;
    await kv.put(BLOKADA, new Date().toISOString(), { expirationTtl: 3600 });
  }
  const trial = await przypomnieniaTrial(env, kv, origin);
  return { trial };
}
