/* Rejestracja: najpierw potwierdzenie e-maila, potem logowanie; zadania w tle. */
import { expect, test } from "@playwright/test";
import { ADMIN, bezCookies, CRON_SECRET, ip, linkPotwierdzenia, maileDo, nip, unikalny } from "./pomoc";

test("rejestracja nie loguje, link z maila potwierdza i loguje", async ({ page }) => {
  const email = unikalny("rejestracja");
  await page.setExtraHTTPHeaders(ip());
  await page.goto("/rejestracja");
  await bezCookies(page);
  await page.getByLabel("NIP firmy").fill(nip());
  await page.getByLabel("Nazwa firmy").fill("Stolarnia Rejestracja");
  await page.getByLabel("Imię i nazwisko").fill("Jan Test");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło").fill("Haslo12345!");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Załóż konto firmy" }).click();
  await expect(page.getByText("Sprawdź skrzynkę")).toBeVisible();
  await expect(page).toHaveURL(/\/rejestracja/);

  // Przed potwierdzeniem logowanie (dobre hasło) jest zablokowane.
  const przed = await page.request.post("/api/auth/login", { data: { email, haslo: "Haslo12345!" } });
  expect(przed.status()).toBe(403);
  expect((await przed.json()).error).toBe("email_unverified");

  const link = await linkPotwierdzenia(page.request, email);
  await page.goto(new URL(link).pathname + new URL(link).search);
  await expect(page.getByText("Adres e-mail potwierdzony")).toBeVisible();
  await expect(page).toHaveURL(/\/panel\/ustawienia/, { timeout: 15_000 });
  const me = await (await page.request.get("/api/auth/me")).json();
  expect(me.user.email).toBe(email);
  expect(me.user.emailVerified).toBe(true);

  // Powitanie po potwierdzeniu.
  await expect.poll(async () => (await maileDo(page.request, email)).some((m) => /Witaj w OP RZUT/.test(m.subject))).toBe(true);
  const po = await page.request.post("/api/auth/login", { data: { email, haslo: "Haslo12345!" } });
  expect(po.status()).toBe(200);
});

test("przypomnienie o końcu okresu próbnego wychodzi raz", async ({ request, playwright, baseURL }) => {
  // Administrator osobno – ciasteczko firmy (po potwierdzeniu) ma pierwszeństwo przed kodem administratora.
  const admin = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { authorization: `Bearer ${ADMIN}` } });
  const email = unikalny("trial");
  const nazwa = `Stolarnia Trial ${Date.now()}`;
  expect((await request.post("/api/auth/register", { headers: ip(), data: { firma: nazwa, nip: nip(), imie: "Ola", email, haslo: "Haslo12345!", zgoda: true } })).status()).toBe(201);
  const token = new URL(await linkPotwierdzenia(request, email)).searchParams.get("t");
  expect((await request.post("/api/auth/verify", { data: { token } })).ok()).toBeTruthy();
  const firmy = (await (await admin.get("/api/admin/firms")).json()).firms as { id: string; name: string }[];
  const id = firmy.find((f) => f.name === nazwa)!.id;
  const za40h = new Date(Date.now() + 40 * 3600_000).toISOString();
  expect((await admin.put(`/api/admin/firms/${id}`, { data: { trialEnds: za40h } })).ok()).toBeTruthy();
  await admin.dispose();

  const zly = await request.post("/api/zadania", { headers: { authorization: "Bearer zly" } });
  expect(zly.status()).toBe(401);
  for (let i = 0; i < 2; i++) expect((await request.post("/api/zadania", { headers: { authorization: `Bearer ${CRON_SECRET}` } })).ok()).toBeTruthy();
  const przypomnienia = (await maileDo(request, email)).filter((m) => /Zostały 2 dni/.test(m.subject));
  expect(przypomnienia).toHaveLength(1);
});
