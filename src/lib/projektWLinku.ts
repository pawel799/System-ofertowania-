/*
 * Projekt kreatora zapisany w linku – dla testu kreatora bez konta (/kreator).
 * Dane są w części adresu po "#", której przeglądarka nie wysyła do serwera, więc projekt
 * nie trafia na nasz serwer. JSON jest kompresowany (deflate-raw) i zapisany w base64url.
 * Przy odczycie wszystko trzeba sprawdzić (link mógł zmienić ktokolwiek): plan przez
 * parseKuchnia, typ przez parseTypProjektu, materiały z listy dozwolonych identyfikatorów.
 */

export type ProjektWLinku = {
  v: 1;
  typ: string;
  title: string;
  plan: unknown;
  front: string;
  countertop: string;
  hardware: string;
};

const PREFIX = "#projekt=";
/** Górna granica długości (bajty po kompresji): dłuższy link i tak nie przejdzie przez komunikatory. */
const MAX_LEN = 60_000;

const toB64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function przez(stream: CompressionStream | DecompressionStream, data: Uint8Array) {
  const res = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Hash adresu (#projekt=…) z projektem. */
export async function projektDoLinku(p: Omit<ProjektWLinku, "v">): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, ...p }));
  if (typeof CompressionStream === "undefined") return `${PREFIX}j.${toB64(json)}`;
  return `${PREFIX}${toB64(await przez(new CompressionStream("deflate-raw"), json))}`;
}

/** Projekt z hasha albo null (brak, uszkodzony, za duży). Treść nadal trzeba sprawdzić. */
export async function projektZLinku(hash: string): Promise<ProjektWLinku | null> {
  if (!hash.startsWith(PREFIX)) return null;
  const raw = hash.slice(PREFIX.length);
  if (!raw || raw.length > MAX_LEN || !/^(j\.)?[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = raw.startsWith("j.")
      ? fromB64(raw.slice(2))
      : await przez(new DecompressionStream("deflate-raw"), fromB64(raw));
    if (bytes.length > 2_000_000) return null;
    const o = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ProjektWLinku>;
    if (!o || o.v !== 1 || typeof o.typ !== "string" || typeof o.plan !== "object" || o.plan === null) return null;
    return {
      v: 1,
      typ: o.typ,
      title: typeof o.title === "string" ? o.title.slice(0, 200) : "",
      plan: o.plan,
      front: typeof o.front === "string" ? o.front : "",
      countertop: typeof o.countertop === "string" ? o.countertop : "",
      hardware: typeof o.hardware === "string" ? o.hardware : "",
    };
  } catch {
    return null;
  }
}
