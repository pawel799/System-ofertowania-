import { Mesh, MeshStandardMaterial, type Material, type Object3D } from "three";
import { FRONTS } from "./catalog";
import { toPhysical } from "./kitchenMaterials";
import { FINISH_LOOK, findRalFront, type Palette } from "./palettes";

/*
 * Materiały wgranego modelu (nie kuchni demo): elementy oznaczone w panelu jako
 * front / blat / uchwyt dostają kolor z wyboru w ofercie. Kuchnia demo ma własną,
 * dopasowaną do niej podmianę (frontMaterials.ts itd.) i tego modułu nie używa.
 */

export type ModelRole = "front" | "blat" | "uchwyt";

export const ROLE_LABEL: Record<ModelRole, string> = {
  front: "Front",
  blat: "Blat",
  uchwyt: "Uchwyt",
};

export type PublicModel = {
  id: string;
  name: string;
  url: string;
  /** Nazwa elementu (węzła) w pliku -> rola. */
  tags: Record<string, ModelRole>;
};

export type Selection = { front: string; countertop: string; hardware: string };

type Look = {
  color?: string;
  roughness: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** false = zostaw teksturę z modelu (tylko podbarwiamy). */
  dropMap?: boolean;
  hidden?: boolean;
  /** Zostaw materiał z modelu bez zmian. */
  original?: boolean;
};

// Fronty z katalogu na dowolnym modelu: gładki kolor próbki (usłojenie dębu jest tylko w kuchni demo).
const FRONT_ROUGHNESS: Record<string, number> = {
  "dab-naturalny": 0.65,
  "dab-bielony": 0.7,
  "dab-wedzony": 0.6,
  kaszmir: 0.5,
  grafit: 0.45,
};

const COUNTERTOP_LOOK: Record<string, Look> = {
  "kwarcyt-calacatta": { original: true, roughness: 0.4 },
  "granit-absolute-black": { color: "#09090a", roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1, dropMap: true },
  "laminat-dab": { color: "#b8875a", roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.45, dropMap: true },
};

const HARDWARE_LOOK: Record<string, Look> = {
  mosiadz: { color: "#b08d57", metalness: 1, roughness: 0.3, dropMap: true },
  "czarny-mat": { color: "#1c1b1a", metalness: 0.15, roughness: 0.6, dropMap: true },
  "push-to-open": { hidden: true, roughness: 0.5 },
};

export function lookFor(role: ModelRole, sel: Selection, palettes: Palette[]): Look {
  if (role === "front") {
    const ral = findRalFront(palettes, sel.front);
    if (ral) {
      const f = FINISH_LOOK[ral.finish ?? "satyna"];
      return { color: ral.color, roughness: f.roughness, clearcoat: f.clearcoat, clearcoatRoughness: f.clearcoatRoughness, dropMap: true };
    }
    const swatch = FRONTS.find((f) => f.id === sel.front) ?? FRONTS[0];
    return { color: swatch.color, roughness: FRONT_ROUGHNESS[swatch.id] ?? 0.5, clearcoat: 0.4, clearcoatRoughness: 0.3, dropMap: true };
  }
  if (role === "blat") return COUNTERTOP_LOOK[sel.countertop] ?? { original: true, roughness: 0.4 };
  return HARDWARE_LOOK[sel.hardware] ?? { original: true, roughness: 0.4 };
}

/** Wszystkie siatki pod elementem o danej nazwie (element = węzeł z pliku). */
export function meshesOf(root: Object3D, name: string): Mesh[] {
  const node = root.getObjectByName(name);
  const out: Mesh[] = [];
  node?.traverse((o) => {
    if (o instanceof Mesh) out.push(o);
  });
  return out;
}

/** Rola każdej siatki (ostatnie oznaczenie wygrywa, więc dziecko może nadpisać rodzica). */
export function meshRoles(root: Object3D, tags: Record<string, ModelRole>) {
  const roles = new Map<Mesh, ModelRole>();
  // Najpierw elementy wyżej w drzewie, potem niżej: dokładniejsze oznaczenie wygrywa.
  const depth = (o: Object3D | null): number => (o?.parent ? 1 + depth(o.parent) : 0);
  const named = Object.keys(tags)
    .map((name) => ({ name, node: root.getObjectByName(name) }))
    .filter((x) => x.node)
    .sort((a, b) => depth(a.node!) - depth(b.node!));
  for (const { name } of named) for (const m of meshesOf(root, name)) roles.set(m, tags[name]);
  return roles;
}

const originalOf = (mesh: Mesh): Material =>
  (mesh.userData.roleOriginal as Material | undefined) ?? (mesh.userData.roleOriginal = mesh.material as Material);

/**
 * Nakłada kolory z wyboru na oznaczone elementy. Zwraca funkcję sprzątającą
 * (przywraca materiały z pliku). Klony materiałów są w pamięci podręcznej per wygląd.
 */
export function applyRoles(root: Object3D, tags: Record<string, ModelRole>, sel: Selection, palettes: Palette[]) {
  const roles = meshRoles(root, tags);
  const clones = new Map<string, Material>();
  roles.forEach((role, mesh) => {
    const original = originalOf(mesh);
    if (Array.isArray(original) || !(original instanceof MeshStandardMaterial)) return;
    const look = lookFor(role, sel, palettes);
    mesh.visible = !look.hidden;
    if (look.original || look.hidden) {
      mesh.material = original;
      return;
    }
    const key = `${original.uuid}|${JSON.stringify(look)}`;
    let m = clones.get(key);
    if (!m) {
      const p = toPhysical(original.clone());
      if (look.dropMap) p.map = null;
      if (look.color) p.color.set(look.color);
      p.roughness = look.roughness;
      if (look.metalness !== undefined) p.metalness = look.metalness;
      p.clearcoat = look.clearcoat ?? 0;
      p.clearcoatRoughness = look.clearcoatRoughness ?? 0.3;
      p.needsUpdate = true;
      clones.set(key, p);
      m = p;
    }
    mesh.material = m;
  });
  return () => {
    roles.forEach((_, mesh) => {
      mesh.material = originalOf(mesh);
      mesh.visible = true;
    });
    clones.forEach((m) => m.dispose());
  };
}
