// Stara oferta (kuchnia pokazowa z main) – parser, cena, formatki i dane PDF; wynik JSON do porównania main ↔ gałąź.
import { planPokazowy } from "@/lib/pokaz";
import { parseKuchnia, bazaKuchni } from "@/lib/kuchnia";
import { DEFAULT_CENNIK } from "@/lib/modul";
import { formatkiProjektu } from "@/components/produkcja/formatki";
import { frontyElementu } from "@/components/rysunek/rysunekTechniczny";
const plan = JSON.parse(process.argv[2] ? require("fs").readFileSync(process.argv[2], "utf8") : JSON.stringify(planPokazowy()));
const p = parseKuchnia(plan);
const f = formatkiProjektu(p, { material: (_e, c) => ({ klucz: c, nazwa: c, grubosc: 18, sloje: false, rodzaj: "plyta" }), uchwyt: () => ({ nazwa: "u", bez: false }), blat: "b" });
process.stdout.write(JSON.stringify({ planBezZmian: JSON.stringify(p) === JSON.stringify(plan), baza: bazaKuchni(p, DEFAULT_CENNIK), formatki: f.formatki, okucia: f.okucia, blaty: f.blaty, fronty: p.elementy.map(frontyElementu) }));
