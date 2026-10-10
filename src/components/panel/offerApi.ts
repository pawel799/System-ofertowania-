/*
 * Klient API ofert (Cloudflare Pages Functions pod /api).
 * Panel wysyła token z nagłówkiem Authorization: Bearer <token>; token wpisuje
 * się raz w panelu i zostaje w localStorage tej przeglądarki (nigdy w kodzie).
 */
import type { Offer } from "./offers";

export const TOKEN_KEY = "studio-kuchnie:panel-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Tryb prywatny: token działa do zamknięcia karty.
  }
}

/** Klucz oferty w adresie API: numer oferty bez "/" (KUCH-2026/12 -> KUCH-2026_12). */
export const offerKey = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, "_");

async function call<T>(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      cache: "no-store",
      headers: {
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.");
  }
  if (res.status === 204) return undefined as T;
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  if (!isJson) {
    throw new ApiError(res.status, "no_api", "Serwer nie ma API ofert (np. zwykły next dev bez wrangler pages dev).");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "error", data.message ?? `Błąd serwera (${res.status}).`);
  return data as T;
}

/** Nagłówek z tokenem panelu (oferty, wyszukiwanie firmy po NIP). */
export const panelAuth = () => ({ authorization: `Bearer ${getToken()}` });
const auth = panelAuth;

export const panelApi = {
  list: () => call<{ offers: Offer[] }>("GET", "/api/offers", { headers: auth() }).then((r) => r.offers),
  create: (o: Offer) => call<{ offer: Offer }>("POST", "/api/offers", { body: o, headers: auth() }).then((r) => r.offer),
  update: (o: Offer) =>
    call<{ offer: Offer }>("PUT", `/api/offers/${offerKey(o.id)}`, { body: o, headers: auth() }).then((r) => r.offer),
  remove: (id: string) => call<void>("DELETE", `/api/offers/${offerKey(id)}`, { headers: auth() }),
};

/* ---------- Strona klienta ---------- */

export type PublicOffer = {
  id: string;
  title: string;
  /** Imię i nazwisko (albo osoba kontaktowa firmy) do "Oferta dla: …". */
  who: string;
  front: string;
  countertop: string;
  hardware: string;
  showPrice: boolean;
  comments: boolean;
  base?: number;
  expires: string;
};

const pinHeader = (pin?: string): Record<string, string> => (pin ? { "x-offer-pin": pin } : {});

export const publicApi = {
  get: (slug: string, pin?: string) =>
    call<{ offer: PublicOffer }>("GET", `/api/public/${encodeURIComponent(slug)}`, { headers: pinHeader(pin) }).then(
      (r) => r.offer,
    ),
  open: (slug: string, pin?: string) =>
    call<void>("POST", `/api/public/${encodeURIComponent(slug)}/open`, { headers: pinHeader(pin) }),
  /** Uwagi klienta do projektu (+ materiały wybrane w podglądzie). */
  comment: (slug: string, text: string, choice: { front: string; countertop: string; hardware: string }, pin?: string) =>
    call<{ ok: true }>("POST", `/api/public/${encodeURIComponent(slug)}/comment`, {
      body: { text, choice },
      headers: pinHeader(pin),
    }),
};
