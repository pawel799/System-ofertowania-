/*
 * Własna domena dla linków do ofert (np. oferty.firma.pl) przez Cloudflare for SaaS
 * ("custom hostnames"). Panel zapisuje domenę, a my zakładamy ją w strefie Cloudflare
 * i pilnujemy statusu (weryfikacja + certyfikat SSL).
 *
 * Wymagane zmienne (Settings → Variables and Secrets), wszystkie albo żadna:
 *   CF_API_TOKEN    – sekret: token API z uprawnieniem "SSL and Certificates: Edit" dla strefy
 *   CF_ZONE_ID      – id strefy z włączonym Cloudflare for SaaS
 *   CF_CNAME_TARGET – nazwa, na którą klient ustawia CNAME (np. klienci.twojadomena.pl)
 * KV: settings:domain -> DomainState (JSON)
 */
import { HttpError, type Env, type KVNamespace } from "./offers";

export type DomainState = {
  hostname: string;
  /** Id custom hostname w Cloudflare. */
  cfId: string;
  /** Status nazwy: pending / active / moved / … (z API Cloudflare). */
  status: string;
  /** Status certyfikatu: initializing / pending_validation / active / … */
  sslStatus: string;
  /** Błędy weryfikacji z Cloudflare (po angielsku, tak jak przychodzą). */
  errors: string[];
  createdAt: string;
  checkedAt: string;
};

const KEY = "settings:domain";
const DEFAULT_BASE = "https://api.cloudflare.com/client/v4";

export const cfConfigured = (env: Env) => !!(env.CF_API_TOKEN && env.CF_ZONE_ID && env.CF_CNAME_TARGET);

export function requireCf(env: Env) {
  if (!cfConfigured(env)) {
    throw new HttpError(
      501,
      "domain_not_configured",
      "Własne domeny nie są jeszcze włączone na serwerze (brak CF_API_TOKEN, CF_ZONE_ID albo CF_CNAME_TARGET).",
    );
  }
}

const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function cleanHostname(v: unknown, env: Env) {
  if (typeof v !== "string") throw new HttpError(400, "invalid", "Wpisz domenę, np. oferty.twojafirma.pl.");
  const host = v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!HOST_RE.test(host)) throw new HttpError(400, "invalid", "To nie wygląda na domenę. Wpisz np. oferty.twojafirma.pl.");
  if (host.split(".").length < 3) {
    throw new HttpError(400, "apex", "Użyj subdomeny (np. oferty.twojafirma.pl) – na samej domenie nie da się ustawić CNAME.");
  }
  const target = (env.CF_CNAME_TARGET ?? "").toLowerCase();
  if (target && (host === target || host.endsWith(`.${target}`))) {
    throw new HttpError(400, "invalid", "To jest adres serwera, a nie domena firmy.");
  }
  return host;
}

type CfResult = {
  id: string;
  hostname: string;
  status?: string;
  ssl?: { status?: string; validation_errors?: { message?: string }[] };
  verification_errors?: string[];
};

async function cf<T>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  const base = (env.CF_API_BASE || DEFAULT_BASE).replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/zones/${env.CF_ZONE_ID}/custom_hostnames${path}`, {
      method,
      headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new HttpError(502, "cloudflare_unreachable", "Nie udało się połączyć z API Cloudflare.");
  }
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: { code?: number; message?: string }[]; result?: T };
  if (!res.ok || !data.success) {
    const msg = data.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new HttpError(res.status === 404 ? 404 : 502, "cloudflare", `Cloudflare odrzucił żądanie: ${msg}`);
  }
  return data.result as T;
}

function toState(r: CfResult, prev?: DomainState): DomainState {
  const now = new Date().toISOString();
  return {
    hostname: r.hostname,
    cfId: r.id,
    status: r.status ?? "pending",
    sslStatus: r.ssl?.status ?? "initializing",
    errors: [
      ...(r.verification_errors ?? []),
      ...(r.ssl?.validation_errors ?? []).map((e) => e.message ?? "").filter(Boolean),
    ].slice(0, 5),
    createdAt: prev?.createdAt ?? now,
    checkedAt: now,
  };
}

export async function getDomain(kv: KVNamespace): Promise<DomainState | null> {
  const raw = await kv.get(KEY);
  return raw ? (JSON.parse(raw) as DomainState) : null;
}

export async function createDomain(env: Env, kv: KVNamespace, hostname: string) {
  const r = await cf<CfResult>(env, "POST", "", {
    hostname,
    ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
  });
  const state = toState(r);
  await kv.put(KEY, JSON.stringify(state));
  return state;
}

export async function refreshDomain(env: Env, kv: KVNamespace, prev: DomainState) {
  const r = await cf<CfResult>(env, "GET", `/${prev.cfId}`);
  const state = toState(r, prev);
  await kv.put(KEY, JSON.stringify(state));
  return state;
}

export async function deleteDomain(env: Env, kv: KVNamespace, prev: DomainState) {
  try {
    await cf(env, "DELETE", `/${prev.cfId}`);
  } catch (e) {
    // Już usunięta w Cloudflare: i tak czyścimy u siebie.
    if (!(e instanceof HttpError && e.status === 404)) throw e;
  }
  await kv.delete(KEY);
}

/** Domena działa, gdy Cloudflare potwierdził nazwę i wystawił certyfikat. */
export const isActive = (d: DomainState | null) => !!d && d.status === "active" && d.sslStatus === "active";

export const domainView = (env: Env, d: DomainState | null) => ({
  configured: cfConfigured(env),
  target: env.CF_CNAME_TARGET ?? null,
  domain: d,
  active: isActive(d),
});
