/* Kreator w przeglądarce bez WebGL (wyłączona akceleracja, stary sterownik) – audyt OR1: wcześniej „Application error”. */
import { expect, test } from "@playwright/test";
import { bezCookies } from "./pomoc";

test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] } });

test("kreator działa i pokazuje komunikat zamiast podglądu 3D", async ({ page }) => {
  const bledy: string[] = [];
  page.on("pageerror", (e) => bledy.push(e.message));
  await page.goto("/kreator");
  await bezCookies(page);
  await expect(page.getByText("Podgląd 3D jest niedostępny w tej przeglądarce").first()).toBeVisible();
  await expect(page.getByText("Application error")).toHaveCount(0);
  // Reszta kreatora działa: kroki i PDF.
  await page.getByRole("button", { name: /Klient i/ }).first().click();
  await expect(page.getByRole("button", { name: "Pobierz PDF" }).first()).toBeVisible();
  expect(bledy.filter((b) => /WebGL/i.test(b))).toEqual([]);
});
