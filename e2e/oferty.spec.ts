/* Szybka oferta → kreator, PDF z kreatora, rozkrój z listy. */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { modulCena, type ModulCennik } from "../src/lib/modul";
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

test("rozkrój: komunikaty przy złych wierszach, okleina odejmowana, DXF i etykiety", async ({ page }) => {
  await zalogowanaFirma(page);
  await page.goto("/panel/rozkroj");
  await bezCookies(page);
  await page.getByRole("radio", { name: "Wklej listę" }).click();
  await page.getByLabel("Lista formatek").fill(
    ["Nazwa;Materiał;Długość;Szerokość;Ilość;Okleina", "Bok;Biały 18 mm;720;560;2;D1", "Wieniec;Biały 18 mm;563,5;560;1;dookoła", "Zero;Biały 18 mm;0;560;1;D1", "Brak;Biały 18 mm;400;300;0;D1"].join("\n"),
  );
  const bledy = page.getByRole("alert", { name: "Problemy z listą" });
  await expect(bledy).toContainText("Wiersz 4: wymiar 0 mm");
  await expect(bledy).toContainText("Wiersz 5: ilość 0");
  await expect(page.getByTestId("pr-suma")).toContainText("3 formatek");
  // Pół milimetra zostaje (bez cichego zaokrąglenia).
  await expect(page.getByRole("cell", { name: "563,5" })).toBeVisible();

  await page.locator("summary", { hasText: "Ustawienia cięcia" }).click();
  await page.getByLabel("Wymiary w liście").selectOption("2");
  // 563,5 z okleiną dookoła: 563,5 − 2 × 2 = 559,5 do cięcia, gotowy wymiar obok.
  await expect(page.getByRole("cell", { name: "559,5" })).toBeVisible();
  await expect(page.getByText("gotowa 563,5×560")).toBeVisible();
  await page.getByLabel("Rzaz piły").fill("0");
  await page.getByLabel("Rzaz piły").press("Enter");
  await expect(page.getByText(/Rzaz 0 mm: formatki stykają się/)).toBeVisible();

  const [dxf] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Pobierz DXF" }).click()]);
  const tresc = readFileSync((await dxf.path())!, "utf8");
  expect(tresc).toContain("ENTITIES");
  expect(tresc).toContain("FORMATKI");
  expect(tresc.trimEnd().endsWith("EOF")).toBe(true);
  const [ety] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Etykiety PDF" }).click()]);
  expect(readFileSync((await ety.path())!).subarray(0, 4).toString()).toBe("%PDF");
});

test("szafki na wymiar z ceną z cennika wchodzą do wyceny netto (panel i klient)", async ({ page }) => {
  await zalogowanaFirma(page);
  const cennik = (await (await page.request.get("/api/settings/cennik")).json()) as ModulCennik | { cennik: ModulCennik };
  const c = "cennik" in cennik ? cennik.cennik : cennik;
  const szafka = { nazwa: "Szafka dolna", w: 60, h: 72, d: 56 };
  const slug = `E2Eszafki${Date.now()}`;
  const r = await page.request.post("/api/offers", {
    data: {
      id: "E2E-SZAFKI/1",
      title: "Szafki w sumie",
      client: "Klient E2E",
      greet: null,
      contact: "",
      layout: "L",
      base: 10_000,
      front: "dab-naturalny",
      countertop: "kwarcyt-calacatta",
      hardware: "mosiadz",
      moduly: [szafka],
      status: "wyslany",
      link: { slug, days: 30, expires: "2099-01-01", pin: null, comments: true, showPrice: true, channel: "email", views: 0 },
      events: [],
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  // Klient: szacunek = kwota oferty + szafka z cennika.
  const pub = (await (await page.request.get(`/api/public/${slug}`)).json()) as { offer: { base: number } };
  expect(pub.offer.base).toBe(10_000 + modulCena(szafka, c));
  // Panel: osobny wiersz z kwotą szafek.
  await page.goto("/panel");
  await bezCookies(page);
  await page.getByText("Szafki w sumie").first().click();
  await expect(page.getByTestId("szafki-w-wycenie")).toContainText(String(modulCena(szafka, c)).replace(/\B(?=(\d{3})+(?!\d))/g, " "));
});
