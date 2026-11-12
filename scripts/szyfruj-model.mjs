/*
 * Szyfruje model 3D strony (AES-256-GCM), żeby w public/ i w repo nie leżał zwykły plik GLB.
 *
 *   node scripts/szyfruj-model.mjs [wejście.glb] [wyjście.enc]
 *
 * Domyślnie: modele-zrodlowe/kitchen-opt.glb -> public/models/kitchen.enc
 * Klucz: zmienna MODEL_KEY (64 znaki hex) albo wpis MODEL_KEY=… w .dev.vars.
 * Bez klucza skrypt wygeneruje nowy, dopisze go do .dev.vars i wypisze, co ustawić w Cloudflare.
 *
 * Format pliku: 12 bajtów IV + szyfrogram AES-GCM (z tagiem na końcu).
 */
import { webcrypto as crypto } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const input = process.argv[2] ?? "modele-zrodlowe/kitchen-opt.glb";
const output = process.argv[3] ?? "public/models/kitchen.enc";

function keyFromDevVars() {
  if (!existsSync(".dev.vars")) return "";
  const m = readFileSync(".dev.vars", "utf8").match(/^MODEL_KEY=([0-9a-fA-F]{64})\s*$/m);
  return m ? m[1] : "";
}

let hex = (process.env.MODEL_KEY ?? "").trim() || keyFromDevVars();
let generated = false;
if (!hex) {
  hex = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  generated = true;
}
if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
  console.error("MODEL_KEY musi mieć 64 znaki hex (32 bajty).");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`Nie ma pliku ${input}.`);
  process.exit(1);
}

const key = await crypto.subtle.importKey("raw", Buffer.from(hex, "hex"), "AES-GCM", false, ["encrypt"]);
const iv = crypto.getRandomValues(new Uint8Array(12));
const plain = readFileSync(input);
const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([Buffer.from(iv), Buffer.from(cipher)]));
console.log(`Zapisano ${output} (${(plain.length / 1e6).toFixed(1)} MB).`);

if (generated) {
  appendFileSync(".dev.vars", `${existsSync(".dev.vars") ? "\n" : ""}MODEL_KEY=${hex}\n`);
  console.log("Wygenerowano nowy klucz i dopisano go do .dev.vars (plik w .gitignore).");
  console.log("Przed wdrożeniem ustaw ten sam klucz w Cloudflare: Settings -> Variables and Secrets -> MODEL_KEY (Secret).");
}
