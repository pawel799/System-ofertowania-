/*
 * Powiadomienia e-mail o ofertach (Resend – notify.ts):
 *   do firmy:   klient pierwszy raz otworzył link, zaakceptował ofertę, wysłał uwagi, zmienia kolory w podglądzie;
 *   do klienta: przypomnienie 3 dni przed wygaśnięciem linku (gdy kontakt to e-mail i link na to pozwala).
 * Firma włącza / wyłącza każde w Ustawienia → Powiadomienia (KV: powiadomienia; domyślnie wszystkie włączone).
 * Adresy firmy: właściciele konta; firma „main” – NOTIFY_EMAIL. Błąd wysyłki nigdy nie blokuje zapisu.
 */
import { sendMail } from "./notify";
import { getDomain, isActive } from "./domain";
import { getBrand } from "./brand";
import { offerKey, type Ctx, type Env, type KVNamespace, type Offer } from "./offers";
import { firmUsers, MAIN_FIRM, type ScopedKV } from "./tenant";
import { dataPl } from "../../src/lib/wersje";

export type UstawieniaPowiadomien = { otwarcie: boolean; akceptacja: boolean; uwagi: boolean; wybor: boolean; przypomnienia: boolean };
export const POWIADOMIENIA_DOMYSLNE: UstawieniaPowiadomien = { otwarcie: true, akceptacja: true, uwagi: true, wybor: true, przypomnienia: true };
const KLUCZE = Object.keys(POWIADOMIENIA_DOMYSLNE) as (keyof UstawieniaPowiadomien)[];

export async function getPowiadomienia(kv: KVNamespace): Promise<UstawieniaPowiadomien> {
  const raw = await kv.get("powiadomienia");
  const z = raw ? (JSON.parse(raw) as Partial<UstawieniaPowiadomien>) : {};
  return Object.fromEntries(KLUCZE.map((k) => [k, typeof z[k] === "boolean" ? z[k] : POWIADOMIENIA_DOMYSLNE[k]])) as UstawieniaPowiadomien;
}

export function parsePowiadomienia(v: unknown): UstawieniaPowiadomien {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return Object.fromEntries(KLUCZE.map((k) => [k, typeof o[k] === "boolean" ? o[k] : POWIADOMIENIA_DOMYSLNE[k]])) as UstawieniaPowiadomien;
}

export async function putPowiadomienia(kv: KVNamespace, u: UstawieniaPowiadomien) {
  await kv.put("powiadomienia", JSON.stringify(u));
}

