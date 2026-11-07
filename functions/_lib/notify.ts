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
