// Plany do pomiarów i zrzutów: `npx tsx .krn/runs/K3D-MEBLE-02/narzedzia/plany.ts <nazwa>` wypisuje JSON planu.
import { planPokazowy } from "../../../../src/lib/pokaz";
import { dodajElement, PRESETY, pustyPlan, type ElementKuchni, type PlanKuchni, type Sciana } from "../../../../src/lib/kuchnia";

const preset = (id: string) => {
  const p = PRESETY.find((x) => x.id === id);
  if (!p) throw new Error(`Brak presetu ${id}`);
  return { nazwa: p.nazwa, strefa: p.strefa, rodzaj: p.rodzaj, w: p.w, h: p.h, d: p.d, zrodlo: "modul" as const };
};
/** Plan z presetów; `zmiany` – nadpisanie pól kolejnych elementów (np. hinge). */
function zPresetow(uklad: "ciag" | "L", lista: [string, Sciana, Partial<ElementKuchni>?][], scianaA = 300, scianaB = 240): PlanKuchni {
  let plan: PlanKuchni = { ...pustyPlan(uklad), scianaA, scianaB };
  for (const [id, sciana, zm] of lista) {
    plan = dodajElement(plan, preset(id), sciana);
    if (zm) plan = { ...plan, elementy: plan.elementy.map((e, i) => (i === plan.elementy.length - 1 ? { ...e, ...zm } : e)) };
  }
  return plan;
}

const plany: Record<string, () => unknown> = {
  pokaz: () => planPokazowy(),
  zawiasy: () => zPresetow("ciag", [["dolna-60", "A"], ["dolna-60", "A", { hinge: "P" }], ["gorna-60", "A"], ["gorna-60", "A", { hinge: "P" }]], 200),
  "cargo-dolne": () => zPresetow("ciag", [["dolna-60", "A"], ["cargo-30", "A"], ["dolna-60", "A"]], 200),
  "cargo-wysokie": () => zPresetow("ciag", [["slupek-60", "A"], ["cargo-wysokie-30", "A"], ["dolna-60", "A"]], 200),
};
/** Narożnik L: LeMans na ścianie A przy narożniku, szafka prostopadła ze ściany B przed częścią ślepą. */
function lemans(strona: "L" | "P"): PlanKuchni {
  const lm = (o: Partial<ElementKuchni>): ElementKuchni => ({ id: "lemans01", nazwa: `Narożnik LeMans 110 ${strona}`, zrodlo: "modul", strefa: "dolna", rodzaj: "lemans", w: 110, h: 72, d: 56, x: 55, z: 28, rot: 0, ...o });
  const sz = (o: Partial<ElementKuchni>): ElementKuchni => ({ id: "szafkab1", nazwa: "Szafka dolna 60", zrodlo: "modul", strefa: "dolna", rodzaj: "szafka", w: 60, h: 72, d: 56, x: 28, z: 86, rot: 90, ...o });
  if (strona === "L") return { ...pustyPlan("L"), scianaA: 240, scianaB: 200, elementy: [lm({}), sz({}), sz({ id: "szafkaa1", x: 140, z: 28, rot: 0 })] };
  // P: narożnik po prawej – LeMans przy prawym końcu ściany A (ściana A 240 cm), szafka prostopadła po prawej.
  return { ...pustyPlan("ciag"), scianaA: 240, scianaB: 200, elementy: [lm({ x: 185, lemans: { strona: "P", blenda: 70, front: 450 } }), sz({ x: 212, rot: 270 }), sz({ id: "szafkaa1", x: 100, z: 28, rot: 0 })] };
}

plany["lemans-L"] = () => lemans("L");
plany.waterfall = () => zPresetow("ciag", [["dolna-60", "A"], ["cargo-30", "A"], ["dolna-80", "A", { waterfall: "P" }]], 240);
plany["lemans-P"] = () => lemans("P");

const nazwa = process.argv[2] ?? "pokaz";
const f = plany[nazwa];
if (!f) throw new Error(`Nieznany plan: ${nazwa} (są: ${Object.keys(plany).join(", ")})`);
process.stdout.write(JSON.stringify(f()));
