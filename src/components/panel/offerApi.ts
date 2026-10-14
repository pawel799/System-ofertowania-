/*
 * Klient API ofert (Cloudflare Pages Functions pod /api).
 * Panel wysyła token z nagłówkiem Authorization: Bearer <token>; token wpisuje
 * się raz w panelu i zostaje w localStorage tej przeglądarki (nigdy w kodzie).
 */
import type { Offer } from "./offers";
import type { PublicModel, ModelRole } from "../modelRoles";
import type { Palette } from "../palettes";

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

/* ---------- Modele 3D, pakiety RAL, własna domena (panel) ---------- */

export type ModelMeta = {
  id: string;
  name: string;
  size: number;
  version: number;
  tags: Record<string, ModelRole>;
  createdAt: string;
  updatedAt: string;
};

export const modelUrl = (m: Pick<ModelMeta, "id" | "version">) => `/api/models/${m.id}/file?v=${m.version}`;
export const toPublicModel = (m: ModelMeta): PublicModel => ({ id: m.id, name: m.name, url: modelUrl(m), tags: m.tags });

export type DomainState = {
  hostname: string;
  status: string;
  sslStatus: string;
  errors: string[];
  createdAt: string;
  checkedAt: string;
};

export type DomainView = { configured: boolean; target: string | null; domain: DomainState | null; active: boolean };

/** Wysyłka pliku modelu (GLB) z postępem – fetch nie raportuje postępu wysyłania, więc XHR. */
function uploadGlb(glb: Uint8Array, name: string, onProgress?: (part: number) => void): Promise<ModelMeta> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/models");
    xhr.setRequestHeader("authorization", `Bearer ${getToken()}`);
    xhr.setRequestHeader("content-type", "model/gltf-binary");
    xhr.setRequestHeader("x-model-name", encodeURIComponent(name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError(0, "network", "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie."));
    xhr.onload = () => {
      let data: { model?: ModelMeta; error?: string; message?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        return reject(new ApiError(xhr.status, "no_api", "Serwer nie ma API modeli (np. zwykły next dev bez wrangler pages dev)."));
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.model) resolve(data.model);
      else reject(new ApiError(xhr.status, data.error ?? "error", data.message ?? `Błąd serwera (${xhr.status}).`));
    };
    xhr.send(new Blob([new Uint8Array(glb)], { type: "model/gltf-binary" }));
  });
}

export const assetsApi = {
  models: () => call<{ models: ModelMeta[] }>("GET", "/api/models", { headers: auth() }).then((r) => r.models),
  uploadModel: uploadGlb,
  updateModel: (id: string, patch: { name?: string; tags?: Record<string, ModelRole> }) =>
    call<{ model: ModelMeta }>("PUT", `/api/models/${id}`, { body: patch, headers: auth() }).then((r) => r.model),
  removeModel: (id: string) => call<void>("DELETE", `/api/models/${id}`, { headers: auth() }),

  palettes: () => call<{ palettes: Palette[] }>("GET", "/api/palettes", { headers: auth() }).then((r) => r.palettes),
  createPalette: (p: Omit<Palette, "id">) =>
    call<{ palette: Palette }>("POST", "/api/palettes", { body: p, headers: auth() }).then((r) => r.palette),
  updatePalette: (p: Palette) =>
    call<{ palette: Palette }>("PUT", `/api/palettes/${p.id}`, { body: p, headers: auth() }).then((r) => r.palette),
  removePalette: (id: string) => call<void>("DELETE", `/api/palettes/${id}`, { headers: auth() }),

  domain: () => call<DomainView>("GET", "/api/settings/domain", { headers: auth() }),
  setDomain: (hostname: string) => call<DomainView>("PUT", "/api/settings/domain", { body: { hostname }, headers: auth() }),
  refreshDomain: () => call<DomainView>("POST", "/api/settings/domain/refresh", { headers: auth() }),
  removeDomain: () => call<void>("DELETE", "/api/settings/domain", { headers: auth() }),
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
  /** Wgrany model 3D; null = kuchnia demo. */
  model?: PublicModel | null;
  /** Pakiety RAL studia (fronty do wyboru). */
  palettes?: Palette[];
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
