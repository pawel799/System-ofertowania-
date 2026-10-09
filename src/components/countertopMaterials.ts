import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import {
  COUNTERTOPS,
  getCountertop,
  subscribeCountertop,
} from "./countertopStore";

/*
 * Podmiana materiału blatu w modelu 3D po wyborze w MaterialsPanel.
 *
 * Blat w kitchen-opt.glb to materiał "Countertop" (siatka "Cabinets_Countertop_0"):
 * jedna bryła, czyli długi blat przy ścianie razem z wyspą.
 */
const WORKTOP_MATERIAL = "Countertop";
// Z tego materiału pożyczamy teksturę dębu (jest już w pliku GLB).
const OAK_MATERIAL = "OakWood";

type WorktopLook =
  // Kwarcyt z modelu bez zmian.
  | { kind: "original" }
  // Kamień: tekstura kwarcytu przemnożona przez kolor (liniowy RGB, <1 przyciemnia).
  | {
      kind: "stone";
      tint: [number, number, number];
      roughness: number;
      clearcoat: number;
    }
  // Laminat: usłojenie dębu pożyczone z modelu.
  | { kind: "oak"; tint: [number, number, number]; roughness: number };

// Klucze = id z COUNTERTOPS (countertopStore.ts).
const LOOKS: Record<string, WorktopLook> = {
  "kwarcyt-calacatta": { kind: "original" },
  "granit-absolute-black": {
    kind: "stone",
    tint: [0.06, 0.06, 0.065],
    roughness: 0.2,
    clearcoat: 0.8,
  },
  "laminat-dab": { kind: "oak", tint: [1.15, 1, 0.82], roughness: 0.5 },
};

type Target = { mesh: Mesh; original: Material };

/**
 * Tworzy warianty materiału blatu (raz na każdą opcję), nakłada wybrany
 * i podmienia go przy każdej zmianie. Zwraca funkcję sprzątającą:
 * przywraca oryginalne materiały i zwalnia klony.
 * Wywoływać po prepareKitchenModel (klonujemy już poprawiony materiał z lakierem).
 */
export function installCountertopSwap(root: Object3D, onChange: () => void) {
  const targets: Target[] = [];
  const found: { oakMap?: Texture } = {};

  root.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    // Oryginał trzymamy w userData: scena z useGLTF jest w pamięci podręcznej
    // i przy ponownym montowaniu siatka mogłaby mieć jeszcze klon.
    const original =
      (object.userData.worktopOriginal as Material | undefined) ??
      object.material;
    if (
      original instanceof MeshStandardMaterial &&
      original.name === OAK_MATERIAL &&
      original.map
    ) {
      found.oakMap = original.map;
    }
    if (original.name === WORKTOP_MATERIAL) {
      object.userData.worktopOriginal = original;
      targets.push({ mesh: object, original });
    }
  });

  const variants = new Map<Material, Map<string, Material>>();
  for (const { original } of targets) {
    if (variants.has(original) || !(original instanceof MeshStandardMaterial))
      continue;
    const byId = new Map<string, Material>();
    for (const option of COUNTERTOPS) {
      const look = LOOKS[option.id];
      // Brak wpisu albo wariant „jak w modelu” – zostaje oryginał, bez klonu.
      if (!look || look.kind === "original") {
        byId.set(option.id, original);
        continue;
      }
      const m = original.clone();
      m.name = `${original.name}__${option.id}`;
      if (look.kind === "oak") {
        m.map = found.oakMap ?? null;
      }
      m.color.setRGB(...look.tint);
      m.roughness = look.roughness;
      if (m instanceof MeshPhysicalMaterial) {
        // Kamień polerowany ma mocniejszy, ostrzejszy lakier niż laminat.
        m.clearcoat = look.kind === "stone" ? look.clearcoat : 0.2;
        m.clearcoatRoughness = look.kind === "stone" ? 0.1 : 0.45;
      }
      m.needsUpdate = true;
      byId.set(option.id, m);
    }
    variants.set(original, byId);
  }

  const apply = () => {
    const id = getCountertop();
    for (const { mesh, original } of targets) {
      mesh.material = variants.get(original)?.get(id) ?? original;
    }
    onChange();
  };

  apply();
  const unsubscribe = subscribeCountertop(apply);

  return () => {
    unsubscribe();
    for (const { mesh, original } of targets) mesh.material = original;
    // Tekstury są wspólne z modelem, więc zwalniamy tylko same klony.
    variants.forEach((byId, original) =>
      byId.forEach((m) => {
        if (m !== original) m.dispose();
      }),
    );
  };
}
