import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  Vector3,
} from "three";
import { HARDWARE, getHardware, subscribeHardware } from "./hardwareStore";

/*
 * Podmiana okuć (uchwytów) w modelu 3D po wyborze w MaterialsPanel.
 *
 * W kitchen-opt.glb uchwyty nie są osobną bryłą: cała metalowa drobnica (bateria,
 * reling, wieszaki, uchwyty) siedzi w jednej siatce z materiałem "Chrome".
 * splitHandles() raz po wczytaniu dzieli tę siatkę na spójne kawałki i wydziela
 * te, które wyglądają jak listwy uchwytów (cienki profil ≤ 4 cm, długość ≥ 20 cm,
 * na wysokości frontów), do osobnej siatki z materiałem HANDLE_MATERIAL.
 * Model z własną siatką "Handles" działa bez podziału.
 */
const HANDLE_MATERIAL = "Handles";
const CHROME_MATERIAL = "Chrome";

/** Czy kawałek (wymiary bboxa w metrach, w układzie modelu) wygląda jak listwa uchwytu. */
function looksLikeHandle(size: { x: number; y: number; z: number }, min: { y: number }) {
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
  return dims[0] <= 0.02 && dims[1] <= 0.04 && dims[2] >= 0.2 && dims[2] <= 1.2 && min.y > 0.95 && min.y < 1.12;
}

function splitHandles(root: Object3D) {
  if (root.userData.handlesSplit) return;
  root.userData.handlesSplit = true;
  root.updateMatrixWorld(true);
  const rootInv = new Matrix4().copy(root.matrixWorld).invert();
  const chrome: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh && !Array.isArray(o.material) && o.material.name === CHROME_MATERIAL) chrome.push(o);
  });
  for (const mesh of chrome) {
    const g = mesh.geometry as BufferGeometry;
    const pos = g.getAttribute("position");
    const index = g.getIndex();
    if (!pos || !index) continue;
    const toRoot = new Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
    // Spójne kawałki: łączymy wierzchołki o tej samej pozycji (union-find).
    const n = pos.count;
    const keyOf = new Map<string, number>();
    const weld = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
      let w = keyOf.get(k);
      if (w === undefined) keyOf.set(k, (w = keyOf.size));
      weld[i] = w;
    }
    const parent = new Int32Array(keyOf.size).map((_, i) => i);
    const find = (x: number) => {
      while (parent[x] !== x) x = parent[x] = parent[parent[x]];
      return x;
    };
    const idx = index.array;
    for (let t = 0; t < idx.length; t += 3) {
      const a = find(weld[idx[t]]);
      parent[find(weld[idx[t + 1]])] = a;
      parent[find(weld[idx[t + 2]])] = a;
    }
    const boxes = new Map<number, Box3>();
    const v = new Vector3();
    for (let i = 0; i < n; i++) {
      const r = find(weld[i]);
      let b = boxes.get(r);
      if (!b) boxes.set(r, (b = new Box3()));
      b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(toRoot));
    }
    const handleRoots = new Set<number>();
    boxes.forEach((b, r) => {
      if (looksLikeHandle(b.getSize(new Vector3()), b.min)) handleRoots.add(r);
    });
    if (!handleRoots.size) continue;
    const keep: number[] = [];
    const handles: number[] = [];
    for (let t = 0; t < idx.length; t += 3) {
      (handleRoots.has(find(weld[idx[t]])) ? handles : keep).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    // Geometria jest w pamięci podręcznej useGLTF – podmieniamy indeksy raz (flaga wyżej).
    const rest = g.clone();
    rest.setIndex(new BufferAttribute(new Uint32Array(keep), 1));
    mesh.geometry = rest;
    const hg = g.clone();
    hg.setIndex(new BufferAttribute(new Uint32Array(handles), 1));
    const material = (mesh.material as Material).clone();
    material.name = HANDLE_MATERIAL;
    const handleMesh = new Mesh(hg, material);
    handleMesh.name = "Handles";
    handleMesh.castShadow = mesh.castShadow;
    handleMesh.receiveShadow = mesh.receiveShadow;
    handleMesh.position.copy(mesh.position);
    handleMesh.quaternion.copy(mesh.quaternion);
    handleMesh.scale.copy(mesh.scale);
    mesh.parent?.add(handleMesh);
  }
}

type HandleLook =
  // Uchwyt widoczny w zadanym kolorze (kolor w sRGB, jak w CSS).
  | { kind: "metal"; color: string; metalness: number; roughness: number }
  // Fronty bez uchwytów – uchwyty znikają z modelu.
  | { kind: "hidden" };

// Klucze = id z HARDWARE (hardwareStore.ts).
const LOOKS: Record<string, HandleLook> = {
  mosiadz: { kind: "metal", color: "#b08d57", metalness: 1, roughness: 0.3 },
  "czarny-mat": {
    kind: "metal",
    color: "#1c1b1a",
    metalness: 0.15,
    roughness: 0.6,
  },
  "push-to-open": { kind: "hidden" },
};

type Target = { mesh: Mesh; original: Material };

/**
 * Tworzy warianty materiału uchwytów (raz na każdą opcję), nakłada wybrany
 * i podmienia go przy każdej zmianie. Zwraca funkcję sprzątającą:
 * przywraca oryginalne materiały, widoczność i zwalnia klony.
 */
export function installHardwareSwap(root: Object3D, onChange: () => void) {
  const targets: Target[] = [];
  splitHandles(root);

  root.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    // Oryginał trzymamy w userData: scena z useGLTF jest w pamięci podręcznej
    // i przy ponownym montowaniu siatka mogłaby mieć jeszcze klon.
    const original =
      (object.userData.handleOriginal as Material | undefined) ??
      object.material;
    if (original.name === HANDLE_MATERIAL) {
      object.userData.handleOriginal = original;
      targets.push({ mesh: object, original });
    }
  });

  // Model bez rozdzielonych uchwytów – nie ma czego podmieniać.
  if (targets.length === 0) return () => {};

  const variants = new Map<Material, Map<string, MeshStandardMaterial>>();
  for (const { original } of targets) {
    if (variants.has(original) || !(original instanceof MeshStandardMaterial))
      continue;
    const byId = new Map<string, MeshStandardMaterial>();
    for (const option of HARDWARE) {
      const look = LOOKS[option.id];
      if (!look || look.kind === "hidden") continue;
      const m = original.clone();
      m.name = `${original.name}__${option.id}`;
      m.color.set(look.color);
      m.metalness = look.metalness;
      m.roughness = look.roughness;
      m.needsUpdate = true;
      byId.set(option.id, m);
    }
    variants.set(original, byId);
  }

  const apply = () => {
    const id = getHardware();
    const hidden = LOOKS[id]?.kind === "hidden";
    for (const { mesh, original } of targets) {
      mesh.visible = !hidden;
      if (!hidden) {
        mesh.material = variants.get(original)?.get(id) ?? original;
      }
    }
    onChange();
  };

  apply();
  const unsubscribe = subscribeHardware(apply);

  return () => {
    unsubscribe();
    for (const { mesh, original } of targets) {
      mesh.material = original;
      mesh.visible = true;
    }
    // Tekstury są wspólne z modelem, więc zwalniamy tylko same klony.
    variants.forEach((byId) => byId.forEach((m) => m.dispose()));
  };
}
