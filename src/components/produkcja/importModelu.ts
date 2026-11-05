/*
 * Formatki odczytane z modelu 3D – np. eksport OBJ z PRO100, 3DS albo GLB z innego programu.
 *
 * Program meblowy zapisuje każdą płytę jako prostopadłościan. Rozbijamy siatki na spójne kawałki,
 * zostawiamy te, które mają dokładnie 8 narożników (prostopadłościan, także obrócony),
 * i liczymy trzy krawędzie: najmniejsza to grubość, dwie pozostałe – wymiary formatki.
 * Jednostki zgadujemy po typowej grubości (18 mm / 1,8 cm / 0,018 m). Materiał = nazwa materiału siatki (usemtl).
 * Uchwyty, AGD i zaokrąglone kształty (więcej niż 8 narożników) pomijamy.
 * Moduł ładowany dynamicznie dopiero po wybraniu pliku (three.js loadery).
 */
import { Box3, Mesh, Vector3, type BufferGeometry, type Material, type Object3D } from "three";
import { DREWNO_RE, HDF, type Formatka, type MaterialFormatki } from "./formatki";
import type { WynikImportu } from "./importListy";

const ext = (f: File) => f.name.toLowerCase().split(".").pop() ?? "";

async function wczytaj(files: File[]): Promise<Object3D> {
  const glb = files.find((f) => ext(f) === "glb");
  if (glb) {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("three/examples/jsm/loaders/GLTFLoader.js"), import("meshoptimizer")]);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const buf = await glb.arrayBuffer();
    return new Promise((res, rej) =>
      loader.parse(buf, "", (g) => res(g.scene), (e) => rej(new Error(`Nie da się odczytać GLB${/draco/i.test(String(e)) ? " (kompresja Draco – wyeksportuj bez kompresji)" : ""}.`))),
    );
  }
  const tds = files.find((f) => ext(f) === "3ds");
  if (tds) {
    const { TDSLoader } = await import("three/examples/jsm/loaders/TDSLoader.js");
    return new TDSLoader().parse(await tds.arrayBuffer(), "");
  }
  const obj = files.find((f) => ext(f) === "obj");
  if (obj) {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    return new OBJLoader().parse(await obj.text());
  }
  throw new Error("Wybierz plik .obj (eksport z PRO100), .3ds albo .glb.");
}

type Plyta = { a: number; b: number; c: number; material: string; nazwa: string };

/** Nazwa materiału, który pokrywa największą część kawałka. */
function nazwaMaterialu(m: Material | Material[], geo: BufferGeometry, trojkat: number) {
  if (!Array.isArray(m)) return m?.name || "";
  const idx = trojkat * 3;
  const g = geo.groups.find((x) => idx >= x.start && idx < x.start + x.count);
  return (g && m[g.materialIndex ?? 0]?.name) || m[0]?.name || "";
}

/** Rozbija siatkę na spójne kawałki (wspólne wierzchołki) i zwraca prostopadłościany. */
function plytySiatki(mesh: Mesh, eps: number): { plyty: Plyta[]; inne: number } {
  const geo = mesh.geometry as BufferGeometry;
  const pos = geo.getAttribute("position");
  if (!pos) return { plyty: [], inne: 0 };
  mesh.updateWorldMatrix(true, false);
  const v = new Vector3();
  const klucz = new Map<string, number>();
  const punkty: Vector3[] = [];
  const idPunktu: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const k = `${Math.round(v.x / eps)},${Math.round(v.y / eps)},${Math.round(v.z / eps)}`;
    let id = klucz.get(k);
    if (id === undefined) {
      id = punkty.length;
      klucz.set(k, id);
      punkty.push(v.clone());
    }
    idPunktu.push(id);
  }
  const index = geo.getIndex();
  const tri = index ? index.count / 3 : pos.count / 3;
  const wierz = (t: number, j: number) => idPunktu[index ? index.getX(t * 3 + j) : t * 3 + j];
  // Union-find po punktach.
  const rodzic = punkty.map((_, i) => i);
  const znajdz = (i: number): number => (rodzic[i] === i ? i : (rodzic[i] = znajdz(rodzic[i])));
  for (let t = 0; t < tri; t++) {
    const a = znajdz(wierz(t, 0));
    rodzic[znajdz(wierz(t, 1))] = a;
    rodzic[znajdz(wierz(t, 2))] = a;
  }
  const kawalki = new Map<number, { pkt: Set<number>; tri: number }>();
  for (let t = 0; t < tri; t++) {
    const r = znajdz(wierz(t, 0));
    const k = kawalki.get(r) ?? { pkt: new Set<number>(), tri: t };
    for (let j = 0; j < 3; j++) k.pkt.add(wierz(t, j));
    kawalki.set(r, k);
  }
  const plyty: Plyta[] = [];
  let inne = 0;
  const nazwa = (mesh.name || mesh.parent?.name || "").replace(/_/g, " ").trim();
  for (const k of Array.from(kawalki.values())) {
    if (k.pkt.size !== 8) {
      inne++;
      continue;
    }
    const p = Array.from(k.pkt).map((i) => punkty[i]);
    const wek = p.slice(1).map((q) => q.clone().sub(p[0]));
    let kraw: Vector3[] | null = null;
    for (let i = 0; i < wek.length && !kraw; i++)
      for (let j = i + 1; j < wek.length && !kraw; j++)
        for (let l = j + 1; l < wek.length && !kraw; l++) {
          const [x, y, z] = [wek[i], wek[j], wek[l]];
          const ort = (m: Vector3, n: Vector3) => Math.abs(m.dot(n)) <= 1e-3 * m.length() * n.length();
          if (ort(x, y) && ort(x, z) && ort(y, z)) kraw = [x, y, z];
        }
    if (!kraw) {
      inne++;
      continue;
    }
    const [a, b, c] = kraw.map((x) => x.length()).sort((m, n) => m - n);
    plyty.push({ a, b, c, material: nazwaMaterialu(mesh.material as Material | Material[], geo, k.tri), nazwa });
  }
  return { plyty, inne };
}

