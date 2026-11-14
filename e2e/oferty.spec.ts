/* Szybka oferta → kreator, PDF z kreatora, rozkrój z listy. */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { bezCookies, zalogowanaFirma } from "./pomoc";

test("szybka oferta: łazienka trafia do kreatora jako łazienka, klient wymagany", async ({ page }) => {
  await zalogowanaFirma(page);
  await page.goto("/panel/szybka");
  await bezCookies(page);
  await page.getByLabel("Opis").fill("łazienka, umywalka 60");
  // Od razu „Dalej” (bez czekania na rozpoznanie) – bez klienta nie przejdzie.
  await page.getByRole("button", { name: /Dalej w kreatorze/ }).click();
  await expect(page.getByText("Wpisz klienta – bez tego nie przejdziesz dalej.")).toBeVisible();
  await page.getByLabel("Klient (wymagany)").fill("Ewa Testowa");
  await page.getByRole("button", { name: /Dalej w kreatorze/ }).click();
  await expect(page).toHaveURL(/\/panel\/kreator\?typ=lazienka/);
  await expect(page.locator(".crumb")).toContainText("Kreator łazienki");
  await expect(page.getByText("Szafka pod umywalkę 60").first()).toBeVisible();
});

test("kreator bez konta: PDF oferty pobiera się jako plik", async ({ page }) => {
  await page.goto("/kreator");
  await bezCookies(page);
  await page.getByRole("button", { name: /Klient i/ }).first().click();
  const [plik] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Pobierz PDF" }).first().click()]);
  expect(plik.suggestedFilename()).toMatch(/\.pdf$/);
  const sciezka = await plik.path();
  const dane = readFileSync(sciezka!);
  expect(dane.subarray(0, 4).toString()).toBe("%PDF");
  expect(dane.length).toBeGreaterThan(50_000);
});

test("rozkrój z wklejonej listy i PDF formatek", async ({ page }) => {
  await zalogowanaFirma(page);
  await page.goto("/panel/rozkroj");
  await bezCookies(page);
  await page.getByRole("radio", { name: "Wklej listę" }).click();
  await page.getByRole("button", { name: "Wstaw przykład" }).click();
  await expect(page.getByTestId("pr-suma")).toContainText("formatek");
  const [plik] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Pobierz PDF" }).click()]);
  expect(readFileSync((await plik.path())!).subarray(0, 4).toString()).toBe("%PDF");
});
