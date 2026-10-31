import type { TypProjektu } from "@/lib/projekt";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { KatalogPozycja, MaterialySnapshot } from "../katalogFirmy";
import type { ModulCennik, ModulItem } from "@/lib/modul";
/*
 * Klient API ofert (Cloudflare Pages Functions pod /api).
 * Logowanie do panelu:
 *  - konto firmy (e-mail + hasło): sesja w ciasteczku HttpOnly, przeglądarka dołącza je sama;
 *    w localStorage zostaje tylko znacznik „zalogowano”, żeby nie migało okno logowania,
 *  - kod administratora (PANEL_TOKEN): nagłówek Authorization: Bearer <kod>, kod w localStorage.
 */
import type { Offer } from "./offers";
import type { PublicModel, ModelRole } from "../modelRoles";
import type { Palette } from "../palettes";
import type { PlanId, PlanInfo } from "@/lib/plans";

export const TOKEN_KEY = "studio-kuchnie:panel-token";
const SESSION_KEY = "studio-kuchnie:panel-sesja";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    /** Cała odpowiedź błędu (np. marka firmy na ekranie PIN-u). */
    public data?: Record<string, unknown>,
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

function setSessionFlag(on: boolean) {
  try {
    if (on) window.localStorage.setItem(SESSION_KEY, "1");
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Tryb prywatny: bez znacznika panel po prostu raz zapyta serwer.
  }
}

