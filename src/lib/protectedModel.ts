/*
 * Model kuchni ze strony jest zaszyfrowany (public/models/kitchen.enc, patrz scripts/szyfruj-model.mjs).
 * Tu: pobranie pliku z postępem, klucz z /api/model-key, odszyfrowanie w pamięci (WebCrypto)
 * i adres blob: dla loadera GLTF. Pobieranie i odszyfrowanie dzieje się raz na wizytę.
 *
 * useKitchenModelUrl() działa z <Suspense>: rzuca obietnicą, dopóki model nie jest gotowy.
 */

const ENC_URL = "/models/kitchen.enc";
const KEY_URL = "/api/model-key";
/** Rozmiar pliku do paska postępu, gdy serwer nie poda content-length. */
const BYTES_FALLBACK = 7_980_000;

let progress = 0;
const listeners = new Set<() => void>();
const emit = (v: number) => {
  progress = v;
  listeners.forEach((l) => l());
};
export const getModelProgress = () => progress;
export function subscribeModelProgress(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok || !res.body) throw new Error(`Nie udało się pobrać modelu (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || BYTES_FALLBACK;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    emit(Math.min(0.99, loaded / total));
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function load(): Promise<string> {
  const [file, keyRes] = await Promise.all([
    download(ENC_URL),
    fetch(KEY_URL, { cache: "no-store", credentials: "same-origin" }),
  ]);
  if (!keyRes.ok) throw new Error(`Brak klucza modelu (${keyRes.status}).`);
  const { key } = (await keyRes.json()) as { key: string };
  const raw = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const glb = await crypto.subtle.decrypt({ name: "AES-GCM", iv: file.slice(0, 12) }, cryptoKey, file.slice(12));
  emit(1);
  return URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
}

let promise: Promise<string> | null = null;
let url: string | null = null;
let error: unknown = null;

/** Zaczyna pobieranie (np. gdy sekcja z modelem zbliża się do ekranu). */
export function preloadKitchenModel() {
  if (!promise) {
    promise = load().then(
      (u) => (url = u),
      (e) => {
        error = e;
        throw e;
      },
    );
    promise.catch(() => undefined);
  }
  return promise;
}

/** Adres blob: odszyfrowanego modelu – z <Suspense> (rzuca obietnicą albo błędem). */
export function useKitchenModelUrl(): string {
  if (url) return url;
  if (error) throw error;
  throw preloadKitchenModel();
}