/** Adresy firmy do powiadomień: właściciele konta, dla firmy „main” – NOTIFY_EMAIL. */
export async function adresyFirmy(env: Env, kv: ScopedKV): Promise<string[]> {
  if (kv.firmId === MAIN_FIRM) return (env.NOTIFY_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return (await firmUsers(kv.root, kv.firmId)).filter((u) => u.role === "owner").map((u) => u.email);
}

/** Adres strony klienta: własna domena firmy (gdy aktywna), inaczej adres, z którego przyszło żądanie. */
export async function adresLinku(kv: KVNamespace, origin: string, slug: string) {
  const d = await getDomain(kv).catch(() => null);
  return `${d && isActive(d) ? `https://${d.hostname}` : origin}/oferta/${slug}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const P = "font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1c1917";

function list(tytul: string, wiersze: [string, string][], przycisk?: { href: string; tekst: string }) {
  const text = `${tytul}\n\n${wiersze.map(([k, v]) => `${k}: ${v}`).join("\n")}${przycisk ? `\n\n${przycisk.tekst}: ${przycisk.href}` : ""}`;
  const html = `<p style="${P};font-weight:600">${esc(tytul)}</p><table cellpadding="6" style="${P};border-collapse:collapse">${wiersze
    .map(([k, v]) => `<tr><td style="color:#78716c;vertical-align:top">${esc(k)}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join("")}</table>${przycisk ? `<p style="${P}"><a href="${esc(przycisk.href)}">${esc(przycisk.tekst)}</a></p>` : ""}`;
  return { text, html };
}

export type ZdarzenieFirmy = "otwarcie" | "akceptacja" | "uwagi" | "wybor";

const TEMAT: Record<ZdarzenieFirmy, (o: Offer) => string> = {
  otwarcie: (o) => `Klient otworzył ofertę ${o.id}`,
  akceptacja: (o) => `Oferta ${o.id} zaakceptowana`,
  uwagi: (o) => `Uwagi klienta do oferty ${o.id}`,
  wybor: (o) => `Klient zmienia kolory w ofercie ${o.id}`,
};

/** Powiadomienie firmy o zdarzeniu na stronie klienta (gdy firma je włączyła). */
export async function powiadomFirme(ctx: Ctx, kv: ScopedKV, offer: Offer, zdarzenie: ZdarzenieFirmy, szczegoly: [string, string][] = []) {
  const ust = await getPowiadomienia(kv);
  if (!ust[zdarzenie]) return false;
  const to = await adresyFirmy(ctx.env, kv);
  if (!to.length) return false;
  const origin = new URL(ctx.request.url).origin;
  const { text, html } = list(
    TEMAT[zdarzenie](offer),
    [["Oferta", `${offer.id} – ${offer.title}`], ["Klient", offer.client], ...szczegoly],
    { href: `${origin}/panel?oferta=${offerKey(offer.id)}`, tekst: "Otwórz ofertę w panelu" },
  );
  return sendMail(ctx.env, { to, subject: TEMAT[zdarzenie](offer), text, html });
}

/** Wysyła w tle (waitUntil), gdy runtime to umożliwia – odpowiedź dla klienta nie czeka na pocztę. */
export function wTle(ctx: Ctx, p: Promise<unknown>) {
  const bezpieczne = p.catch((e) => console.error("powiadomienie", e));
  if (ctx.waitUntil) ctx.waitUntil(bezpieczne);
  return bezpieczne;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Oferta, której klientowi należy się przypomnienie (link wygasa w ciągu 3 dni, kontakt e-mail, jeszcze nie wysłane). */
export function doPrzypomnienia(o: Offer, teraz = Date.now()) {
  const L = o.link;
  if (!L || L.przypomnij === false || !L.expiresAt || o.przypomnienie || o.status === "zaakceptowany") return false;
  if (!EMAIL.test(o.contact.trim())) return false;
  const zostalo = Date.parse(L.expiresAt) - teraz;
  return zostalo > 0 && zostalo <= 3 * 24 * 3600 * 1000;
}

/** E-mail do klienta: link do oferty wygasa (PIN-u nie wysyłamy – klient ma go z wiadomości od firmy). */
export async function przypomnijKlientowi(env: Env, kv: KVNamespace, origin: string, offer: Offer) {
  const L = offer.link;
  if (!L) return false;
  const firma = (await getBrand(kv))?.name ?? "Pracownia";
  const href = await adresLinku(kv, origin, L.slug);
  const kiedy = L.expiresAt ? dataPl(L.expiresAt) : L.expires;
  const powitanie = offer.greet ? `Dzień dobry, ${offer.greet}!` : "Dzień dobry!";
  const text = `${powitanie}\n\nPrzypominamy o ofercie ${offer.id} „${offer.title}” od ${firma}. Link jest ważny do ${kiedy}.\n\nZobacz ofertę w 3D: ${href}${L.pin ? "\nPIN masz w poprzedniej wiadomości od nas." : ""}\n\nJeśli coś chcesz zmienić, napisz uwagi na stronie oferty albo odpowiedz na tę wiadomość.\n\nPozdrawiamy\n${firma}`;
  const html = `<p style="${P}">${esc(powitanie)}</p><p style="${P}">Przypominamy o ofercie <b>${esc(offer.id)}</b> „${esc(offer.title)}” od ${esc(firma)}. Link jest ważny do <b>${esc(kiedy)}</b>.</p><p style="${P}"><a href="${esc(href)}">Zobacz ofertę w 3D</a>${L.pin ? "<br/>PIN masz w poprzedniej wiadomości od nas." : ""}</p><p style="${P};color:#57534e">Jeśli coś chcesz zmienić, napisz uwagi na stronie oferty albo odpowiedz na tę wiadomość.</p><p style="${P}">Pozdrawiamy<br/>${esc(firma)}</p>`;
  return sendMail(env, { to: [offer.contact.trim()], subject: `Przypomnienie: oferta ${offer.id} ważna do ${kiedy}`, text, html });
}
