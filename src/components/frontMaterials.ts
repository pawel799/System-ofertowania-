import {
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { FRONTS, getFront, subscribeFront } from "./frontStore";
import { toPhysical } from "./kitchenMaterials";
import { getPalettes, subscribePalettes } from "./paletteStore";
import { FINISH_LOOK, findRalFront } from "./palettes";
import { findFront, LOOK_WYKONCZENIA, parseKatRef } from "./katalogFirmy";
import { getKatalog, subscribeKatalog } from "./katalogStore";

/*
 * Podmiana materiału frontów w modelu 3D po wyborze próbki w MaterialsPanel.
 *
 * Fronty w kitchen-opt.glb są z dwóch materiałów:
 * - "Closet"  – siatka "Cabinets_Closet_0": szafki dolne i słupki,
 * - "OakWood" – siatka "Cabinets_OakWood_0": szafki górne, lamele wyspy, półki.
 * Siatka dębowa trzyma też drobne akcesoria (deska, talerz, łopatka), więc one
 * zmieniają się razem z frontami – rozdzielić to można tylko w modelu.
 * NIE ruszamy: "White" (filar i boki), "Countertop" (blat, osobny wybór)
 * ani "PaletteMaterial001" (pas ściany za blatem razem z AGD).
 */
const FRONT_MATERIALS = new Set(["Closet", "OakWood"]);
// Z tego materiału bierzemy teksturę dębu (jest już w pliku GLB).
const OAK_MATERIAL = "OakWood";

type FrontLook =
  // Usłojenie dębu z modelu, przemnożone przez kolor (liniowy RGB; >1 rozjaśnia).
  | { kind: "oak"; tint: [number, number, number]; roughness: number }
  // Gładki front w kolorze próbki z panelu.
  | { kind: "solid"; roughness: number };

// Klucze = id z FRONTS (frontStore.ts). Brak klucza = gładki kolor próbki.
const LOOKS: Record<string, FrontLook> = {
  "dab-naturalny": { kind: "oak", tint: [1, 1, 1], roughness: 0.65 },
  "dab-bielony": { kind: "oak", tint: [1.9, 1.8, 1.6], roughness: 0.7 },
  "dab-wedzony": { kind: "oak", tint: [0.38, 0.28, 0.2], roughness: 0.6 },
  kaszmir: { kind: "solid", roughness: 0.5 },
  grafit: { kind: "solid", roughness: 0.45 },
};

type Target = { mesh: Mesh; original: Material };

/**
 * Tworzy warianty materiału frontów (raz na każdą próbkę), nakłada wybrany
 * i podmienia go przy każdej zmianie. Zwraca funkcję sprzątającą:
 * przywraca oryginalne materiały i zwalnia klony.
 * Wywoływać po prepareKitchenModel (klonujemy już poprawiony materiał z lakierem).
 */
export function installFrontSwap(root: Object3D, onChange: () => void) {
  const targets: Target[] = [];
  const found: { oakMap?: Texture } = {};

  root.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    // Oryginał trzymamy w userData: scena z useGLTF jest w pamięci podręcznej
    // i przy ponownym montowaniu siatka mogłaby mieć jeszcze klon.
    const original =
      (object.userData.frontOriginal as Material | undefined) ??
      object.material;
    if (
      original instanceof MeshStandardMaterial &&
      original.name === OAK_MATERIAL &&
      original.map
    ) {
      found.oakMap = original.map;
    }
    if (FRONT_MATERIALS.has(original.name)) {
      object.userData.frontOriginal = original;
      targets.push({ mesh: object, original });
    }
  });

  const variants = new Map<Material, Map<string, MeshStandardMaterial>>();
  for (const { original } of targets) {
    if (variants.has(original) || !(original instanceof MeshStandardMaterial))
      continue;
    const byId = new Map<string, MeshStandardMaterial>();
    for (const swatch of FRONTS) {
      const look: FrontLook = LOOKS[swatch.id] ?? {
        kind: "solid",
        roughness: 0.5,
      };
      // toPhysical: dębowa siatka ma materiał standardowy, a lakier (clearcoat)
      // musi wyjść tak samo na całej zabudowie.
      const m = toPhysical(original.clone());
      m.name = `${original.name}__${swatch.id}`;
      const oakBase = original.name === OAK_MATERIAL;
      if (look.kind === "oak" && (oakBase || found.oakMap)) {
        if (!oakBase) {
          // Siatka bez usłojenia: pożyczamy mapę dębu i jej chropowatość.
          m.map = found.oakMap ?? null;
          m.roughness = look.roughness;
        }
        m.color.setRGB(...look.tint);
      } else {
        m.map = null;
        m.color.set(swatch.color);
        m.roughness = look.roughness;
      }
      // Drewno: cienki, matowy lakier; gładkie fronty: wyraźniejszy połysk.
      m.clearcoat = look.kind === "oak" ? 0.15 : 0.5;
      m.clearcoatRoughness = look.kind === "oak" ? 0.5 : 0.25;
      m.needsUpdate = true;
      byId.set(swatch.id, m);
    }
    variants.set(original, byId);
  }

  // Kolor z pakietu RAL ("ral:…"): gładki front w kolorze RAL z połyskiem wg wykończenia.
  // Wariant powstaje przy pierwszym wyborze; próbki z katalogu działają jak wcześniej.
  const ralVariant = (original: Material, id: string) => {
    const byId = variants.get(original);
    if (!byId || !(original instanceof MeshStandardMaterial)) return undefined;
    const cached = byId.get(id);
    if (cached) return cached;
    // Kolor z pakietu RAL albo pozycja katalogu firmy („cat:…”): gładki front w kolorze z wykończeniem.
    const ral = findRalFront(getPalettes(), id) ?? (parseKatRef(id) ? findFront(id, [], getKatalog()) : undefined);
    if (!ral?.color) return undefined;
    const look = LOOK_WYKONCZENIA[(ral.finish as keyof typeof LOOK_WYKONCZENIA) ?? "satyna"] ?? FINISH_LOOK.satyna;
    const m = toPhysical(original.clone());
    m.name = `${original.name}__${id}`;
    m.map = null;
    m.color.set(ral.color);
    m.roughness = look.roughness;
    m.clearcoat = look.clearcoat;
    m.clearcoatRoughness = look.clearcoatRoughness;
    m.needsUpdate = true;
    byId.set(id, m);
    return m;
  };

  const apply = () => {
    const id = getFront();
    for (const { mesh, original } of targets) {
      mesh.material = variants.get(original)?.get(id) ?? ralVariant(original, id) ?? original;
    }
    onChange();
  };

  apply();
  const unsubscribe = subscribeFront(apply);
  // Pakiety RAL mogą dojść po wyborze frontu (oferta wczytuje się z API).
  const unsubscribePalettes = subscribePalettes(apply);
  const unsubscribeKatalog = subscribeKatalog(apply);

  return () => {
    unsubscribe();
    unsubscribePalettes();
    unsubscribeKatalog();
    for (const { mesh, original } of targets) mesh.material = original;
    // Tekstury są wspólne z modelem, więc zwalniamy tylko same klony.
    variants.forEach((byId) => byId.forEach((m) => m.dispose()));
  };
}
