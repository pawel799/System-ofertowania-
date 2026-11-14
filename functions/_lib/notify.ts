/*
 * Wysyłka e-maili przez HTTP API poczty – Pages Functions nie wysyłają poczty same (Cloudflare blokuje port 25).
 * Domyślnie własny przekaźnik na VPS (mail-relay/server.mjs: przyjmuje JSON i oddaje maila Postfixowi z DKIM).
 * Konfiguracja projektu: MAIL_API_URL (np. https://poczta.oprzut.app/emails) i MAIL_API_KEY (sekret), NOTIFY_FROM
 * (nadawca z domeny podpisanej DKIM), NOTIFY_EMAIL. Bez adresu i klucza – po cichu nic nie robi.
 *
 * Format żądania: POST, Authorization: Bearer <klucz>, JSON { from, to[], reply_to?, subject, text, html }
 * (zgodny z popularnymi API poczty – w razie zmiany dostawcy wystarczy podmienić MAIL_API_URL i klucz).
 *
 * Powiadomienie o zgłoszeniu (wycena / pomiar / kontakt) trafia:
 *   - dla firm z kontami: na e-maile właścicieli konta firmy,
 *   - dla firmy "main" (właściciel systemu): na NOTIFY_EMAIL.
 * Błąd wysyłki nie blokuje zapisu zgłoszenia.
 */
import type { Env } from "./offers";

