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
import { findCountertop, LOOK_WYKONCZENIA, parseKatRef } from "./katalogFirmy";
import { getKatalog, subscribeKatalog } from "./katalogStore";

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
    // Bardzo ciemny mnożnik: przy 0.06 jasny kwarcyt prześwitywał na szarobrązowo.
    tint: [0.012, 0.012, 0.014],
    roughness: 0.3,
    clearcoat: 0.15,
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
      // Ciemny kamień: ciepła panorama HDR w odbiciach dawała szarobrązowy odcień.
      // Do tego tekstura metaliczności kwarcytu robiła z części blatu metal – granit to dielektryk.
      if (look.kind === "stone") {
        m.envMapIntensity = 0.35;
        if (m instanceof MeshPhysicalMaterial) m.specularIntensity = 0.4;
        m.metalness = 0;
        m.metalnessMap = null;
        m.roughnessMap = null;
      }
      m.needsUpdate = true;
      byId.set(option.id, m);
    }
    variants.set(original, byId);
  }

  // Blat z katalogu firmy („cat:…”): kolor i wykończenie z pozycji, bez tekstury kamienia z modelu.
  const katVariant = (original: Material, id: string) => {
    const byId = variants.get(original);
    if (!byId || !(original instanceof MeshStandardMaterial) || !parseKatRef(id)) return undefined;
    const cached = byId.get(id);
    if (cached) return cached;
    const m = findCountertop(id, getKatalog());
    if (!m?.color) return undefined;
    const look = LOOK_WYKONCZENIA[(m.finish as keyof typeof LOOK_WYKONCZENIA) ?? "satyna"] ?? LOOK_WYKONCZENIA.satyna;
    const v = original.clone();
    v.name = `${original.name}__${id}`;
    v.map = null;
    v.color.set(m.color);
    v.roughness = look.roughness;
    if (v instanceof MeshPhysicalMaterial) {
      v.clearcoat = look.clearcoat;
      v.clearcoatRoughness = look.clearcoatRoughness;
    }
    v.needsUpdate = true;
    byId.set(id, v);
    return v;
  };

  const apply = () => {
    const id = getCountertop();
    for (const { mesh, original } of targets) {
      mesh.material = variants.get(original)?.get(id) ?? katVariant(original, id) ?? original;
    }
    onChange();
  };

  apply();
  const unsubscribe = subscribeCountertop(apply);
  const unsubscribeKatalog = subscribeKatalog(apply);

  return () => {
    unsubscribe();
    unsubscribeKatalog();
    for (const { mesh, original } of targets) mesh.material = original;
    // Tekstury są wspólne z modelem, więc zwalniamy tylko same klony.
    variants.forEach((byId, original) =>
      byId.forEach((m) => {
        if (m !== original) m.dispose();
      }),
    );
  };
}
