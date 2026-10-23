/*
 * Kod osadzenia: kuchnia 3D firmy na jej własnej stronie (iframe /osadz?f=<firmId>).
 * Klient obraca kuchnię, zmienia materiały, widzi cenę i wysyła „Poproś o wycenę” –
 * zgłoszenie trafia do panelu tej firmy (Zgłoszenia).
 *
 * KV (przestrzeń firmy): settings:embed -> EmbedSettings (JSON)
 * Widżet działa, gdy jest włączony, plan go obejmuje (Pracownia, Producent) i plan nie wygasł.
 */
import { COUNTERTOP_IDS, FRONT_IDS, HARDWARE_IDS, HttpError, store, type Env, type KVNamespace } from "./offers";
import { RAL_FRONT_RE } from "../../src/components/palettes";
import { PLANS } from "../../src/lib/plans";
import { getModel } from "./assets";
import { firmExpired, getFirm, MAIN_FIRM, scoped, type Firm, type ScopedKV } from "./tenant";

export const EMBED_KEY = "settings:embed";

export type EmbedSettings = {
  enabled: boolean;
  /** Tytuł nad kuchnią, np. „Kuchnia w stylu skandynawskim”. */
  title: string;
  /** Model 3D firmy; null = kuchnia demo. */
  modelId: string | null;
  /** Cena bazowa zabudowy (zł netto) – od niej liczy się szacunek przy zmianie materiałów. */
  base: number;
  showPrice: boolean;
  front: string;
  countertop: string;
  hardware: string;
  updatedAt?: string;
};

export const DEFAULT_EMBED: EmbedSettings = {
  enabled: false,
  title: "Zaprojektuj swoją kuchnię",
  modelId: null,
  base: 24_900,
  showPrice: true,
  front: "dab-naturalny",
  countertop: "kwarcyt-calacatta",
  hardware: "mosiadz",
};

export async function getEmbed(kv: KVNamespace): Promise<EmbedSettings> {
  const raw = await kv.get(EMBED_KEY);
  return raw ? { ...DEFAULT_EMBED, ...(JSON.parse(raw) as EmbedSettings) } : DEFAULT_EMBED;
}

const bad = (m: string) => new HttpError(400, "invalid", m);

export async function validateEmbed(kv: KVNamespace, v: unknown): Promise<EmbedSettings> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw bad("Oczekiwano obiektu.");
  const b = v as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.replace(/\s+/g, " ").trim() : "";
  if (!title || title.length > 120) throw bad("Wpisz tytuł (do 120 znaków).");
  if (typeof b.base !== "number" || !Number.isFinite(b.base) || b.base <= 0 || b.base > 10_000_000) {
    throw bad("Cena bazowa musi być liczbą od 1 do 10 000 000.");
  }
  let modelId: string | null = null;
  if (typeof b.modelId === "string" && b.modelId) {
    if (!(await getModel(kv, b.modelId))) throw bad("Wybrany model 3D nie istnieje.");
    modelId = b.modelId;
  }
  const front = typeof b.front === "string" && (FRONT_IDS.includes(b.front) || RAL_FRONT_RE.test(b.front)) ? b.front : DEFAULT_EMBED.front;
  const countertop = typeof b.countertop === "string" && COUNTERTOP_IDS.includes(b.countertop) ? b.countertop : DEFAULT_EMBED.countertop;
  const hardware = typeof b.hardware === "string" && HARDWARE_IDS.includes(b.hardware) ? b.hardware : DEFAULT_EMBED.hardware;
  return {
    enabled: b.enabled === true,
    title,
    modelId,
    base: Math.round(b.base),
    showPrice: b.showPrice !== false,
    front,
    countertop,
    hardware,
    updatedAt: new Date().toISOString(),
  };
}

/** Czy plan firmy obejmuje osadzanie i nie wygasł. */
export const embedAllowed = (firm: Firm | null) => !firm || (PLANS[firm.plan]?.limits.embed && !firmExpired(firm));

/**
 * Widżet firmy dla strony publicznej: firma istnieje, nie jest zawieszona, plan obejmuje osadzanie,
 * widżet jest włączony. Inaczej 404 (strona pokazuje „Widżet jest wyłączony”).
 */
export async function resolveEmbed(env: Env, firmId: string): Promise<{ kv: ScopedKV; firm: Firm | null; embed: EmbedSettings }> {
  const off = new HttpError(404, "embed_off", "Ta kuchnia 3D nie jest teraz dostępna.");
  const root = store(env);
  let firm: Firm | null = null;
  if (firmId !== MAIN_FIRM) {
    firm = await getFirm(root, firmId);
    if (!firm || firm.status === "suspended") throw off;
  }
  if (!embedAllowed(firm)) throw off;
  const kv = scoped(root, firmId);
  const embed = await getEmbed(kv);
  if (!embed.enabled) throw off;
  return { kv, firm, embed };
}
