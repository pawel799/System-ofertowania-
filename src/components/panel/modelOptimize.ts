/*
 * Przygotowanie modelu 3D w przeglądarce, zanim trafi na serwer (serwer nie mieli plików):
 *   1. GLB wczytujemy wprost; OBJ (np. z PRO100, opcjonalnie z MTL i teksturami) zamieniamy na GLB.
 *   2. Każdy element dostaje unikalną nazwę bez znaków specjalnych – po niej zapisujemy
 *      oznaczenia (front / blat / uchwyt), a three.js czyta ją z pliku bez zmian.
 *   3. Optymalizacja (gltf-transform): duplikaty, nieużywane dane, sklejenie wierzchołków,
 *      tekstury max 2048 px, kompresja geometrii meshopt.
 * Plik z kompresją Draco (np. z innego narzędzia) przechodzi bez optymalizacji.
 *
 * Przed wysłaniem: analizujModel() sprawdza siatkę (pusta geometria, złe współrzędne, zdegenerowane i zdublowane
 * trójkąty – migoczące płaszczyzny, otwarte i niepołączone krawędzie, brak normalnych) i mierzy model; jednostki
 * (m / cm / mm) zgadujemy, użytkownik może zmienić wymiary i proporcje. przygotujModel() zapisuje skalę w pliku
 * (model w metrach, środek podstawy w 0, 0, 0), naprawia co się da i optymalizuje.
 * Moduł ładowany dynamicznie dopiero przy wgrywaniu (duże zależności).
 */
import { getBounds, WebIO, type Document, type Primitive, type Transform } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, normals, prune, weld } from "@gltf-transform/functions";
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


/* ---------- analiza przed wysłaniem ---------- */

export type Jednostka = "m" | "cm" | "mm";
export const JEDNOSTKI: Record<Jednostka, number> = { m: 1, cm: 0.01, mm: 0.001 };

export type Problem = { poziom: "blad" | "uwaga" | "info"; tekst: string; naprawa?: string };

export type Analiza = {
  source: Uint8Array;
  before: number;
  notes: string[];
  /** Dokument gltf-transform (null = plik Draco albo nieczytelny – wgrywamy bez zmian). */
  doc: Document | null;
  /** Wymiary w jednostkach pliku (x = szerokość, y = wysokość, z = głębokość); null = nieznane. */
  surowe: { x: number; y: number; z: number } | null;
  jednostka: Jednostka;
  problemy: Problem[];
  elementy: number;
  trojkaty: number;
};

/** Jednostka pliku z rozmiaru: mebel ma zwykle 0,2–6 m. glTF jest w metrach, OBJ z PRO100 bywa w cm albo mm. */
function zgadnijJednostke(maks: number): Jednostka {
  if (maks <= 12) return "m";
  if (maks <= 1200) return "cm";
  return "mm";
}

