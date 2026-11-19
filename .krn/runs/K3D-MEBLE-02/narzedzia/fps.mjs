// FPS sceny 3D: ciągłe obracanie kamery myszą przez 5 s, liczymy klatki rAF, w których WebGL coś narysował.
// Użycie: node fps.mjs <baseUrl> <kreator|oferta> <desktop|telefon> <plan.json> [zrzut.png]
//   kreator – /kreator.html#projekt=<plan> (test kreatora bez konta, tylko desktop),
//   oferta  – /oferta/view.html?id=pomiar, API podmienione atrapą (Playwright route) z planem z pliku.
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const [base, widok, tryb, planPlik, zrzut] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planPlik, "utf8"));
const browser = await chromium.launch();
const ctx = tryb === "telefon" ? await browser.newContext({ ...devices["Pixel 7"] }) : await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const w = window;
  w.__rys = 0;
  w.__klatki = 0;
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const f of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
      const o = P[f];
      if (o) P[f] = function (...a) { w.__rys++; return o.apply(this, a); };
    }
  }
  let ost = 0;
  const tick = () => {
    if (w.__rys !== ost) { w.__klatki++; ost = w.__rys; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

async function link(p) {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, typ: "kuchnia", title: "Pomiar", plan: p, front: "dab-naturalny", countertop: "kwarcyt-calacatta", hardware: "czarny-mat" }));
  const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const buf = Buffer.from(await new Response(cs).arrayBuffer());
  return "#projekt=" + buf.toString("base64url");
}

if (widok === "oferta") {
  await page.route("**/api/**", (route) => {
    const u = route.request().url();
    if (/\/api\/public\/pomiar(\?|$)/.test(u) && route.request().method() === "GET") {
      return route.fulfill({
        json: { offer: { id: "pomiar", title: "Pomiar FPS", who: "Test", front: "dab-naturalny", countertop: "kwarcyt-calacatta", hardware: "czarny-mat", showPrice: true, comments: false, base: 10000, expires: "2099-01-01", kuchnia: plan, wersja: null, zmiany: [], akceptacja: null } },
      });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(`${base}/oferta/view.html?id=pomiar`, { waitUntil: "networkidle" });
} else {
  await page.goto(`${base}/kreator.html${await link(plan)}`, { waitUntil: "networkidle" });
}
const odrzuc = page.getByRole("button", { name: "Odrzuć wszystkie" });
if (await odrzuc.isVisible().catch(() => false)) await odrzuc.click();
const canvas = page.locator("canvas").last();
await canvas.waitFor({ timeout: 30000 });
await canvas.scrollIntoViewIfNeeded();
await page.waitForTimeout(4000);
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const start = await page.evaluate(() => ({ k: window.__klatki, t: performance.now(), r: window.__rys }));
await page.mouse.move(cx, cy);
await page.mouse.down();
const t0 = Date.now();
let i = 0;
while (Date.now() - t0 < 5000) {
  await page.mouse.move(cx + Math.sin(i / 10) * 120, cy + Math.cos(i / 13) * 30);
  i++;
}
await page.mouse.up();
const end = await page.evaluate(() => ({ k: window.__klatki, t: performance.now(), r: window.__rys }));
const fps = ((end.k - start.k) * 1000) / (end.t - start.t);
const draw = (end.r - start.r) / Math.max(1, end.k - start.k);
if (zrzut) await page.screenshot({ path: zrzut });
console.log(JSON.stringify({ widok, tryb, fps: Math.round(fps * 10) / 10, drawCallsNaKlatke: Math.round(draw), canvas: `${Math.round(box.width)}x${Math.round(box.height)}` }));
await browser.close();