const TYP: Record<string, string> = { wycena: "Prośba o wycenę", pomiar: "Prośba o pomiar", kontakt: "Wiadomość z formularza kontaktowego" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const mailConfigured = (env: Env) => !!(env.MAIL_API_URL && env.MAIL_API_KEY);

/** Nadawca domyślny, gdy nie ustawiono NOTIFY_FROM. */
export const NADAWCA_DOMYSLNY = "OP RZUT <powiadomienia@oprzut.app>";

export async function sendMail(
  env: Env,
  mail: { to: string[]; subject: string; text: string; html: string; replyTo?: string },
): Promise<boolean> {
  if (!mailConfigured(env) || !mail.to.length) return false;
  try {
    const res = await fetch(env.MAIL_API_URL!, {
      method: "POST",
      headers: { authorization: `Bearer ${env.MAIL_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.NOTIFY_FROM || NADAWCA_DOMYSLNY,
        to: mail.to,
        reply_to: mail.replyTo || undefined,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!res.ok) console.error("Poczta", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("Poczta", e);
    return false;
  }
}

/** `to` = adresy firmy; brak = NOTIFY_EMAIL (firma "main"). */
export async function notifyNewRequest(env: Env, r: Record<string, string>, origin: string, to?: string[]) {
  const recipients = to?.length ? to : (env.NOTIFY_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) return false;
  const rows: [string, string][] = [
    ["Rodzaj", TYP[r.typ] ?? r.typ],
    ["Imię", r.imie],
    ["Telefon", r.telefon],
    ["E-mail", r.email],
    ["Firma", r.firma],
    ["Oferta", r.oferta],
    ["Wybór klienta", r.wybor],
    ["Uwagi", r.uwagi],
  ].filter(([, v]) => v) as [string, string][];
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nWszystkie zgłoszenia: ${origin}/panel/zgloszenia`;
  const html = `<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#78716c;vertical-align:top">${esc(k)}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join("")}</table><p style="font-family:Arial,sans-serif;font-size:14px"><a href="${origin}/panel/zgloszenia">Otwórz zgłoszenia w panelu</a></p>`;
  return sendMail(env, {
    to: recipients,
    subject: `${TYP[r.typ] ?? "Zgłoszenie"}: ${r.imie}`,
    text,
    html,
    replyTo: r.email || undefined,
  });
}

/** Link do ustawienia nowego hasła (ważny 1 godzinę). */
export async function sendPasswordReset(env: Env, email: string, link: string) {
  return sendMail(env, {
    to: [email],
    subject: "Zmiana hasła do panelu ofert",
    text: `Ktoś (może Ty) poprosił o zmianę hasła do panelu ofert.\n\nUstaw nowe hasło: ${link}\n\nLink działa przez godzinę. Jeśli to nie Ty, zignoruj tę wiadomość.`,
    html: `<p style="font-family:Arial,sans-serif;font-size:14px">Ktoś (może Ty) poprosił o zmianę hasła do panelu ofert.</p><p style="font-family:Arial,sans-serif;font-size:14px"><a href="${esc(link)}">Ustaw nowe hasło</a></p><p style="font-family:Arial,sans-serif;font-size:13px;color:#78716c">Link działa przez godzinę. Jeśli to nie Ty, zignoruj tę wiadomość.</p>`,
  });
}

/** Link potwierdzający adres e-mail po rejestracji konta firmy. */
export async function sendEmailVerification(env: Env, mail: { email: string; name: string; firm: string; link: string; hours: number }) {
  const p = 'style="font-family:Arial,sans-serif;font-size:14px"';
  return sendMail(env, {
    to: [mail.email],
    subject: "Potwierdź adres e-mail w OP RZUT",
    text: `Dzień dobry ${mail.name},

dziękujemy za założenie konta firmy ${mail.firm} w OP RZUT. Potwierdź, że ten adres e-mail należy do Ciebie:

${mail.link}

Link działa przez ${mail.hours} godziny. Do czasu potwierdzenia możesz przygotowywać oferty, ale nie wyślesz linku klientowi. Jeśli to nie Ty, zignoruj tę wiadomość.`,
    html: `<p ${p}>Dzień dobry ${esc(mail.name)},</p><p ${p}>dziękujemy za założenie konta firmy <b>${esc(mail.firm)}</b> w OP RZUT. Potwierdź, że ten adres e-mail należy do Ciebie:</p><p ${p}><a href="${esc(mail.link)}">Potwierdź adres e-mail</a></p><p style="font-family:Arial,sans-serif;font-size:13px;color:#78716c">Link działa przez ${mail.hours} godziny. Do czasu potwierdzenia możesz przygotowywać oferty, ale nie wyślesz linku klientowi. Jeśli to nie Ty, zignoruj tę wiadomość.</p>`,
  });
}

const P = 'style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5"';
const MALY = 'style="font-family:Arial,sans-serif;font-size:13px;color:#78716c;line-height:1.5"';
const PRZYCISK = (href: string, tekst: string) =>
  `<p style="margin:20px 0"><a href="${esc(href)}" style="font-family:Arial,sans-serif;font-size:14px;background:#1c1917;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">${esc(tekst)}</a></p>`;
const dataPl = (iso: string) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

/** Koniec okresu próbnego: 7 dni przed, 2 dni przed, ostatni dzień i dzień po (_lib/zadania.ts). */
export async function sendTrialReminder(
  env: Env,
  m: { to: string[]; imie: string; firma: string; etap: "7" | "2" | "0" | "po"; koniec: string; link: string },
) {
  const kiedy = dataPl(m.koniec);
  const tresc = {
    "7": {
      temat: "Okres próbny OP RZUT kończy się za 7 dni",
      wstep: `okres próbny konta ${m.firma} w OP RZUT kończy się ${kiedy}.`,
      dalej: "Wybierz plan, żeby oferty, linki dla klientów i zgłoszenia działały bez przerwy. Wszystko, co przygotowałeś, zostaje na koncie.",
    },
    "2": {
      temat: "Zostały 2 dni okresu próbnego OP RZUT",
      wstep: `za 2 dni (${kiedy}) kończy się okres próbny konta ${m.firma}.`,
      dalej: "Wybierz plan teraz – zajmie to minutę, a klienci dalej otworzą Twoje oferty w 3D.",
    },
    "0": {
      temat: "Dziś ostatni dzień okresu próbnego OP RZUT",
      wstep: `dziś (${kiedy}) kończy się okres próbny konta ${m.firma}.`,
      dalej: "Wybierz plan, żeby jutro wszystko działało jak dziś: kreator, oferty PDF, linki 3D dla klientów i zgłoszenia.",
    },
    po: {
      temat: "Okres próbny OP RZUT się skończył",
      wstep: `okres próbny konta ${m.firma} skończył się ${kiedy}.`,
      dalej: "Twoje oferty, cennik i katalog są zapisane. Wybierz plan, żeby dalej z nich korzystać i wysyłać klientom linki.",
    },
  }[m.etap];
  return sendMail(env, {
    to: m.to,
    subject: tresc.temat,
    text: `Dzień dobry ${m.imie},\n\n${tresc.wstep}\n\n${tresc.dalej}\n\nWybierz plan: ${m.link}\n\nPytania? Odpisz na tę wiadomość.\n\nOP RZUT`,
    html: `<p ${P}>Dzień dobry ${esc(m.imie)},</p><p ${P}>${esc(tresc.wstep)}</p><p ${P}>${esc(tresc.dalej)}</p>${PRZYCISK(m.link, "Wybierz plan")}<p ${MALY}>Pytania? Odpisz na tę wiadomość.</p>`,
    replyTo: (env.NOTIFY_EMAIL ?? "").split(",")[0]?.trim() || undefined,
  });
}

/** Powitanie po potwierdzeniu adresu e-mail: trzy kroki na start i data końca okresu próbnego. */
export async function sendWelcome(env: Env, m: { to: string; imie: string; firma: string; origin: string; trialEnds: string | null }) {
  const kroki: [string, string][] = [
    ["Dane firmy i logo", `${m.origin}/panel/ustawienia?tab=firma`],
    ["Pierwsza oferta – szybka oferta albo kreator", `${m.origin}/panel/szybka`],
    ["Link 3D dla klienta – z oferty w panelu", `${m.origin}/panel`],
  ];
  const trial = m.trialEnds ? `Okres próbny trwa do ${dataPl(m.trialEnds)} – bez podawania karty.` : "";
  return sendMail(env, {
    to: [m.to],
    subject: "Witaj w OP RZUT – 3 kroki na start",
    text: `Dzień dobry ${m.imie},\n\nkonto ${m.firma} jest gotowe. Na start:\n\n${kroki.map(([t, l], i) => `${i + 1}. ${t}: ${l}`).join("\n")}\n\n${trial}\n\nPytania? Odpisz na tę wiadomość.\n\nOP RZUT`,
    html: `<p ${P}>Dzień dobry ${esc(m.imie)},</p><p ${P}>konto <b>${esc(m.firma)}</b> jest gotowe. Na start:</p><ol ${P}>${kroki
      .map(([t, l]) => `<li><a href="${esc(l)}">${esc(t)}</a></li>`)
      .join("")}</ol>${trial ? `<p ${P}>${esc(trial)}</p>` : ""}${PRZYCISK(`${m.origin}/panel`, "Otwórz panel")}<p ${MALY}>Pytania? Odpisz na tę wiadomość.</p>`,
    replyTo: (env.NOTIFY_EMAIL ?? "").split(",")[0]?.trim() || undefined,
  });
}
