import {
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from "three";
import { HARDWARE, getHardware, subscribeHardware } from "./hardwareStore";

/*
 * Podmiana okuć (uchwytów) w modelu 3D po wyborze w MaterialsPanel.
 *
 * Wymaga, by uchwyty były w modelu osobną bryłą z własnym materiałem o nazwie
 * HANDLE_MATERIAL. W kitchen-opt.glb z października ich nie było – cała metalowa
 * drobnica (bateria, reling, wieszaki) siedzi w jednym materiale "Chrome", więc
 * dopóki uchwyty nie zostaną rozdzielone, ta funkcja nic nie znajduje i nic nie
 * robi (wybór w panelu zmienia wtedy tylko wycenę).
 */
const HANDLE_MATERIAL = "Handles";

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
