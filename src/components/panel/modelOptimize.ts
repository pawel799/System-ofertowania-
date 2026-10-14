/*
 * Przygotowanie modelu 3D w przeglądarce, zanim trafi na serwer (serwer nie mieli plików):
 *   1. GLB wczytujemy wprost; OBJ (np. z PRO100, opcjonalnie z MTL i teksturami) zamieniamy na GLB.
 *   2. Każdy element dostaje unikalną nazwę bez znaków specjalnych – po niej zapisujemy
 *      oznaczenia (front / blat / uchwyt), a three.js czyta ją z pliku bez zmian.
 *   3. Optymalizacja (gltf-transform): duplikaty, nieużywane dane, sklejenie wierzchołków,
 *      tekstury max 2048 px, kompresja geometrii meshopt.
 * Plik z kompresją Draco (np. z innego narzędzia) przechodzi bez optymalizacji.
 * Moduł ładowany dynamicznie dopiero przy wgrywaniu (duże zależności).
 */
import { WebIO, type Document, type Transform } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { LoadingManager } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const MAX_TEXTURE = 2048;

export type Prepared = {
  glb: Uint8Array;
  /** Rozmiar źródła (wszystkie wybrane pliki) i wyniku w bajtach. */
  before: number;
  after: number;
  elements: number;
  triangles: number;
  notes: string[];
};

const ext = (f: File) => f.name.toLowerCase().split(".").pop() ?? "";

/** Wybrane pliki -> GLB (bez optymalizacji). */
async function toGlb(files: File[], notes: string[]): Promise<Uint8Array> {
  const glb = files.find((f) => ext(f) === "glb");
  if (glb) return new Uint8Array(await glb.arrayBuffer());

  const obj = files.find((f) => ext(f) === "obj");
  if (!obj) {
    if (files.some((f) => ext(f) === "gltf")) {
      throw new Error("Plik .gltf ma dane w osobnych plikach. Wyeksportuj model jako .glb (jeden plik).");
    }
    throw new Error("Wybierz plik .glb albo .obj (opcjonalnie z .mtl i teksturami).");
  }

  // Tekstury i MTL wskazane w OBJ szukamy wśród wybranych plików (po nazwie, bez folderów).
  const urls = new Map<string, string>();
  for (const f of files) urls.set(f.name.toLowerCase(), URL.createObjectURL(f));
  // Menedżer liczy wczytywane tekstury z MTL; onLoad = wszystkie gotowe.
  let started = 0;
  let allDone: () => void = () => {};
  const loaded = new Promise<void>((resolve) => (allDone = resolve));
  const manager = new LoadingManager(() => allDone(), undefined, () => {});
  manager.onStart = () => {
    started++;
  };
  manager.setURLModifier((url) => {
    const name = decodeURIComponent(url.split(/[\\/]/).pop() ?? "").toLowerCase();
    return urls.get(name) ?? url;
  });
  try {
    const loader = new OBJLoader(manager);
    const mtl = files.find((f) => ext(f) === "mtl");
    if (mtl) {
      const materials = new MTLLoader(manager).parse(await mtl.text(), "");
      materials.preload();
      loader.setMaterials(materials);
    } else {
      notes.push("Bez pliku .mtl model dostanie szary materiał – role i kolory i tak zadziałają.");
    }
    const group = loader.parse(await obj.text());
    // Czekamy, aż tekstury z MTL się wczytają (GLTFExporter potrzebuje obrazów); max 20 s.
    if (started > 0) await Promise.race([loaded, new Promise((r) => setTimeout(r, 20_000))]);
    const out = await new GLTFExporter().parseAsync(group, { binary: true });
    notes.push("Plik OBJ zamieniony na GLB.");
    return new Uint8Array(out as ArrayBuffer);
  } finally {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}

/** Nagłówek GLB: "glTF", wersja 2. */
function isGlb(b: Uint8Array) {
  return b.byteLength > 20 && new DataView(b.buffer, b.byteOffset).getUint32(0, true) === 0x46546c67;
}

/** Lista extensionsUsed z części JSON pliku GLB (bez wczytywania geometrii). */
function glbExtensions(b: Uint8Array): string[] {
  if (!isGlb(b)) return [];
  try {
    const v = new DataView(b.buffer, b.byteOffset);
    const len = v.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + len))) as { extensionsUsed?: string[] };
    return json.extensionsUsed ?? [];
  } catch {
    return [];
  }
}

