/*
 * Powiadomienie e-mail o nowym zgłoszeniu (wycena / pomiar / kontakt).
 * Pages Functions nie wysyłają poczty same – używamy HTTP API Resend (https://resend.com).
 * Działa tylko, gdy w ustawieniach projektu są: RESEND_API_KEY (sekret) i NOTIFY_EMAIL,
 * opcjonalnie NOTIFY_FROM (zweryfikowana domena w Resend). Bez nich – po cichu nic nie robi.
 * Błąd wysyłki nie blokuje zapisu zgłoszenia.
 */
import type { Env } from "./offers";

const TYP: Record<string, string> = { wycena: "Prośba o wycenę", pomiar: "Prośba o pomiar", kontakt: "Wiadomość z formularza kontaktowego" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function notifyNewRequest(env: Env, r: Record<string, string>, origin: string) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return false;
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
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.NOTIFY_FROM || "System ofertowania <onboarding@resend.dev>",
        to: env.NOTIFY_EMAIL.split(",").map((s) => s.trim()).filter(Boolean),
        reply_to: r.email || undefined,
        subject: `${TYP[r.typ] ?? "Zgłoszenie"}: ${r.imie}`,
        text,
        html,
      }),
    });
    if (!res.ok) console.error("Resend", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("Resend", e);
    return false;
  }
}
