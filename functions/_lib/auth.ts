/*
 * Logowanie do panelu: konta firm (e-mail + hasło, sesja w ciasteczku) albo kod administratora (PANEL_TOKEN).
 *
 * Hasła: PBKDF2-SHA256 z losową solą (WebCrypto). Liczba iteracji zapisana przy haśle,
 * więc można ją zmienić (PASSWORD_ITERATIONS) bez psucia starych kont.
 * Sesja: losowy token w ciasteczku HttpOnly; w KV trzymamy tylko jego skrót (sess:<sha256>).
 * Ochrona przed CSRF: SameSite=Lax + sprawdzenie nagłówka Origin przy zmianach.
 */
import { bearerToken, HttpError, randomId, store, verifyPanelToken, type Ctx, type Env, type KVNamespace } from "./offers";
import { assertFirmActive, getFirm, getUser, MAIN_FIRM, scoped, type Firm, type Role, type ScopedKV, type User } from "./tenant";

export type Session = {
  firmId: string;
  /** "admin" = wejście kodem PANEL_TOKEN (właściciel systemu). */
  role: Role | "admin";
  email: string | null;
  name: string | null;
};

const COOKIE = "so_sesja";
const SESSION_DAYS = 30;
const MAX_ITERATIONS = 100_000; // Workers nie przyjmują więcej dla PBKDF2

/* ---------- Hasła ---------- */

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...Array.from(bytes)));
const unb64 = (s: string) => new Uint8Array(Array.from(atob(s), (c) => c.charCodeAt(0)));

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export const iterationsFor = (env: Env) => {
  const n = Number(env.PASSWORD_ITERATIONS);
  return Number.isInteger(n) && n >= 10_000 ? Math.min(n, MAX_ITERATIONS) : MAX_ITERATIONS;
};

export async function hashPassword(password: string, iterations: number) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = await pbkdf2(password, unb64(salt), Number(iter));
  const want = unb64(hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < Math.min(got.length, want.length); i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export function checkPasswordRules(password: unknown) {
  if (typeof password !== "string" || password.length < 8) {
    throw new HttpError(400, "weak_password", "Hasło musi mieć co najmniej 8 znaków.");
  }
  if (password.length > 200) throw new HttpError(400, "invalid", "Hasło jest za długie.");
  return password;
}

/* ---------- Sesje ---------- */

async function sha256hex(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

type StoredSession = { email: string; firmId: string; iat: string };

const secureFlag = (request: Request) => (new URL(request.url).protocol === "https:" ? "; Secure" : "");

/** Tworzy sesję i zwraca nagłówek Set-Cookie. */
export async function createSession(kv: KVNamespace, user: User, request: Request) {
  const token = randomId(40);
  const value: StoredSession = { email: user.email, firmId: user.firmId, iat: new Date().toISOString() };
  await kv.put(`sess:${await sha256hex(token)}`, JSON.stringify(value), { expirationTtl: SESSION_DAYS * 86400 });
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secureFlag(request)}`;
}

export const clearCookie = (request: Request) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(request)}`;

function cookieToken(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return "";
}

/** Sesja z ciasteczka (albo null). Sprawdza konto, firmę i zmianę hasła po zalogowaniu. */
export async function readSession(ctx: Ctx): Promise<{ user: User; firm: Firm | null } | null> {
  const token = cookieToken(ctx.request);
  if (!token || token.length > 100) return null;
  const kv = store(ctx.env);
  const raw = await kv.get(`sess:${await sha256hex(token)}`);
  if (!raw) return null;
  const s = JSON.parse(raw) as StoredSession;
  const user = await getUser(kv, s.email);
  if (!user || user.firmId !== s.firmId) return null;
  if (user.pwChangedAt && Date.parse(user.pwChangedAt) > Date.parse(s.iat)) return null;
  const firm = user.firmId === MAIN_FIRM ? null : await getFirm(kv, user.firmId);
  if (user.firmId !== MAIN_FIRM && !firm) return null;
  return { user, firm };
}

export async function destroySession(ctx: Ctx) {
  const token = cookieToken(ctx.request);
  if (token && token.length <= 100) await store(ctx.env).delete(`sess:${await sha256hex(token)}`);
}

/** Zmiany wysłane z innej strony (CSRF): przeglądarka zawsze dołącza Origin do POST/PUT/PATCH/DELETE. */
function checkOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "bad_origin", "Żądanie z innej strony zostało odrzucone.");
  }
}

/* ---------- Dostęp do panelu ---------- */

/** Zalogowana firma (ciasteczko) albo administrator (kod PANEL_TOKEN). Inaczej 401. */
export async function requirePanel(ctx: Ctx): Promise<Session> {
  const fromCookie = await readSession(ctx);
  if (fromCookie) {
    checkOrigin(ctx.request);
    if (fromCookie.firm) assertFirmActive(fromCookie.firm);
    const u = fromCookie.user;
    return { firmId: u.firmId, role: u.role, email: u.email, name: u.name };
  }
  if (bearerToken(ctx.request)) {
    await verifyPanelToken(ctx);
    return { firmId: MAIN_FIRM, role: "admin", email: null, name: null };
  }
  throw new HttpError(401, "unauthorized", "Zaloguj się do panelu.");
}

/** Sesja + magazyn KV tej firmy (klucze z prefiksem firmy). */
export async function panel(ctx: Ctx): Promise<{ session: Session; kv: ScopedKV }> {
  const session = await requirePanel(ctx);
  return { session, kv: scoped(store(ctx.env), session.firmId) };
}

export function requireOwner(s: Session) {
  if (s.role !== "owner" && s.role !== "admin") {
    throw new HttpError(403, "owner_only", "Tylko właściciel konta firmy może to zmienić.");
  }
}

export function requireAdmin(s: Session) {
  if (s.role !== "admin") throw new HttpError(403, "admin_only", "Tylko administrator systemu.");
}

/* ---------- Limity prób ---------- */

/** Licznik prób w KV (np. logowania z IP); po przekroczeniu 429. */
export async function bumpLimit(kv: KVNamespace, key: string, limit: number, ttl: number, message: string) {
  const n = Number((await kv.get(key)) ?? 0);
  if (n >= limit) throw new HttpError(429, "too_many", message);
  await kv.put(key, String(n + 1), { expirationTtl: ttl });
}

export const clientIp = (ctx: Ctx) => ctx.request.headers.get("cf-connecting-ip") ?? "unknown";