/** Czy w tej przeglądarce ktoś się logował (konto firmy albo kod administratora). */
export function hasLogin() {
  try {
    return !!getToken() || window.localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Zapomina logowanie w tej przeglądarce (po 401 albo wylogowaniu). */
export function forgetLogin() {
  setToken("");
  setSessionFlag(false);
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
  if (!res.ok) throw new ApiError(res.status, data.error ?? "error", data.message ?? `Błąd serwera (${res.status}).`, data);
  return data as T;
}

/** Nagłówek z kodem administratora (tylko gdy jest); konto firmy używa ciasteczka sesji. */
export const panelAuth = (): Record<string, string> => {
  const t = getToken();
  return t ? { authorization: `Bearer ${t}` } : {};
};
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
    if (getToken()) xhr.setRequestHeader("authorization", `Bearer ${getToken()}`);
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

  katalog: () => call<{ katalog: KatalogPozycja[] }>("GET", "/api/katalog", { headers: auth() }).then((r) => r.katalog),
  createKatalog: (p: Omit<KatalogPozycja, "id">) =>
    call<{ pozycja: KatalogPozycja }>("POST", "/api/katalog", { body: p, headers: auth() }).then((r) => r.pozycja),
  updateKatalog: (p: KatalogPozycja) =>
    call<{ pozycja: KatalogPozycja }>("PUT", `/api/katalog/${p.id}`, { body: p, headers: auth() }).then((r) => r.pozycja),
  removeKatalog: (id: string) => call<void>("DELETE", `/api/katalog/${id}`, { headers: auth() }),

  domain: () => call<DomainView>("GET", "/api/settings/domain", { headers: auth() }),
  setDomain: (hostname: string) => call<DomainView>("PUT", "/api/settings/domain", { body: { hostname }, headers: auth() }),
  refreshDomain: () => call<DomainView>("POST", "/api/settings/domain/refresh", { headers: auth() }),
  removeDomain: () => call<void>("DELETE", "/api/settings/domain", { headers: auth() }),
};

/* ---------- Zgłoszenia z formularzy (wycena, pomiar, kontakt) ---------- */

export type Zgloszenie = {
  id: string;
  typ: "wycena" | "pomiar" | "kontakt";
  imie: string;
  telefon?: string;
  email?: string;
  firma?: string;
  uwagi?: string;
  oferta?: string;
  wybor?: string;
  utworzono: string;
  /** Data oznaczenia jako obsłużone; null/brak = nowe. */
  obsluzone?: string | null;
  /** "osadzenie" = z widżetu kuchni 3D na stronie firmy. */
  zrodlo?: string;
};

export const requestsApi = {
  list: () => call<{ items: Zgloszenie[] }>("GET", "/api/zapytania", { headers: auth() }).then((r) => r.items),
  setDone: (id: string, obsluzone: boolean) =>
    call<{ item: Zgloszenie }>("PATCH", `/api/zapytania/${encodeURIComponent(id)}`, { body: { obsluzone }, headers: auth() }).then(
      (r) => r.item,
    ),
  remove: (id: string) => call<void>("DELETE", `/api/zapytania/${encodeURIComponent(id)}`, { headers: auth() }),
};

/* ---------- Marka firmy (nazwa i logo) ---------- */

export type BrandSettings = { name: string; logo: string | null };

export const brandApi = {
  get: () => call<{ brand: BrandSettings | null }>("GET", "/api/settings/brand", { headers: auth() }).then((r) => r.brand),
  save: (b: BrandSettings) => call<{ brand: BrandSettings }>("PUT", "/api/settings/brand", { body: b, headers: auth() }).then((r) => r.brand),
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
  /** Moduły na wymiar; cena tylko przy widocznej cenie. */
  moduly?: (ModulItem & { cena?: number })[];
  /** Układ z kreatora. Brak = dotychczasowa kuchnia demo albo jeden model. */
  kuchnia?: PlanKuchni;
  /** Modele wstawione w kreatorze (nie cały katalog firmy). */
  modele?: PublicModel[];
  /** Dodatki do ceny (są już w base) – tylko przy widocznej cenie. */
  dodatki?: { nazwa: string; kwota: number }[];
  /** Co projektujemy (kuchnia, szafa…); brak = kuchnia. Teksty na stronie klienta. */
  projekt?: TypProjektu;
  /** Pakiety RAL studia (fronty do wyboru). */
  palettes?: Palette[];
  /** Katalog materiałów firmy (aktywne pozycje i wybrane w ofercie). */
  katalog?: KatalogPozycja[];
  /** Nazwy i dopłaty materiałów z chwili zapisu oferty. */
  materialy?: MaterialySnapshot;
  /** Nazwa i logo firmy, która wysłała ofertę. */
  brand?: BrandSettings | null;
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

/* ---------- Konta firm: logowanie, rejestracja, zespół ---------- */

export type Role = "owner" | "member" | "admin";
export type FirmInfo = {
  id: string;
  name: string;
  nip: string;
  plan: PlanId;
  status: "trial" | "active" | "suspended";
  trialEnds: string | null;
  paidUntil: string | null;
  planRequest?: { plan: PlanId; period: "month" | "year"; at: string; by: string } | null;
  createdAt: string;
};
export type UserInfo = { email: string; name: string; role: "owner" | "member"; createdAt: string; lastLogin: string | null };
export type Me = { role: Role; user: UserInfo | null; firm: FirmInfo | null };

export const authApi = {
  login: async (email: string, haslo: string, turnstile = "") => {
    const r = await call<{ user: UserInfo; firm: FirmInfo }>("POST", "/api/auth/login", { body: { email, haslo, turnstile } });
    setToken("");
    setSessionFlag(true);
    return r;
  },
  /** Kod administratora: zapis w przeglądarce i sprawdzenie na serwerze. */
  loginWithCode: async (code: string) => {
    setToken(code.trim());
    try {
      return await call<Me>("GET", "/api/auth/me", { headers: panelAuth() });
    } catch (e) {
      setToken("");
      throw e;
    }
  },
  register: async (data: { firma: string; nip: string; imie: string; email: string; haslo: string; plan?: string; zgoda: boolean; turnstile?: string }) => {
    const r = await call<{ user: UserInfo; firm: FirmInfo }>("POST", "/api/auth/register", { body: data });
    setToken("");
    setSessionFlag(true);
    return r;
  },
  logout: async () => {
    forgetLogin();
    await call<void>("POST", "/api/auth/logout").catch(() => {});
  },
  me: () => call<Me>("GET", "/api/auth/me", { headers: panelAuth() }),
  changePassword: (obecne: string, nowe: string) => call<{ ok: true }>("POST", "/api/auth/password", { body: { obecne, nowe } }),
  requestReset: (email: string) => call<{ ok: true; mail: boolean }>("POST", "/api/auth/reset", { body: { email } }),
  confirmReset: (token: string, haslo: string) => call<{ ok: true }>("POST", "/api/auth/reset/confirm", { body: { token, haslo } }),
};

export const teamApi = {
  list: () => call<{ users: UserInfo[] }>("GET", "/api/team", { headers: panelAuth() }).then((r) => r.users),
  add: (u: { email: string; imie: string; haslo: string }) =>
    call<{ user: UserInfo }>("POST", "/api/team", { body: u, headers: panelAuth() }).then((r) => r.user),
  setPassword: (email: string, haslo: string) =>
    call<{ user: UserInfo }>("PATCH", `/api/team/${encodeURIComponent(email)}`, { body: { haslo }, headers: panelAuth() }),
  remove: (email: string) => call<void>("DELETE", `/api/team/${encodeURIComponent(email)}`, { headers: panelAuth() }),
};

export type AdminFirm = FirmInfo & { users: string[] };

export const adminApi = {
  firms: () => call<{ firms: AdminFirm[] }>("GET", "/api/admin/firms", { headers: panelAuth() }).then((r) => r.firms),
  updateFirm: (id: string, patch: Partial<Pick<FirmInfo, "plan" | "status" | "trialEnds" | "paidUntil">>) =>
    call<{ firm: FirmInfo }>("PUT", `/api/admin/firms/${encodeURIComponent(id)}`, { body: patch, headers: panelAuth() }).then((r) => r.firm),
};

/* ---------- Plan i płatności ---------- */

export type BillingView = {
  firm: FirmInfo | null;
  plan: PlanInfo | null;
  plans: Record<PlanId, PlanInfo>;
  expired?: boolean;
  /** Dni do końca okresu próbnego albo opłaconego okresu (ujemne = po terminie). */
  daysLeft?: number | null;
  usage?: { users: number; activeOffers: number; offers: number; models: number; katalog?: number };
  /** Działają płatności online (operator skonfigurowany). */
  online?: boolean;
};

export const billingApi = {
  get: () => call<BillingView>("GET", "/api/billing", { headers: panelAuth() }),
  request: (plan: PlanId, period: "month" | "year") =>
    call<{ firm: FirmInfo }>("POST", "/api/billing/request", { body: { plan, period }, headers: panelAuth() }).then((r) => r.firm),
  checkout: (plan: PlanId, period: "month" | "year") =>
    call<{ url: string }>("POST", "/api/billing/checkout", { body: { plan, period }, headers: panelAuth() }).then((r) => r.url),
};

/* ---------- Kuchnia 3D na stronie firmy (kod osadzenia) ---------- */

export type EmbedSettings = {
  enabled: boolean;
  title: string;
  modelId: string | null;
  base: number;
  showPrice: boolean;
  moduly: boolean;
  front: string;
  countertop: string;
  hardware: string;
};

export type EmbedView = { embed: EmbedSettings; allowed: boolean; firmId: string };

export const cennikApi = {
  get: () => call<{ cennik: ModulCennik }>("GET", "/api/settings/cennik", { headers: panelAuth() }).then((r) => r.cennik),
  save: (c: ModulCennik) =>
    call<{ cennik: ModulCennik }>("PUT", "/api/settings/cennik", { body: c, headers: panelAuth() }).then((r) => r.cennik),
};

export const embedApi = {
  get: () => call<EmbedView>("GET", "/api/settings/embed", { headers: panelAuth() }),
  save: (e: EmbedSettings) => call<EmbedView>("PUT", "/api/settings/embed", { body: e, headers: panelAuth() }),
};

export type PublicEmbed = {
  title: string;
  showPrice: boolean;
  base?: number;
  front: string;
  countertop: string;
  hardware: string;
  model: PublicModel | null;
  moduly?: boolean;
  cennik?: ModulCennik;
  palettes: Palette[];
  katalog?: KatalogPozycja[];
  brand: BrandSettings | null;
};

export const publicEmbedApi = {
  get: (firmId: string) => call<{ embed: PublicEmbed }>("GET", `/api/osadz/${encodeURIComponent(firmId)}`).then((r) => r.embed),
};
