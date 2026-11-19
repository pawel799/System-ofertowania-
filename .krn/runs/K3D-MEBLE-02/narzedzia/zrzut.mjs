// Zrzut sceny 3D kreatora z planem: zamknięte i otwarte drzwi / szuflady.
// Użycie: node zrzut.mjs <baseUrl> <plan.json> <prefiks-wyjścia> [przybliżenie=6] [obrót px=0] [w górę px=0]
//   → <prefiks>-zamkniete.png, <prefiks>-otwarte.png (scena 3D na pełnym ekranie, 1440×900)
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [base, planPlik, wyj, zoomA = "6", obrotA = "0", goraA = "0"] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planPlik, "utf8"));
const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, typ: "kuchnia", title: "Zrzut", plan, front: "dab-bielony", countertop: "kwarcyt-calacatta", hardware: "czarny-mat" }));
const buf = Buffer.from(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage();
const bledy = [];
page.on("pageerror", (e) => bledy.push(String(e)));
await page.goto(`${base}/kreator#projekt=${buf.toString("base64url")}`, { waitUntil: "load", timeout: 120000 });
const odrzuc = page.getByRole("button", { name: "Odrzuć wszystkie" });
if (await odrzuc.isVisible().catch(() => false)) await odrzuc.click();
const canvas = page.locator("canvas").last();
await canvas.waitFor({ timeout: 60000 });
await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Pełny ekran" }).last().click();
await page.waitForTimeout(1500);
const wym = page.getByRole("button", { name: "Wymiary" });
if ((await wym.getAttribute("aria-pressed").catch(() => null)) === "true") await wym.click();
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
for (let i = 0; i < Number(zoomA); i++) {
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(120);
}
if (Number(obrotA) || Number(goraA)) {
  // Obrót zaczyna się na pustej podłodze (lewy dolny róg), nie na meblu – inaczej przeciąga się mebel.
  const sx = box.x + box.width * 0.12, sy = box.y + box.height * 0.9;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + Number(obrotA), sy + Number(goraA), { steps: 15 });
  await page.mouse.up();
}
await page.waitForTimeout(2500);
await canvas.screenshot({ path: `${wyj}-zamkniete.png` });
await page.getByRole("button", { name: /Otwórz drzwi i szuflady/ }).first().click();
await page.waitForTimeout(2500);
await canvas.screenshot({ path: `${wyj}-otwarte.png` });
console.log(JSON.stringify({ ok: true, bledy }));
await browser.close();
