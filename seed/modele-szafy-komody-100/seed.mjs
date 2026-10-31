#!/usr/bin/env node
/**
 * Wgrywa 100 modeli (szafy, szafki, komody) do R2 i KV firmy „main”.
 * Idempotentne: drugi raz nadpisuje ten sam plik i te same oznaczenia, nie dubluje wpisów.
 * Rusza wyłącznie id z tego id-map.json (prefiks ms, numery 001–100).
 * Nie czyta, nie nadpisuje i nie kasuje mk01–mk50 ani żadnego innego modelu kuchni.
 *
 * Sprawdzenie plików (bez sieci, bez Cloudflare):
 *   node seed/modele-szafy-komody-100/seed.mjs --check
 *
 * Lokalnie, gdy działa `npx wrangler pages dev out --kv OFFERS --r2 MODELS`
 * (katalog .wrangler/state musi już istnieć — wejdź raz na stronę albo wgraj cokolwiek):
 *   node seed/modele-szafy-komody-100/seed.mjs --local
 * `wrangler r2 object put` nie przyjmuje nazwy bindingu MODELS (wielkie litery nie są
 * legalną nazwą bucketa). --local zapisuje więc wprost do magazynu miniflare,
 * którego używa pages dev: KV OFFERS i R2 MODELS w .wrangler/state.
 *
 * Produkcja (projekt Pages system-ofertowania) — dopiero po review, nie z tego PR:
 *   SEED_CONFIRM=kuchnia-modele node seed/modele-szafy-komody-100/seed.mjs --remote
 * Wymaga `npx wrangler login` albo CLOUDFLARE_API_TOKEN z prawem do KV i R2.
 * Domyślnie:
 *   R2_BUCKET=kuchnia-modele
 *   KV_NAMESPACE_ID=28b882fa9c3d416fac025765aabcba52   (kuchnia-oferty, binding OFFERS)
 * Firma main nie ma prefiksu kluczy: model:<id> oraz modelowner:<id> = main.
 * Plik: models/<id>/<wersja>.glb
 *
 * Zmienne: R2_BUCKET, KV_NAMESPACE_ID, PERSIST_TO (domyślnie .wrangler/state), WRANGLER (domyślnie npx -y wrangler@4).
 */
import { createHash, randomBytes, randomFillSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "../..");
const katalog = JSON.parse(readFileSync(path.join(root, "katalog.json"), "utf8"));
const mapa = JSON.parse(readFileSync(path.join(root, "id-map.json"), "utf8"));
const kuchniaMapa = JSON.parse(readFileSync(path.join(repo, "seed/modele-kuchnia-50/id-map.json"), "utf8"));
const kuchniaIds = new Set(kuchniaMapa.modele.map((m) => m.id));
const ROLE = new Set(["front", "blat", "uchwyt"]);
const ID_RE = /^[A-Za-z0-9]{10,32}$/;
/** mk01–mk50, łącznie z dopiskiem (mk43hokerx). Ta paczka ich nie tyka. */
const KUCHNIA_ID = /^mk(0[1-9]|[1-4]\d|50)/;
const STREFY = new Set(["dolna", "gorna", "wysoka", "blat", "polka"]);
const RODZAJE = new Set([
  "szafka",
  "szuflady",
  "narozna",
  "zlew",
  "zlewozmywak",
  "bateria",
  "zmywarka",
  "plyta-indukcja",
  "plyta-gaz",
  "piekarnik",
  "mikrofalowka",
  "okap",
  "okap-podszafkowy",
  "lodowka",
  "lodowka-zabudowa",
  "polka",
  "blat",
  "szafa",
  "szafa-przesuwna",
  "komoda",
  "regal",
  "rtv",
  "umywalka",
]);
const GRUPY = new Set(["szafy", "szafki", "komody"]);
/** Ten sam obrys co MODEL_LIMITS w src/lib/kuchnia.ts — kreator przyjmuje model GLB w tych widełkach. */
const LIM = { w: [1, 400], h: [1, 280], d: [1, 400] };

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const local = args.has("--local");
const remote = args.has("--remote");

