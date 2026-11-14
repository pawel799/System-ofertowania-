/* Błąd JavaScript na stronie trafia do listy administratora (Ustawienia → Błędy), bez parametrów z adresu. */
import { expect, test } from "@playwright/test";
import { ADMIN } from "./pomoc";

test("błąd z przeglądarki widać w zakładce administratora", async ({ page, playwright, baseURL }) => {
  const znak = `blad-e2e-${Date.now()}`;
  await page.goto("/cennik?t=tajny-token#projekt=xyz");
  await page.evaluate((m) => setTimeout(() => { throw new Error(m); }), znak);
  const admin = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { authorization: `Bearer ${ADMIN}` } });
  let blad: { msg: string; sciezki: string[]; ile: number } | undefined;
  await expect
    .poll(async () => {
      const lista = (await (await admin.get("/api/bledy")).json()).bledy as { msg: string; sciezki: string[]; ile: number }[];
      blad = lista.find((b) => b.msg.includes(znak));
      return !!blad;
    })
    .toBe(true);
  expect(blad!.sciezki).toEqual(["/cennik"]);
  expect((await admin.get("/api/bledy", { headers: { authorization: "Bearer zly" } })).status()).toBe(401);
  await admin.dispose();
});
