/*
 * Konta firm (wiele stolarni w jednym systemie).
 *
 * Każda firma ma własną przestrzeń w KV: klucze z prefiksem t:<firmId>: (oferty, modele, pakiety RAL,
 * marka, domena, zgłoszenia). Dotychczasowe dane bez prefiksu należą do firmy "main" – to firma
 * właściciela systemu i dawne wejście kodem PANEL_TOKEN, więc nic nie trzeba migrować.
 *
 * Kod endpointów dalej woła kv.get("offer:…") – scoped() dokleja prefiks sam.
 * Wyjątek: slug:<link> jest wspólny dla wszystkich firm (strona klienta szuka oferty po samym linku),
 * dlatego wartość ma postać "<firmId>|<klucz oferty>" (dla "main" sam klucz, jak dotąd).
 *
 * Klucze globalne (bez prefiksu):
 *   firm:<id>          -> Firm (JSON)
 *   firmnip:<nip>      -> id firmy (jedna firma na NIP)
 *   firmusers:<id>     -> lista e-maili kont firmy (JSON)
 *   user:<email>       -> User (JSON, e-mail małymi literami)
 *   sess:<sha256>      -> sesja (JSON), wygasa po 30 dniach
 *   pwreset:<sha256>   -> e-mail, link do zmiany hasła ważny 1 godzinę
 *   modelowner:<id>    -> id firmy, do której należy model 3D (publiczny plik modelu)
 */
import type { PlanId } from "../../src/lib/plans";
import { HttpError, type KVNamespace } from "./offers";

export const MAIN_FIRM = "main";
export const FIRM_ID_RE = /^[A-Za-z0-9]{8,32}$/;

export type FirmStatus = "trial" | "active" | "suspended";

/** Dane płatności – na razie tylko "manual" (faktura); pola pod przyszłego operatora płatności. */
export type FirmBilling = {
  provider: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  period?: "month" | "year";
};

export type Firm = {
  id: string;
  name: string;
  nip: string;
  plan: PlanId;
  status: FirmStatus;
  /** Koniec okresu próbnego (ISO), gdy status = "trial". */
  trialEnds?: string | null;
  /** Opłacone do (ISO), uzupełniane ręcznie albo przez operatora płatności. */
  paidUntil?: string | null;
  billing?: FirmBilling | null;
  createdAt: string;
  updatedAt?: string;
};

export type Role = "owner" | "member";

export type User = {
  id: string;
  email: string;
  name: string;
  firmId: string;
  role: Role;
  /** pbkdf2$<iteracje>$<sól base64>$<skrót base64> */
  pw: string;
  /** Zmiana hasła unieważnia starsze sesje. */
  pwChangedAt?: string;
  createdAt: string;
  lastLogin?: string;
};

/* ---------- KV z prefiksem firmy ---------- */

export type ScopedKV = KVNamespace & { firmId: string; root: KVNamespace };

const FOREIGN = "\u0000inna-firma";
const prefixOf = (firmId: string) => (firmId === MAIN_FIRM ? "" : `t:${firmId}:`);
const isSlugKey = (k: string) => k.startsWith("slug:");

/** Właściciel linku: "<firmId>|<klucz>" albo sam klucz (firma "main"). */
export function parseSlugValue(v: string): { firmId: string; key: string } {
  const i = v.indexOf("|");
  return i < 0 ? { firmId: MAIN_FIRM, key: v } : { firmId: v.slice(0, i), key: v.slice(i + 1) };
}

