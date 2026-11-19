// Plany do pomiarów i zrzutów: `npx tsx .krn/runs/K3D-MEBLE-02/narzedzia/plany.ts <nazwa>` wypisuje JSON planu.
import { planPokazowy } from "../../../../src/lib/pokaz";

const plany: Record<string, () => unknown> = {
  pokaz: () => planPokazowy(),
};
const nazwa = process.argv[2] ?? "pokaz";
const f = plany[nazwa];
if (!f) throw new Error(`Nieznany plan: ${nazwa} (są: ${Object.keys(plany).join(", ")})`);
process.stdout.write(JSON.stringify(f()));