/** Siatka jednego prymitywu: trójkąty, zdegenerowane, zdublowane, krawędzie otwarte i niepołączone (na pozycjach). */
function sprawdzSiatke(prim: Primitive) {
  const out = { trojkaty: 0, nan: false, zdegenerowane: 0, duble: 0, otwarte: 0, niepolaczone: 0, bezNormalnych: false, nieTrojkaty: false };
  const pos = prim.getAttribute("POSITION");
  if (!pos) return out;
  if (prim.getMode() !== 4) {
    out.nieTrojkaty = true;
    return out;
  }
  out.bezNormalnych = !prim.getAttribute("NORMAL");
  const n = pos.getCount();
  const idx = prim.getIndices();
  const liczba = idx ? idx.getCount() : n;
  out.trojkaty = Math.floor(liczba / 3);
  // Pozycje sklejone po współrzędnych (eksportery dzielą wierzchołki na krawędziach – połączenie liczymy po miejscu).
  const v: number[] = [];
  const klucz = new Map<string, number>();
  const id = new Int32Array(n);
  const t: number[] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, t);
    if (!Number.isFinite(t[0]) || !Number.isFinite(t[1]) || !Number.isFinite(t[2])) out.nan = true;
    const k = `${Math.round(t[0] * 1e4)},${Math.round(t[1] * 1e4)},${Math.round(t[2] * 1e4)}`;
    let j = klucz.get(k);
    if (j === undefined) {
      j = klucz.size;
      klucz.set(k, j);
      v.push(t[0], t[1], t[2]);
    }
    id[i] = j;
  }
  const krawedzie = new Map<number, number>();
  const trojki = new Set<string>();
  const P = (a: number) => [v[a * 3], v[a * 3 + 1], v[a * 3 + 2]];
  for (let f = 0; f < out.trojkaty; f++) {
    const a = id[idx ? idx.getScalar(f * 3) : f * 3];
    const b = id[idx ? idx.getScalar(f * 3 + 1) : f * 3 + 1];
    const c = id[idx ? idx.getScalar(f * 3 + 2) : f * 3 + 2];
    if (a === b || b === c || a === c) {
      out.zdegenerowane++;
      continue;
    }
    const [pa, pb, pc] = [P(a), P(b), P(c)];
    const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
    const wx = pc[0] - pa[0], wy = pc[1] - pa[1], wz = pc[2] - pa[2];
    const pole = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
    if (pole < 1e-12) {
      out.zdegenerowane++;
      continue;
    }
    const s = [a, b, c].sort((x, y) => x - y).join(",");
    // Duplikat to osobny problem – jego krawędzi nie liczymy drugi raz (nie robi z siatki „non-manifold”).
    if (trojki.has(s)) {
      out.duble++;
      continue;
    }
    trojki.add(s);
    for (const [x, y] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const e = x < y ? x * 4194304 + y : y * 4194304 + x;
      krawedzie.set(e, (krawedzie.get(e) ?? 0) + 1);
    }
  }
  krawedzie.forEach((k) => {
    if (k === 1) out.otwarte++;
    else if (k > 2) out.niepolaczone++;
  });
  return out;
}

/** Usuwa zdegenerowane i zdublowane trójkąty (migoczące płaszczyzny) – na indeksach prymitywu. */
function usunZleTrojkaty(doc: Document) {
  let usuniete = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos || prim.getMode() !== 4) continue;
      const n = pos.getCount();
      // Siatka bez indeksów (np. OBJ po konwersji) – indeksy po kolei, żeby dało się wyrzucić trójkąty.
      let idx = prim.getIndices();
      if (!idx) {
        const kolejne = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
        for (let i = 0; i < n; i++) kolejne[i] = i;
        idx = doc.createAccessor().setType("SCALAR").setArray(kolejne);
        prim.setIndices(idx);
      }
      const klucz = new Map<string, number>();
      const id = new Int32Array(n);
      const t: number[] = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos.getElement(i, t);
        const k = `${Math.round(t[0] * 1e4)},${Math.round(t[1] * 1e4)},${Math.round(t[2] * 1e4)}`;
        let j = klucz.get(k);
        if (j === undefined) klucz.set(k, (j = klucz.size));
        id[i] = j;
      }
      const stare = idx.getArray();
      if (!stare) continue;
      const nowe: number[] = [];
      const byly = new Set<string>();
      for (let f = 0; f + 2 < stare.length; f += 3) {
        const [a, b, c] = [stare[f], stare[f + 1], stare[f + 2]];
        const [ia, ib, ic] = [id[a], id[b], id[c]];
        const s = [ia, ib, ic].sort((x, y) => x - y).join(",");
        if (ia === ib || ib === ic || ia === ic || byly.has(s)) {
          usuniete++;
          continue;
        }
        byly.add(s);
        nowe.push(a, b, c);
      }
      if (nowe.length !== stare.length) idx.setArray(n > 65535 ? new Uint32Array(nowe) : new Uint16Array(nowe));
    }
  return usuniete;
}

const liczba = (n: number) => n.toLocaleString("pl-PL");

