import {
  FrontSide,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Material,
  type Object3D,
} from "three";

/*
 * Poprawki materiałów modelu kuchni (po wczytaniu, w przeglądarce).
 * Oryginalne tekstury zostają – zmieniamy tylko parametry: chropowatość,
 * metaliczność, lakier (clearcoat) i to, czy powierzchnia jest dwustronna.
 * Nazwy materiałów pochodzą z pliku kitchen.glb (eksport ze Sketchfaba).
 */

// Fronty lakierowane: dostają warstwę lakieru (clearcoat).
const LACQUERED = new Set([
  "Closet",
  "ClosetGlossy",
  "Night_River_Black_Front",
]);
// Blaty (kamień / kwarcyt): delikatny połysk.
const WORKTOP = new Set(["Countertop"]);
// Metale (uchwyty, baterie, okapy, AGD).
const METALS = new Set([
  "Chrome",
  "Metal",
  "Bright_Metal",
  "Brushed_Metal1",
  "Brushed_Metal1.001",
  "Aluminum",
  "Aluminium",
  "Aluminium_Bright",
]);
// Ręcznie ustawiona chropowatość dla materiałów, które w modelu są „lustrzane”.
const ROUGHNESS: Record<string, number> = {
  Black: 0.42,
  Grey: 0.32,
  Charcoal: 0.45,
  LampFrame: 0.35,
  ClosetGlossy: 0.5,
  Night_River_Black: 0.18,
  Metal: 0.22,
  Bright_Metal: 0.3,
  Brushed_Metal1: 0.35,
  "Brushed_Metal1.001": 0.35,
};

function isGlass(m: MeshStandardMaterial) {
  return m.transparent || m.opacity < 1 || /glass/i.test(m.name);
}

export function toPhysical(m: MeshStandardMaterial): MeshPhysicalMaterial {
  if (m instanceof MeshPhysicalMaterial) return m;
  const physical = new MeshPhysicalMaterial();
  // Kopiujemy wszystkie parametry i tekstury materiału standardowego.
  MeshStandardMaterial.prototype.copy.call(physical, m);
  physical.defines = { STANDARD: "", PHYSICAL: "" };
  return physical;
}

function tweakMaterial(source: Material): Material {
  if (!(source instanceof MeshStandardMaterial)) return source;
  let m: MeshStandardMaterial = source;
  const name = m.name;

  if (isGlass(m)) {
    // Szkło: niemetaliczne, gładkie, zostaje dwustronne.
    m.metalness = 0;
    m.roughness = Math.min(m.roughness, 0.05);
    return m;
  }

  // Nieprzezroczyste powierzchnie: tylko przednia strona (mniej artefaktów cieni).
  m.side = FrontSide;

  if (name in ROUGHNESS) m.roughness = ROUGHNESS[name];

  if (METALS.has(name)) {
    m.metalness = 1;
    m.roughness = Math.max(m.roughness, 0.22);
  } else if (!m.metalnessMap && m.metalness > 0) {
    // Niemetal bez mapy metaliczności nie powinien być metalem.
    m.metalness = 0;
  }

  // Idealnie gładkie, „plastikowe” powierzchnie wyglądają sztucznie.
  if (!m.roughnessMap && m.roughness < 0.08) m.roughness = 0.15;

  if (LACQUERED.has(name)) {
    const p = toPhysical(m);
    p.clearcoat = 0.6;
    p.clearcoatRoughness = 0.28;
    m = p;
  } else if (WORKTOP.has(name)) {
    const p = toPhysical(m);
    p.clearcoat = 0.45;
    p.clearcoatRoughness = 0.12;
    m = p;
  }

  m.needsUpdate = true;
  return m;
}

/** Ustawia cienie i poprawia materiały całego modelu (tylko raz na model). */
export function prepareKitchenModel(root: Object3D) {
  if (root.userData.kitchenPrepared) return;
  root.userData.kitchenPrepared = true;

  const converted = new Map<Material, Material>();
  const convert = (m: Material) => {
    let result = converted.get(m);
    if (!result) {
      result = tweakMaterial(m);
      converted.set(m, result);
    }
    return result;
  };

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(convert)
      : convert(object.material);

    const materials: Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const transparent = materials.some((m) => m.transparent || m.opacity < 1);
    // Ściany i sufit nie rzucają cienia – inaczej „okno” nie oświetliłoby wnętrza.
    const isShell = /^Walls/i.test(object.name);
    // Emisyjne oprawki lamp też nie rzucają cieni.
    const isLight = materials.some((m) => m.name === "Light");

    object.castShadow = !transparent && !isShell && !isLight;
    object.receiveShadow = !transparent;
  });
}
