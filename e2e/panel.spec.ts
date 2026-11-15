/* Panel nowego konta: „Pierwsze kroki” i kopia zapasowa ofert (JSON + CSV). */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { bezCookies, zalogowanaFirma } from "./pomoc";

test("nowe konto widzi pierwsze kroki", async ({ page }) => {
  await zalogowanaFirma(page);
  await page.goto("/panel");
  await bezCookies(page);
  const karta = page.getByRole("region", { name: "Pierwsze kroki" });
  await expect(karta).toBeVisible();
  await expect(karta).toContainText("0 z 4");
  await expect(karta.getByRole("link", { name: "Dodaj logo" })).toBeVisible();
  await karta.getByRole("button", { name: "Ukryj" }).click();
  await expect(karta).toBeHidden();
});

test("kopia zapasowa: JSON i CSV", async ({ page }) => {
  await zalogowanaFirma(page);
  await page.goto("/panel/ustawienia?tab=konto");
  await bezCookies(page);
  const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Pobierz kopię (JSON)" }).click()]);
  const kopia = JSON.parse(readFileSync((await json.path())!, "utf8"));
  expect(Array.isArray(kopia.oferty)).toBe(true);
  expect(kopia.cennik).toBeTruthy();
  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Lista ofert (CSV)" }).click()]);
  expect(readFileSync((await csv.path())!, "utf8")).toMatch(/^﻿Numer;Tytuł;Klient/);
});