/** Pliki z formularza → analiza (bez wysyłania): problemy siatki, wymiary, jednostki. */
export async function analizujModel(files: File[], onStep?: (text: string) => void): Promise<Analiza> {
  const notes: string[] = [];
  const before = files.reduce((sum, f) => sum + f.size, 0);
  onStep?.("Wczytywanie pliku…");
  const source = await toGlb(files, notes);
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const used = glbExtensions(source);
  const pusta = (problemy: Problem[]): Analiza => ({ source, before, notes, doc: null, surowe: null, jednostka: "m", problemy, elementy: 0, trojkaty: 0 });
  if (used.includes("KHR_draco_mesh_compression")) {
    return pusta([{ poziom: "info", tekst: "Model ma kompresję Draco – nie da się go sprawdzić ani przeskalować w przeglądarce. Wpisz jego wymiary ręcznie." }]);
  }
  let doc: Document;
  try {
    doc = await io().readBinary(source);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!used.length && !isGlb(source)) throw new Error(`Nie udało się odczytać modelu: ${msg}`);
    return pusta([{ poziom: "uwaga", tekst: `Nie udało się sprawdzić modelu (${msg}). Wgram go bez zmian – wpisz wymiary ręcznie.` }]);
  }
  onStep?.("Sprawdzanie siatki…");
  const problemy: Problem[] = [];
  const suma = { trojkaty: 0, nan: false, zdegenerowane: 0, duble: 0, otwarte: 0, niepolaczone: 0, bezNormalnych: 0, nieTrojkaty: 0 };
  const meshe = doc.getRoot().listMeshes();
  for (const mesh of meshe)
    for (const prim of mesh.listPrimitives()) {
      const r = sprawdzSiatke(prim);
      suma.trojkaty += r.trojkaty;
      suma.nan ||= r.nan;
      suma.zdegenerowane += r.zdegenerowane;
      suma.duble += r.duble;
      suma.otwarte += r.otwarte;
      suma.niepolaczone += r.niepolaczone;
      if (r.bezNormalnych) suma.bezNormalnych++;
      if (r.nieTrojkaty) suma.nieTrojkaty++;
    }
  const scena = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (!meshe.length || !suma.trojkaty || !scena) problemy.push({ poziom: "blad", tekst: "Model nie ma żadnej bryły (zero trójkątów). Sprawdź eksport – może wyeksportowano pustą scenę albo same linie." });
  if (suma.nan) problemy.push({ poziom: "blad", tekst: "Część wierzchołków ma błędne współrzędne (NaN / nieskończoność). Model wyświetli się źle – popraw eksport." });
  if (suma.zdegenerowane) problemy.push({ poziom: "uwaga", tekst: `${liczba(suma.zdegenerowane)} zdegenerowanych trójkątów (zerowa powierzchnia).`, naprawa: "usunę je" });
  if (suma.duble) problemy.push({ poziom: "uwaga", tekst: `${liczba(suma.duble)} nakładających się płaszczyzn (te same trójkąty dwa razy) – w 3D migoczą.`, naprawa: "usunę duplikaty" });
  if (suma.niepolaczone) problemy.push({ poziom: "uwaga", tekst: `${liczba(suma.niepolaczone)} krawędzi łączy więcej niż dwie płaszczyzny (siatka niepołączona poprawnie, „non-manifold”). Zwykle widać to jako szwy albo cienie w złych miejscach.` });
  if (suma.otwarte) problemy.push({ poziom: "info", tekst: `${liczba(suma.otwarte)} otwartych krawędzi (płaszczyzny nie są domknięte w bryłę). Przy pojedynczych płytach to normalne; przy korpusie może znaczyć dziurę.` });
  if (suma.bezNormalnych) problemy.push({ poziom: "uwaga", tekst: `${suma.bezNormalnych} elementów bez normalnych – oświetlenie byłoby płaskie albo czarne.`, naprawa: "policzę normalne" });
  if (suma.nieTrojkaty) problemy.push({ poziom: "info", tekst: `${suma.nieTrojkaty} elementów to linie albo punkty – w ofercie nie będą widoczne.` });
  if (suma.trojkaty > 1_500_000) problemy.push({ poziom: "uwaga", tekst: `Model ma ${liczba(suma.trojkaty)} trójkątów – na telefonie klienta może działać wolno. Uprość go w programie do projektowania.` });

  let surowe: Analiza["surowe"] = null;
  let jednostka: Jednostka = "m";
  if (scena && suma.trojkaty) {
    const b = getBounds(scena);
    surowe = { x: b.max[0] - b.min[0], y: b.max[1] - b.min[1], z: b.max[2] - b.min[2] };
    const maks = Math.max(surowe.x, surowe.y, surowe.z);
    jednostka = zgadnijJednostke(maks);
    const cm = (v: number) => (v * JEDNOSTKI[jednostka]) / 0.01;
    if (maks <= 0 || !Number.isFinite(maks)) problemy.push({ poziom: "blad", tekst: "Model ma zerowy rozmiar." });
    else if (Math.min(cm(surowe.x), cm(surowe.y), cm(surowe.z)) < 0.5) problemy.push({ poziom: "info", tekst: "Jeden z wymiarów jest prawie zerowy – model jest płaski (np. sama płyta albo rysunek)." });
    if (Math.abs(b.min[1]) > (maks || 1) * 0.02) problemy.push({ poziom: "info", tekst: "Model nie stoi na podłodze (dół nie jest na wysokości 0).", naprawa: "postawię go na podłodze i wyśrodkuję" });
  }
  return { source, before, notes, doc, surowe, jednostka, problemy, elementy: stats(doc).elements, trojkaty: suma.trojkaty };
}