function sameTags(a, b) {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function glbJson(buf) {
  if (buf.length < 20) fail("za krótki plik GLB");
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const length = buf.readUInt32LE(8);
  if (magic !== 0x46546c67 || version !== 2 || length !== buf.length) fail("to nie jest GLB 2.0");
  const chunkLen = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  if (chunkType !== 0x4e4f534a) fail("brak kawałka JSON");
  return JSON.parse(buf.subarray(20, 20 + chunkLen).toString("utf8"));
}

function nodeNames(json) {
  const names = new Set();
  for (const n of json.nodes ?? []) if (n.name) names.add(n.name);
  for (const n of json.meshes ?? []) if (n.name) names.add(n.name);
  return names;
}

function kolizjaZKuchnia(id) {
  return kuchniaIds.has(id) || KUCHNIA_ID.test(id) || id.startsWith("mk");
}

const poKatalogu = new Map(katalog.modele.map((m) => [m.id, m]));
if (mapa.modele.length !== 100 || katalog.modele.length !== 100) fail("katalog albo mapa nie ma 100 modeli");
if (kuchniaMapa.modele.length !== 50) fail("mapa kuchni nie ma 50 modeli — skrypt nie wie, czego nie wolno ruszyć");

const pozycje = mapa.modele.map((w, i) => {
  if (w.nr !== i + 1) fail(`numer mapy ma iść 1–100: ${w.katalogId}`);
  if (!ID_RE.test(w.id)) fail(`złe id: ${w.id}`);
  if (!w.id.startsWith(`ms${String(w.nr).padStart(3, "0")}`)) fail(`id nie ma prefiksu ms i numeru: ${w.id}`);
  if (kolizjaZKuchnia(w.id)) fail(`odmowa: ${w.id} należy do biblioteki kuchni mk01–mk50`);
  if (w.uzycie !== "modul") fail(`${w.katalogId}: ta paczka ma samo uzycie modul`);
  if (!GRUPY.has(w.grupa)) fail(`${w.katalogId}: zła grupa ${w.grupa}`);
  if (!STREFY.has(w.strefa) || !RODZAJE.has(w.rodzaj)) fail(`${w.katalogId}: zła strefa albo rodzaj`);
  const zrodlo = poKatalogu.get(w.katalogId);
  if (!zrodlo) fail(`brak w katalogu: ${w.katalogId}`);
  if (zrodlo.plik !== w.plik || zrodlo.nazwa !== w.nazwa || zrodlo.kategoria !== w.kategoria) {
    fail(`mapa rozjechała się z katalogiem: ${w.katalogId}`);
  }
  const oczekiwana =
    w.kategoria === "Szafy" ? "szafy" : w.kategoria === "Szafki" ? "szafki" : w.kategoria === "Komody" ? "komody" : "";
  if (w.grupa !== oczekiwana) fail(`${w.katalogId}: grupa nie pasuje do kategorii`);
  for (const key of ["w", "h", "d"]) {
    const [min, max] = LIM[key];
    if (!Number.isInteger(w[key]) || w[key] < min || w[key] > max) fail(`${w.katalogId}: wymiar ${key} poza obrysem modelu`);
  }
  if (w.w !== Math.round(zrodlo.szerokosc_cm) || w.h !== Math.round(zrodlo.wysokosc_cm) || w.d !== Math.round(zrodlo.glebokosc_cm)) {
    fail(`${w.katalogId}: wymiary mapy nie są zaokrągleniem katalogu`);
  }
  if (typeof w.plik !== "string" || w.plik.includes("..") || path.isAbsolute(w.plik)) fail(`${w.katalogId}: zła ścieżka`);
  if (!w.plik.startsWith("szafy-i-szafki/") && !w.plik.startsWith("komody/")) fail(`${w.katalogId}: plik spoza tej paczki`);
  const plik = path.join(root, w.plik);
  const buf = readFileSync(plik);
  const json = glbJson(buf);
  const names = nodeNames(json);
  const tags = {};
  for (const [node, role] of Object.entries(zrodlo.tags ?? {})) {
    if (!ROLE.has(role)) fail(`${w.katalogId}: zła rola ${role}`);
    if (!names.has(node)) fail(`${w.katalogId}: w GLB nie ma węzła ${node}`);
    tags[node] = role;
  }
  return { w, tags, buf, sha: createHash("sha256").update(buf).digest("hex") };
});

const idy = new Set(pozycje.map((p) => p.w.id));
if (idy.size !== 100) fail("id w mapie nie są unikalne");
for (const id of idy) {
  if (kolizjaZKuchnia(id)) fail(`odmowa: ${id} koliduje z mk01–mk50`);
}
for (const id of kuchniaIds) {
  if (idy.has(id)) fail(`odmowa: ${id} jest w bibliotece kuchni i w tej paczce`);
}

const grupy = { szafy: 0, szafki: 0, komody: 0 };
for (const p of pozycje) grupy[p.w.grupa]++;
if (grupy.szafy !== 25 || grupy.szafki !== 25 || grupy.komody !== 50) fail("oczekiwano 25 szaf, 25 szafek i 50 komód");

console.log(`OK  100/100 GLB, id zgodne z /^[A-Za-z0-9]{10,32}$/, oznaczenia węzłów zgodne z katalogiem.`);
console.log(
  `    moduły kreatora: 100 (Szafy ${grupy.szafy}, Szafki ${grupy.szafki}, Komody ${grupy.komody}). Żadne id nie należy do mk01–mk50.`,
);
if (!local && !remote) {
  if (!check) console.log("Nic nie wgrano. Dopisz --check, --local albo --remote (patrz komentarz na górze pliku).");
  process.exit(0);
}
if (local && remote) fail("Wybierz albo --local, albo --remote.");
if (remote && process.env.SEED_CONFIRM !== "kuchnia-modele") {
  fail("Produkcja wymaga SEED_CONFIRM=kuchnia-modele. Bez tego skrypt nic nie zapisuje.");
}

const bucket = process.env.R2_BUCKET || "kuchnia-modele";
const namespaceId = process.env.KV_NAMESPACE_ID || "28b882fa9c3d416fac025765aabcba52";
const persistTo = path.resolve(repo, process.env.PERSIST_TO || ".wrangler/state");
const wranglerBin = process.env.WRANGLER || "npx";
const wranglerArgs = process.env.WRANGLER ? [] : ["-y", "wrangler@4"];

function wrangler(argv) {
  return spawnSync(wranglerBin, [...wranglerArgs, ...argv, "--remote"], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function must(r, co) {
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim();
    fail(`${co} nie powiodło się (kod ${r.status}).\n${err}`);
  }
}

function assertNasze(id) {
  if (!idy.has(id) || kolizjaZKuchnia(id)) fail(`odmowa zapisu obcego id: ${id}`);
}

function assertPlikTejPaczki(file) {
  const m = /^models\/([A-Za-z0-9]{10,32})\/\d+\.glb$/.exec(file || "");
  if (!m || !idy.has(m[1]) || kolizjaZKuchnia(m[1])) fail(`odmowa usunięcia pliku spoza szaf i komód: ${file}`);
}

function sqlFile(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (files.length !== 1) return null;
  return path.join(dir, files[0]);
}

function openLocal() {
  const kvSql = sqlFile(path.join(persistTo, "v3/kv/miniflare-KVNamespaceObject"));
  const r2Sql = sqlFile(path.join(persistTo, "v3/r2/miniflare-R2BucketObject"));
  if (!kvSql || !r2Sql) {
    fail(
      "Brak lokalnego KV/R2 w " +
        persistTo +
        ". Uruchom najpierw `npx wrangler pages dev out --kv OFFERS --r2 MODELS` i wejdź raz na stronę (albo wgraj model), żeby miniflare założył magazyn.",
    );
  }
  const kv = new DatabaseSync(kvSql);
  const r2 = new DatabaseSync(r2Sql);
  kv.exec("PRAGMA busy_timeout = 5000");
  r2.exec("PRAGMA busy_timeout = 5000");
  const kvBlobs = path.join(persistTo, "v3/kv/OFFERS/blobs");
  const r2Blobs = path.join(persistTo, "v3/r2/MODELS/blobs");
  mkdirSync(kvBlobs, { recursive: true });
  mkdirSync(r2Blobs, { recursive: true });
  return { kv, r2, kvBlobs, r2Blobs };
}

function blobId() {
  const buf = Buffer.alloc(40);
  randomFillSync(buf, 0, 32);
  buf.writeBigInt64BE(BigInt(Date.now()), 32);
  return buf.toString("hex");
}

function readLocalKv(store, key) {
  const row = store.kv.prepare("SELECT blob_id FROM _mf_entries WHERE key = ?").get(key);
  if (!row) return null;
  try {
    return readFileSync(path.join(store.kvBlobs, row.blob_id), "utf8");
  } catch {
    return null;
  }
}

function writeLocalKv(store, key, value) {
  const prev = store.kv.prepare("SELECT blob_id FROM _mf_entries WHERE key = ?").get(key);
  const id = blobId();
  writeFileSync(path.join(store.kvBlobs, id), value);
  store.kv.prepare("INSERT OR REPLACE INTO _mf_entries (key, blob_id, expiration, metadata) VALUES (?, ?, NULL, NULL)").run(key, id);
  if (prev && prev.blob_id !== id) {
    try {
      unlinkSync(path.join(store.kvBlobs, prev.blob_id));
    } catch {
      /* stary blob mógł już zniknąć */
    }
  }
}

function writeLocalR2(store, key, buf) {
  const prev = store.r2.prepare("SELECT blob_id FROM _mf_objects WHERE key = ?").get(key);
  const id = blobId();
  writeFileSync(path.join(store.r2Blobs, id), buf);
  store.r2
    .prepare(
      "INSERT OR REPLACE INTO _mf_objects (key, blob_id, version, size, etag, uploaded, checksums, http_metadata, custom_metadata) VALUES (?, ?, ?, ?, ?, ?, '{}', ?, '{}')",
    )
    .run(key, id, randomBytes(16).toString("hex"), buf.length, createHash("md5").update(buf).digest("hex"), Date.now(), JSON.stringify({ contentType: "model/gltf-binary" }));
  if (prev && prev.blob_id !== id) {
    try {
      unlinkSync(path.join(store.r2Blobs, prev.blob_id));
    } catch {
      /* j.w. */
    }
  }
}

function deleteLocalR2(store, key) {
  assertPlikTejPaczki(key);
  const prev = store.r2.prepare("SELECT blob_id FROM _mf_objects WHERE key = ?").get(key);
  if (!prev) return;
  store.r2.prepare("DELETE FROM _mf_objects WHERE key = ?").run(key);
  try {
    unlinkSync(path.join(store.r2Blobs, prev.blob_id));
  } catch {
    /* plik mógł już zniknąć */
  }
}

const tmp = remote ? path.join(tmpdir(), "seed-szafy-komody-" + Date.now()) : null;
if (tmp) mkdirSync(tmp, { recursive: true });
const localStore = local ? openLocal() : null;
let zapisane = 0;
let bezZmian = 0;

function kvGet(key) {
  if (localStore) {
    const raw = readLocalKv(localStore, key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  const get = wrangler(["kv", "key", "get", key, "--namespace-id", namespaceId]);
  if (get.status !== 0 || !get.stdout.trim() || get.stdout.trim() === "Value not found") return null;
  try {
    return JSON.parse(get.stdout.trim());
  } catch {
    return get.stdout.trim();
  }
}

function kvPut(key, value) {
  if (localStore) {
    writeLocalKv(localStore, key, value);
    return;
  }
  const metaPath = path.join(tmp, key.replace(/[^A-Za-z0-9]+/g, "_") + ".txt");
  writeFileSync(metaPath, value);
  const put = wrangler(["kv", "key", "put", key, "--path", metaPath, "--namespace-id", namespaceId]);
  must(put, `KV ${key}`);
}

try {
  for (const p of pozycje) {
    const id = p.w.id;
    assertNasze(id);
    const existing = kvGet(`model:${id}`);
    const metaObj = existing && typeof existing === "object" ? existing : null;
    const tagsSame = metaObj && sameTags(metaObj.tags, p.tags);
    const plikTenSam = metaObj && metaObj.size === p.buf.length && metaObj.seedSha256 === p.sha && typeof metaObj.version === "number";
    const version = plikTenSam ? metaObj.version : typeof metaObj?.version === "number" ? metaObj.version + 1 : 1;
    const file = `models/${id}/${version}.glb`;
    const same = plikTenSam && metaObj.name === p.w.nazwa && tagsSame && metaObj.file === file;
    const owner = kvGet(`modelowner:${id}`);
    if (same && owner === "main") {
      bezZmian++;
      console.log(`=   ${id}  ${p.w.nazwa}`);
      continue;
    }
    if (localStore) writeLocalR2(localStore, file, p.buf);
    else {
      const putFile = wrangler([
        "r2",
        "object",
        "put",
        `${bucket}/${file}`,
        "--file",
        path.join(root, p.w.plik),
        "--content-type",
        "model/gltf-binary",
      ]);
      must(putFile, `R2 ${id}`);
    }
    const now = new Date().toISOString();
    const meta = {
      id,
      name: p.w.nazwa,
      size: p.buf.length,
      version,
      file,
      tags: p.tags,
      seedSha256: p.sha,
      createdAt: metaObj?.createdAt || now,
      updatedAt: now,
    };
    kvPut(`model:${id}`, JSON.stringify(meta));
    kvPut(`modelowner:${id}`, "main");
    if (metaObj?.file && metaObj.file !== file) {
      assertPlikTejPaczki(metaObj.file);
      if (localStore) deleteLocalR2(localStore, metaObj.file);
      else {
        const del = wrangler(["r2", "object", "delete", `${bucket}/${metaObj.file}`]);
        if (del.status !== 0) console.error(`(ostrzeżenie) nie usunąłem starego pliku ${metaObj.file}`);
      }
    }
    zapisane++;
    console.log(`+   ${id}  v${version}  ${p.w.nazwa}`);
  }
} finally {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  localStore?.kv.close();
  localStore?.r2.close();
}

console.log(
  `Gotowe. Zapisane: ${zapisane}, bez zmian: ${bezZmian}. ` +
    (local ? `Lokalny magazyn ${persistTo} (KV OFFERS, R2 MODELS), firma main.` : `Bucket ${bucket}, namespace ${namespaceId}, firma main.`),
);
