/*
 * Otwieranie frontów w modelach GLB (biblioteka i wgrane pliki z nazwami jak w Blenderze):
 *   Front_drzwi*, Front_witryna*  – drzwi na zawiasie przy bliższym boku (100°),
 *   Front_klapa*                  – klapa do góry (zawias u góry),
 *   Front_zmywarka*               – w dół (zawias u dołu),
 *   Front_szuflada*               – wysuw do przodu ze skrzynką dorobioną w środku,
 *   Front_panel* (bez „boczny”)   – drzwi przesuwne: przednie skrzydło jedzie na sąsiednie.
 * Uchwyty w plikach są jedną siatką („Uchwyty”) – trójkąty rozdzielamy na fronty, żeby jechały razem z nimi.
 *
 * Front modelu jest w +Z (jak w kreatorze). Pivot wstawiamy między węzeł a jego rodzica, więc oznaczenia ról
 * (tagi po nazwach węzłów-rodziców) dalej działają; kawałki uchwytów dostają nowe nazwy z tą samą rolą (aliasy).
 */
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Object3D,
} from "three";
import { boxWzgledem } from "./obrys";
import { meshRoles, type ModelRole } from "../modelRoles";

export type Ruchomy =
  | { obj: Object3D; typ: "obrot"; os: "x" | "y"; kat: number }
  | { obj: Object3D; typ: "przesuw"; baza: Vector3; o: Vector3 };

const DRZWI = /front_(drzwi|witryna)/i;
const KLAPA = /front_klapa/i;
const ZMYWARKA = /front_zmywarka/i;
const SZUFLADA = /front_szuflada/i;
const PANEL = /front_panel(?!_boczny)/i;
const UCHWYT = /uchwyt/i;

const st = (deg: number) => (deg * Math.PI) / 180;

function wPrzestrzeniRodzica(root: Object3D, parent: Object3D, p: Vector3) {
  return parent.worldToLocal(root.localToWorld(p.clone()));
}

/** Wstawia pivot między węzeł a rodzica; pivot w punkcie `punkt` (układ root). */
function owin(root: Object3D, node: Object3D, punkt: Vector3) {
  const parent = node.parent ?? root;
  const pivot = new Group();
  pivot.name = `${node.name}__ruch`;
  pivot.userData.ruchomy = true;
  pivot.position.copy(wPrzestrzeniRodzica(root, parent, punkt));
  parent.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(node);
  return pivot;
}

/** Rozdziela siatkę uchwytów na kawałki przy frontach (po środku trójkąta w rzucie XY frontu). */
function rozdzielUchwyty(root: Object3D, uchwyty: Mesh, fronty: { node: Object3D; bb: Box3 }[]) {
  const geo = (uchwyty.geometry.index ? uchwyty.geometry.toNonIndexed() : uchwyty.geometry) as BufferGeometry;
  const pos = geo.getAttribute("position");
  const atrybuty = Object.keys(geo.attributes);
  const doRoot = new Matrix4().copy(root.matrixWorld).invert().multiply(uchwyty.matrixWorld);
  const grupy = new Map<number, number[]>();
  const reszta: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t).applyMatrix4(doRoot);
    b.fromBufferAttribute(pos, t + 1).applyMatrix4(doRoot);
    c.fromBufferAttribute(pos, t + 2).applyMatrix4(doRoot);
    const s = a.add(b).add(c).multiplyScalar(1 / 3);
    const i = fronty.findIndex(({ bb }) => s.x >= bb.min.x - 0.01 && s.x <= bb.max.x + 0.01 && s.y >= bb.min.y - 0.01 && s.y <= bb.max.y + 0.01 && s.z >= bb.min.z - 0.005 && s.z <= bb.max.z + 0.09);
    if (i >= 0) {
      const lista = grupy.get(i) ?? [];
      lista.push(t);
      grupy.set(i, lista);
    } else reszta.push(t);
  }
  if (!grupy.size) return [];
  const zbuduj = (trojkaty: number[]) => {
    const g = new BufferGeometry();
    for (const nazwa of atrybuty) {
      const src = geo.getAttribute(nazwa);
      const dane = new (src.array.constructor as new (n: number) => Float32Array)(trojkaty.length * 3 * src.itemSize);
      trojkaty.forEach((t, k) => {
        for (let v = 0; v < 3; v++) for (let j = 0; j < src.itemSize; j++) dane[(k * 3 + v) * src.itemSize + j] = src.array[(t + v) * src.itemSize + j];
      });
      g.setAttribute(nazwa, new BufferAttribute(dane, src.itemSize, src.normalized));
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  };
  const kawalki: { mesh: Mesh; front: number }[] = [];
  grupy.forEach((trojkaty, i) => {
    const m = new Mesh(zbuduj(trojkaty), uchwyty.material);
    m.name = `${uchwyty.name}__${i}`;
    m.castShadow = true;
    m.receiveShadow = true;
    (uchwyty.parent ?? root).add(m);
    m.position.copy(uchwyty.position);
    m.quaternion.copy(uchwyty.quaternion);
    m.scale.copy(uchwyty.scale);
    m.updateMatrixWorld(true);
    kawalki.push({ mesh: m, front: i });
  });
  uchwyty.geometry = zbuduj(reszta);
  return kawalki;
}