/**
 * Analiza + docelowe wymiary [cm] → gotowy GLB: model w metrach, środek podstawy w (0, 0, 0), naprawy (zdegenerowane
 * i zdublowane trójkąty, normalne), optymalizacja. Wymiary inne niż z pliku = skala (także różna na osiach).
 */
export async function przygotujModel(a: Analiza, cel: { w: number; h: number; d: number } | null, onStep?: (text: string) => void): Promise<Prepared> {
  const notes = [...a.notes];
  if (!a.doc || !a.surowe) return { glb: a.source, before: a.before, after: a.source.byteLength, elements: 0, triangles: 0, notes };
  const doc = a.doc;
  onStep?.("Naprawa i skalowanie…");
  const usuniete = usunZleTrojkaty(doc);
  if (usuniete) notes.push(`Usunięto ${liczba(usuniete)} złych trójkątów.`);
  await doc.transform(normals({ overwrite: false }));
  const scena = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (scena) {
    const b = getBounds(scena);
    const k = JEDNOSTKI[a.jednostka];
    const docelowe = cel ?? { w: (a.surowe.x * k) / 0.01, h: (a.surowe.y * k) / 0.01, d: (a.surowe.z * k) / 0.01 };
    const sx = a.surowe.x > 0 ? docelowe.w / 100 / a.surowe.x : k;
    const sy = a.surowe.y > 0 ? docelowe.h / 100 / a.surowe.y : k;
    const sz = a.surowe.z > 0 ? docelowe.d / 100 / a.surowe.z : k;
    const cx = (b.min[0] + b.max[0]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    // Nowy korzeń: skala do metrów / wybranych wymiarów, środek podstawy w zerze.
    const korzen = doc.createNode("Model").setScale([sx, sy, sz]).setTranslation([-cx * sx, -b.min[1] * sy, -cz * sz]);
    for (const dziecko of scena.listChildren()) {
      scena.removeChild(dziecko);
      korzen.addChild(dziecko);
    }
    scena.addChild(korzen);
    notes.push(`Wymiary: ${Math.round(docelowe.w)} × ${Math.round(docelowe.h)} × ${Math.round(docelowe.d)} cm.`);
  }
  onStep?.("Optymalizacja geometrii i tekstur…");
  uniqueNames(doc);
  await doc.transform(dedup(), prune(), weld(), shrinkTextures(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const glb = await io().writeBinary(doc);
  return { glb, before: a.before, after: glb.byteLength, ...stats(doc), notes };
}

function io() {
  return new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
}