export function scoped(root: KVNamespace, firmId: string): ScopedKV {
  const p = prefixOf(firmId);
  return {
    firmId,
    root,
    async get(key) {
      if (!isSlugKey(key)) return root.get(p + key);
      const v = await root.get(key);
      if (v === null) return null;
      const owner = parseSlugValue(v);
      // Link innej firmy: wartość różna od każdego klucza oferty, więc claimSlug zgłosi konflikt.
      return owner.firmId === firmId ? owner.key : FOREIGN;
    },
    async put(key, value, options) {
      if (!isSlugKey(key)) return root.put(p + key, value, options);
      return root.put(key, firmId === MAIN_FIRM ? value : `${firmId}|${value}`, options);
    },
    async delete(key) {
      if (!isSlugKey(key)) return root.delete(p + key);
      const v = await root.get(key);
      if (v !== null && parseSlugValue(v).firmId !== firmId) return; // cudzego linku nie ruszamy
      return root.delete(key);
    },
    async list(options) {
      const prefix = options?.prefix ?? "";
      if (isSlugKey(prefix)) throw new Error("slug: jest wspólny dla firm – nie listujemy go przez scoped()");
      const page = await root.list({ ...options, prefix: p + prefix });
      return { ...page, keys: page.keys.map((k) => ({ name: k.name.slice(p.length) })) };
    },
  };
}

/* ---------- Firmy i konta ---------- */

export const normEmail = (v: string) => v.trim().toLowerCase();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function getFirm(kv: KVNamespace, id: string): Promise<Firm | null> {
  if (!FIRM_ID_RE.test(id)) return null;
  const raw = await kv.get(`firm:${id}`);
  return raw ? (JSON.parse(raw) as Firm) : null;
}

export async function putFirm(kv: KVNamespace, firm: Firm) {
  await kv.put(`firm:${firm.id}`, JSON.stringify({ ...firm, updatedAt: new Date().toISOString() }));
}

export async function listFirms(kv: KVNamespace): Promise<Firm[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "firm:", cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const raws = await Promise.all(keys.map((k) => kv.get(k)));
  return raws
    .filter((r): r is string => !!r)
    .map((r) => JSON.parse(r) as Firm)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUser(kv: KVNamespace, email: string): Promise<User | null> {
  const raw = await kv.get(`user:${normEmail(email)}`);
  return raw ? (JSON.parse(raw) as User) : null;
}

export async function putUser(kv: KVNamespace, user: User) {
  await kv.put(`user:${user.email}`, JSON.stringify(user));
}

export async function firmEmails(kv: KVNamespace, firmId: string): Promise<string[]> {
  const raw = await kv.get(`firmusers:${firmId}`);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function setFirmEmails(kv: KVNamespace, firmId: string, emails: string[]) {
  await kv.put(`firmusers:${firmId}`, JSON.stringify(Array.from(new Set(emails))));
}

export async function firmUsers(kv: KVNamespace, firmId: string): Promise<User[]> {
  const list = await Promise.all((await firmEmails(kv, firmId)).map((e) => getUser(kv, e)));
  return list.filter((u): u is User => !!u && u.firmId === firmId);
}

/** Bez skrótu hasła – to, co może zobaczyć panel. */
export const userView = (u: User) => ({
  email: u.email,
  name: u.name,
  role: u.role,
  createdAt: u.createdAt,
  lastLogin: u.lastLogin ?? null,
});

export const firmView = (f: Firm) => ({
  id: f.id,
  name: f.name,
  nip: f.nip,
  plan: f.plan,
  status: f.status,
  trialEnds: f.trialEnds ?? null,
  paidUntil: f.paidUntil ?? null,
  createdAt: f.createdAt,
});

/** Okres próbny minął, a firma nie ma opłaconego planu. */
export function firmExpired(f: Firm, now = Date.now()) {
  if (f.status === "suspended") return true;
  if (f.status === "trial") return !!f.trialEnds && Date.parse(f.trialEnds) < now;
  return !!f.paidUntil && Date.parse(f.paidUntil) < now;
}

export function assertFirmActive(f: Firm) {
  if (f.status === "suspended") {
    throw new HttpError(403, "firm_suspended", "Konto firmy jest zawieszone. Napisz do nas, żeby je odblokować.");
  }
}
