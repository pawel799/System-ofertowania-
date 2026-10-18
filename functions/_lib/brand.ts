/*
 * Marka firmy (panel → Ustawienia → Firma): nazwa i logo pokazywane w ofercie, w panelu
 * i w podglądzie maila. KV: settings:brand -> { name, logo } (logo jako data URL, max ~200 KB).
 */
import type { KVNamespace } from "./offers";

export type Brand = { name: string; logo: string | null; updatedAt?: string };

export const BRAND_KEY = "settings:brand";
export const LOGO_MAX_BYTES = 200 * 1024;
export const LOGO_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

export async function getBrand(kv: KVNamespace): Promise<Brand | null> {
  const raw = await kv.get(BRAND_KEY).catch(() => null);
  return raw ? (JSON.parse(raw) as Brand) : null;
}