function skrzynka(korpusGl: number, bb: Box3, material: MeshStandardMaterial) {
  const g = new Group();
  const w = Math.max(0.05, bb.max.x - bb.min.x - 0.04);
  const h = Math.max(0.04, Math.min(0.24, (bb.max.y - bb.min.y) * 0.72));
  const d = Math.max(0.1, korpusGl * 0.8);
  const cx = (bb.min.x + bb.max.x) / 2;
  const y0 = bb.min.y + 0.015;
  const zTyl = bb.min.z - d;
  const czesci: [number, number, number, number, number, number][] = [
    [w, 0.008, d, cx, y0 + 0.004, zTyl + d / 2],
    [0.014, h, d, cx - w / 2 + 0.007, y0 + h / 2, zTyl + d / 2],
    [0.014, h, d, cx + w / 2 - 0.007, y0 + h / 2, zTyl + d / 2],
    [w, h, 0.014, cx, y0 + h / 2, zTyl + 0.007],
  ];
  for (const [sx, sy, sz, x, y, z] of czesci) {
    const m = new Mesh(new BoxGeometry(sx, sy, sz), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/**
 * Przygotowuje kopię sceny do otwierania (raz po wczytaniu). Zwraca listę ruchomych węzłów i aliasy ról
 * (nowe nazwy kawałków uchwytów → rola oryginału), do dołożenia do tagów przy applyRoles.
 */
export function przygotujRuchome(root: Object3D, tags: Record<string, ModelRole> = {}) {
  const ruchome: Ruchomy[] = [];
  const aliasy: Record<string, ModelRole> = {};
  if (root.userData.ruchomeGotowe) return { ruchome: root.userData.ruchome as Ruchomy[], aliasy: root.userData.aliasy as Record<string, ModelRole> };
  root.updateMatrixWorld(true);
  const caly = boxWzgledem(root, root);
  if (caly.isEmpty()) return { ruchome, aliasy };
  const cx = (caly.min.x + caly.max.x) / 2;
  const gl = caly.max.z - caly.min.z;

  const fronty: { node: Object3D; bb: Box3; typ: "drzwi" | "klapa" | "zmywarka" | "szuflada" | "panel" }[] = [];
  const uchwyty: Mesh[] = [];
  root.traverse((o) => {
    const n = o.name || "";
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const typ = DRZWI.test(n) ? "drzwi" : KLAPA.test(n) ? "klapa" : ZMYWARKA.test(n) ? "zmywarka" : SZUFLADA.test(n) ? "szuflada" : PANEL.test(n) ? "panel" : null;
    if (typ) fronty.push({ node: o, bb: boxWzgledem(root, o), typ });
    else if (UCHWYT.test(n)) uchwyty.push(mesh);
  });
  if (!fronty.length) return { ruchome, aliasy };

  // Uchwyty: kawałek przy froncie jedzie z frontem, z tą samą rolą (np. „uchwyt” – kolor i ukrycie przy push-to-open).
  const role = meshRoles(root, tags);
  const kawalkiFrontu = new Map<number, Mesh[]>();
  for (const u of uchwyty) {
    const rola = role.get(u);
    for (const { mesh, front } of rozdzielUchwyty(root, u, fronty)) {
      if (rola) aliasy[mesh.name] = rola;
      kawalkiFrontu.set(front, [...(kawalkiFrontu.get(front) ?? []), mesh]);
    }
  }

  const drewno = new MeshStandardMaterial({ color: "#d9cbb5", roughness: 0.8 });
  const panele = fronty.map((f, i) => ({ f, i })).filter(({ f }) => f.typ === "panel");
  const zPrzodu = panele.length ? Math.max(...panele.map(({ f }) => f.bb.max.z)) : 0;

  fronty.forEach((f, i) => {
    const { bb } = f;
    const sx = (bb.min.x + bb.max.x) / 2;
    let pivot: Object3D;
    if (f.typ === "drzwi") {
      const lewy = sx <= cx + 0.005;
      pivot = owin(root, f.node, new Vector3(lewy ? bb.min.x : bb.max.x, 0, bb.max.z));
      ruchome.push({ obj: pivot, typ: "obrot", os: "y", kat: lewy ? -st(100) : st(100) });
    } else if (f.typ === "klapa") {
      pivot = owin(root, f.node, new Vector3(0, bb.max.y, bb.max.z));
      ruchome.push({ obj: pivot, typ: "obrot", os: "x", kat: -st(80) });
    } else if (f.typ === "zmywarka") {
      pivot = owin(root, f.node, new Vector3(0, bb.min.y, bb.max.z));
      ruchome.push({ obj: pivot, typ: "obrot", os: "x", kat: st(75) });
    } else if (f.typ === "szuflada") {
      pivot = owin(root, f.node, new Vector3(0, 0, 0));
      const parent = pivot.parent ?? root;
      const ws = new Vector3();
      parent.getWorldScale(ws);
      const rs = new Vector3();
      root.getWorldScale(rs);
      // Skrzynka tylko, gdy węzeł nie ma własnej skali (inaczej wymiary skrzynki byłyby złe).
      if (Math.abs(ws.x / rs.x - 1) < 0.01 && Math.abs(ws.z / rs.z - 1) < 0.01) {
        const s = skrzynka(gl, bb, drewno);
        const w0 = wPrzestrzeniRodzica(root, parent, new Vector3(0, 0, 0));
        s.position.copy(w0).sub(pivot.position);
        pivot.add(s);
      }
      const o = wPrzestrzeniRodzica(root, parent, new Vector3(0, 0, gl * 0.7)).sub(wPrzestrzeniRodzica(root, parent, new Vector3(0, 0, 0)));
      ruchome.push({ obj: pivot, typ: "przesuw", baza: pivot.position.clone(), o });
    } else {
      // Drzwi przesuwne: rusza tylko skrzydło z przedniego toru, na miejsce najbliższego sąsiada.
      if (bb.max.z < zPrzodu - 0.004) return;
      const sasiad = panele
        .filter(({ i: j }) => j !== i)
        .map(({ f: g }) => (g.bb.min.x + g.bb.max.x) / 2)
        .sort((a, b) => Math.abs(a - sx) - Math.abs(b - sx))[0];
      if (sasiad === undefined) return;
      pivot = owin(root, f.node, new Vector3(0, 0, 0));
      const parent = pivot.parent ?? root;
      const o = wPrzestrzeniRodzica(root, parent, new Vector3((sasiad - sx) * 0.96, 0, 0)).sub(wPrzestrzeniRodzica(root, parent, new Vector3(0, 0, 0)));
      ruchome.push({ obj: pivot, typ: "przesuw", baza: pivot.position.clone(), o });
    }
    for (const m of kawalkiFrontu.get(i) ?? []) pivot.attach(m);
  });

  root.userData.ruchomeGotowe = true;
  root.userData.ruchome = ruchome;
  root.userData.aliasy = aliasy;
  return { ruchome, aliasy };
}

/** Ustawia otwarcie 0–1 (wygładzone) na wszystkich ruchomych węzłach. */
export function ustawOtwarcie(ruchome: readonly Ruchomy[], p: number) {
  for (const r of ruchome) {
    if (r.typ === "obrot") {
      if (r.os === "y") r.obj.rotation.y = r.kat * p;
      else r.obj.rotation.x = r.kat * p;
    } else {
      r.obj.position.copy(r.baza).addScaledVector(r.o, p);
    }
  }
}
