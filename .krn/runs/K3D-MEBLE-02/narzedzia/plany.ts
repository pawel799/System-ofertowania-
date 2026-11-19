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
const nazwa = process.argv[2] ?? "pokaz";
const f = plany[nazwa];
if (!f) throw new Error(`Nieznany plan: ${nazwa} (są: ${Object.keys(plany).join(", ")})`);
process.stdout.write(JSON.stringify(f()));
