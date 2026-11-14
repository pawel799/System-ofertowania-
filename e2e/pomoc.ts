/* Wspólne kroki testów: NIP, atrapa poczty, nowe konto firmy (potwierdzone) i zalogowany panel. */
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const POCZTA = "http://localhost:8799";
export const CRON_SECRET = "sekret-e2e";
export const ADMIN = "admin-e2e";

/** Losowy poprawny NIP (suma kontrolna). */
export function nip() {
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  for (;;) {
    const d = Array.from({ length: 9 }, (_, i) => (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10)));
    const c = d.reduce((s, x, i) => s + x * w[i], 0) % 11;
    if (c < 10) return d.join("") + c;
  }
}

/** Losowy adres klienta – limity rejestracji (5/h z IP) liczą się osobno dla każdego testu. */
export const ip = () => ({ "cf-connecting-ip": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });

export const unikalny = (przedrostek: string) => `${przedrostek}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.pl`;

type Mail = { to: string[]; subject: string; text: string; html: string };

/** Maile wysłane na adres (atrapa poczty). */
export async function maileDo(request: APIRequestContext, adres: string): Promise<Mail[]> {
  const r = await request.get(`${POCZTA}/maile`);
  return ((await r.json()) as Mail[]).filter((m) => m.to.includes(adres));
}

/** Link potwierdzający z ostatniego maila na adres (czeka, aż mail dojdzie). */
export async function linkPotwierdzenia(request: APIRequestContext, adres: string) {
  let link = "";
  await expect
    .poll(async () => {
      const m = (await maileDo(request, adres)).filter((x) => /Potwierdź adres/.test(x.subject)).pop();
      link = m?.text.match(/https?:\/\/\S+potwierdz-email\?t=\w+/)?.[0] ?? "";
      return link;
    })
    .not.toBe("");
  return link;
}

/** Nowe konto firmy przez API, potwierdzone linkiem z maila; strona zalogowana (ciasteczko + znacznik sesji panelu). */
export async function zalogowanaFirma(page: Page, nazwa = "Stolarnia E2E") {
  const email = unikalny("firma");
  const r = await page.request.post("/api/auth/register", { headers: ip(), data: { firma: nazwa, nip: nip(), imie: "Test E2E", email, haslo: "Haslo12345!", zgoda: true } });
  expect(r.status()).toBe(201);
  const link = await linkPotwierdzenia(page.request, email);
  const token = new URL(link).searchParams.get("t");
  const v = await page.request.post("/api/auth/verify", { data: { token } });
  expect(v.ok()).toBeTruthy();
  await page.addInitScript(() => localStorage.setItem("studio-kuchnie:panel-sesja", "1"));
  return { email, haslo: "Haslo12345!" };
}

/** Zamyka baner cookies, jeśli się pokazał. */
export async function bezCookies(page: Page) {
  await page.getByRole("button", { name: "Odrzuć wszystkie" }).click({ timeout: 3000 }).catch(() => {});
}