/** Nazwa elementu w formie, którą three.js zostawia bez zmian (bez spacji i [ ] . : / \). */
function safeName(raw: string) {
  return (
    raw
      .normalize("NFC")
      .replace(/\s+/g, "_")
      .replace(/[[\].:/\\]/g, "")
      .slice(0, 80) || "Element"
  );
}

/** Unikalne nazwy węzłów (na nich wiszą oznaczenia). */
function uniqueNames(doc: Document) {
  const used = new Set<string>();
  for (const node of doc.getRoot().listNodes()) {
    const base = safeName(node.getName() || node.getMesh()?.getName() || "Element");
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}_${i}`;
    used.add(name);
    node.setName(name);
  }
}

/** Tekstury większe niż 2048 px pomniejszamy (ten sam format). */
function shrinkTextures(): Transform {
  return async (doc: Document) => {
    for (const tex of doc.getRoot().listTextures()) {
      const image = tex.getImage();
      const mime = tex.getMimeType();
      if (!image || !/^image\/(png|jpeg)$/.test(mime)) continue;
      const bitmap = await createImageBitmap(new Blob([image], { type: mime }));
      const scale = Math.min(1, MAX_TEXTURE / Math.max(bitmap.width, bitmap.height));
      if (scale >= 1) {
        bitmap.close();
        continue;
      }
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, 0.88));
      if (blob) tex.setImage(new Uint8Array(await blob.arrayBuffer()));
    }
  };
}

function stats(doc: Document) {
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const count = prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION")?.getCount() ?? 0;
      triangles += Math.floor(count / 3);
    }
  }
  return { elements: doc.getRoot().listNodes().filter((n) => n.getMesh()).length, triangles };
}

/** Pliki z formularza -> gotowy, zoptymalizowany GLB. */
export async function prepareModel(files: File[], onStep?: (text: string) => void): Promise<Prepared> {
  const notes: string[] = [];
  const before = files.reduce((sum, f) => sum + f.size, 0);
  onStep?.("Wczytywanie pliku…");
  const source = await toGlb(files, notes);

  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

  // Draco (np. plik już skompresowany innym narzędziem): bez dekodera Draco nie da się go
  // przepisać, więc wgrywamy jak jest – scena oferty i edytor oznaczeń umieją go odczytać.
  const used = glbExtensions(source);
  if (used.includes("KHR_draco_mesh_compression")) {
    notes.push("Model ma już kompresję Draco – wgrywam go bez optymalizacji. Nazwy elementów zostają z pliku.");
    return { glb: source, before, after: source.byteLength, elements: 0, triangles: 0, notes };
  }

  let doc: Document;
  try {
    doc = await io.readBinary(source);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!used.length && !isGlb(source)) throw new Error(`Nie udało się odczytać modelu: ${msg}`);
    // Poprawny GLB z czymś, czego optymalizator nie zna: lepiej wgrać bez zmian niż wcale.
    notes.push(`Nie udało się zoptymalizować (${msg}) – wgrywam bez zmian.`);
    return { glb: source, before, after: source.byteLength, elements: 0, triangles: 0, notes };
  }

  onStep?.("Optymalizacja geometrii i tekstur…");
  uniqueNames(doc);
  await doc.transform(dedup(), prune(), weld(), shrinkTextures(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const glb = await io.writeBinary(doc);
  return { glb, before, after: glb.byteLength, ...stats(doc), notes };
}

export function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / 1024))} kB`;
}