export async function formatkiZModelu(files: File[]): Promise<WynikImportu> {
  const root = await wczytaj(files);
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  const rozmiar = box.getSize(new Vector3());
  const eps = Math.max(rozmiar.x, rozmiar.y, rozmiar.z, 1e-6) * 1e-6;
  const plyty: Plyta[] = [];
  let inne = 0;
  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const w = plytySiatki(o as Mesh, eps);
    plyty.push(...w.plyty);
    inne += w.inne;
  });
  const uwagi: string[] = [];
  if (!plyty.length) return { formatki: [], materialy: [], uwagi: ["W modelu nie ma płyt (prostopadłościanów). Wyeksportuj model z programu meblowego bez zaokrągleń, każdą płytę osobno."], pominieteWierszy: inne };

  // Jednostki: najczęstsza grubość ~18 (mm), ~1,8 (cm) albo ~0,018 (m).
  const kandydaci = [1, 10, 1000].map((s) => ({ s, ile: plyty.filter((p) => p.a * s >= 15 && p.a * s <= 40).length }));
  const najlepsza = kandydaci.sort((x, y) => y.ile - x.ile)[0];
  const skala = najlepsza.ile ? najlepsza.s : Math.max(rozmiar.x, rozmiar.y, rozmiar.z) > 500 ? 1 : Math.max(rozmiar.x, rozmiar.y, rozmiar.z) > 5 ? 10 : 1000;
  uwagi.push(`Jednostki modelu: ${skala === 1 ? "milimetry" : skala === 10 ? "centymetry" : "metry"}.`);

  const materialy = new Map<string, MaterialFormatki>();
  const zbior = new Map<string, Formatka>();
  let poza = 0;
  for (const p of plyty) {
    const gr = Math.round(p.a * skala * 10) / 10;
    const dl = Math.round(p.c * skala);
    const szer = Math.round(p.b * skala);
    if (gr < 2 || gr > 45 || szer < 20) {
      poza++;
      continue;
    }
    const nazwaMat = (p.material || "Płyta").replace(/_/g, " ").trim();
    const klucz = gr <= 4 ? HDF.klucz : `mdl-${nazwaMat.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, "-")}-${Math.round(gr)}`;
    if (!materialy.has(klucz))
      materialy.set(klucz, gr <= 4 ? { ...HDF, nazwa: /hdf/i.test(nazwaMat) ? `${nazwaMat} ${gr} mm` : `${nazwaMat} (HDF ${gr} mm)` } : { klucz, nazwa: nazwaMat, grubosc: Math.round(gr), sloje: DREWNO_RE.test(nazwaMat), rodzaj: "plyta" });
    const nazwa = p.nazwa || "Płyta";
    const k = `${klucz}|${dl}|${szer}|${nazwa}`;
    const f = zbior.get(k);
    if (f) f.ilosc++;
    else zbior.set(k, { id: `m${zbior.size + 1}`, mebel: "Model 3D", element: nazwa, material: klucz, dl, szer, ilosc: 1, okleina: { d1: false, d2: false, s1: false, s2: false } });
  }
  if (inne) uwagi.push(`Pominięto ${inne} ${inne === 1 ? "kształt" : "kształtów"}, które nie są płytą (uchwyty, AGD, zaokrąglenia).`);
  if (poza) uwagi.push(`Pominięto ${poza} brył o grubości spoza 2–45 mm.`);
  uwagi.push("Okleiny i kierunku słojów model nie zapisuje – zaznacz je przed wysłaniem do hurtowni.");
  return { formatki: Array.from(zbior.values()), materialy: Array.from(materialy.values()), uwagi, pominieteWierszy: inne + poza };
}
