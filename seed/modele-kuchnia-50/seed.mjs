#!/usr/bin/env node
/**
 * Wgrywa 50 modeli kuchennych do R2 i KV firmy „main”.
 * Idempotentne: drugi raz nadpisuje ten sam plik i te same oznaczenia, nie dubluje wpisów.
 * Nie rusza modeli, których id nie ma w id-map.json.
 *
 * Sprawdzenie plików (bez sieci, bez Cloudflare):
 *   node seed/modele-kuchnia-50/seed.mjs --check
 *
 * Lokalnie, pod `npx wrangler pages dev out --kv OFFERS --r2 MODELS`
 * (najpierw uruchom pages dev, żeby powstał katalog .wrangler/state):
 *   node seed/modele-kuchnia-50/seed.mjs --local
 * Lokalny bucket to nazwa bindingu MODELS, nie produkcyjna nazwa kuchnia-modele.
 * Lokalny namespace KV to OFFERS (binding z `--kv OFFERS`).
 *
 * Produkcja (projekt Pages system-ofertowania) — dopiero po review, nie z tego PR:
 *   SEED_CONFIRM=kuchnia-modele node seed/modele-kuchnia-50/seed.mjs --remote
 * Wymaga `npx wrangler login` albo CLOUDFLARE_API_TOKEN z prawem do KV i R2.
 * Domyślnie:
 *   R2_BUCKET=kuchnia-modele
 *   KV_NAMESPACE_ID=28b882fa9c3d416fac025765aabcba52   (kuchnia-oferty, binding OFFERS)
 * Firma main nie ma prefiksu kluczy: model:<id> oraz modelowner:<id> = main.
 * Plik: models/<id>/<wersja>.glb
 *
 * Zmienne: R2_BUCKET, KV_NAMESPACE_ID, PERSIST_TO (domyślnie .wrangler/state), WRANGLER (domyślnie npx -y wrangler@4).
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "../..");
const katalog = JSON.parse(readFileSync(path.join(root, "katalog.json"), "utf8"));
const mapa = JSON.parse(readFileSync(path.join(root, "id-map.json"), "utf8"));
const ROLE = new Set(["front", "blat", "uchwyt"]);
const ID_RE = /^[A-Za-z0-9]{10,32}$/;

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

const poKatalogu = new Map(katalog.modele.map((m) => [m.id, m]));
if (mapa.modele.length !== 50 || katalog.modele.length !== 50) fail("katalog albo mapa nie ma 50 modeli");

const pozycje = mapa.modele.map((w) => {
  if (!ID_RE.test(w.id)) fail(`złe id: ${w.id}`);
  const zrodlo = poKatalogu.get(w.katalogId);
  if (!zrodlo) fail(`brak w katalogu: ${w.katalogId}`);
  if (zrodlo.nr !== w.nr) fail(`numer się rozjechał: ${w.katalogId}`);
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
if (idy.size !== 50) fail("id w mapie nie są unikalne");

console.log(`OK  50 GLB, id zgodne z /^[A-Za-z0-9]{10,32}$/, oznaczenia węzłów zgodne z katalogiem.`);
console.log(`    moduły kreatora: ${pozycje.filter((p) => p.w.uzycie === "modul").length}, gotowe kuchnie: ${pozycje.filter((p) => p.w.uzycie === "kuchnia").length}`);
if (!local && !remote) {
  if (!check) console.log("Nic nie wgrano. Dopisz --check, --local albo --remote (patrz komentarz na górze pliku).");
  process.exit(0);
}
if (local && remote) fail("Wybierz albo --local, albo --remote.");
if (remote && process.env.SEED_CONFIRM !== "kuchnia-modele") {
  fail("Produkcja wymaga SEED_CONFIRM=kuchnia-modele. Bez tego skrypt nic nie zapisuje.");
}

const bucket = process.env.R2_BUCKET || (remote ? "kuchnia-modele" : "MODELS");
const namespaceId = process.env.KV_NAMESPACE_ID || (remote ? "28b882fa9c3d416fac025765aabcba52" : "OFFERS");
const persistTo = path.resolve(repo, process.env.PERSIST_TO || ".wrangler/state");
const wranglerBin = process.env.WRANGLER || "npx";
const wranglerArgs = process.env.WRANGLER ? [] : ["-y", "wrangler@4"];

function wrangler(argv, { input } = {}) {
  const flags = remote ? ["--remote"] : ["--local", "--persist-to", persistTo];
  const r = spawnSync(wranglerBin, [...wranglerArgs, ...argv, ...flags], {
    cwd: repo,
    encoding: "utf8",
    input,
    maxBuffer: 8 * 1024 * 1024,
  });
  return r;
}

function must(r, co) {
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim();
    fail(`${co} nie powiodło się (kod ${r.status}).\n${err}`);
  }
}

const tmp = mkdtempSync(path.join(tmpdir(), "seed-modele-"));
let zapisane = 0;
let bezZmian = 0;

try {
  for (const p of pozycje) {
    const id = p.w.id;
    const get = wrangler(["kv", "key", "get", `model:${id}`, "--namespace-id", namespaceId]);
    let existing = null;
    if (get.status === 0 && get.stdout.trim()) {
      try {
        existing = JSON.parse(get.stdout.trim());
      } catch {
        existing = null;
      }
    }
    const tagsSame = existing && sameTags(existing.tags, p.tags);
    const plikTenSam =
      existing && existing.size === p.buf.length && existing.seedSha256 === p.sha && typeof existing.version === "number";
    const version = plikTenSam ? existing.version : typeof existing?.version === "number" ? existing.version + 1 : 1;
    const file = `models/${id}/${version}.glb`;
    const same = plikTenSam && existing.name === p.w.nazwa && tagsSame && existing.file === file;
    if (same) {
      const owner = wrangler(["kv", "key", "get", `modelowner:${id}`, "--namespace-id", namespaceId]);
      if (owner.status !== 0 || owner.stdout.trim() !== "main") {
        const putOwner = wrangler(["kv", "key", "put", `modelowner:${id}`, "main", "--namespace-id", namespaceId]);
        must(putOwner, `modelowner ${id}`);
      }
      bezZmian++;
      console.log(`=   ${id}  ${p.w.nazwa}`);
      continue;
    }
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
    const now = new Date().toISOString();
    const meta = {
      id,
      name: p.w.nazwa,
      size: p.buf.length,
      version,
      file,
      tags: p.tags,
      seedSha256: p.sha,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const metaPath = path.join(tmp, `${id}.json`);
    writeFileSync(metaPath, JSON.stringify(meta));
    const putMeta = wrangler(["kv", "key", "put", `model:${id}`, "--path", metaPath, "--namespace-id", namespaceId]);
    must(putMeta, `KV model:${id}`);
    const putOwner = wrangler(["kv", "key", "put", `modelowner:${id}`, "main", "--namespace-id", namespaceId]);
    must(putOwner, `modelowner ${id}`);
    if (existing?.file && existing.file !== file) {
      const del = wrangler(["r2", "object", "delete", `${bucket}/${existing.file}`]);
      if (del.status !== 0) console.error(`(ostrzeżenie) nie usunąłem starego pliku ${existing.file}`);
    }
    zapisane++;
    console.log(`+   ${id}  v${version}  ${p.w.nazwa}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Gotowe. Zapisane: ${zapisane}, bez zmian: ${bezZmian}. Bucket ${bucket}, namespace ${namespaceId}, firma main.`);
