#!/usr/bin/env node
/*
 * Przekaźnik poczty OP RZUT (VPS): HTTP → Postfix.
 *
 * Strona (Cloudflare Pages Functions) nie może wysyłać przez SMTP, więc wysyła JSON tutaj:
 *   POST /emails   Authorization: Bearer <MAIL_API_KEY>
 *   { "from": "OP RZUT <powiadomienia@oprzut.app>", "to": ["klient@example.com"], "reply_to"?: "...",
 *     "subject": "...", "text": "...", "html": "..." }
 * Przekaźnik buduje wiadomość MIME (tekst + HTML, UTF-8) i oddaje ją lokalnemu Postfixowi przez `sendmail`.
 * Podpis DKIM dokłada OpenDKIM (milter w Postfixie). Instrukcja: docs/poczta.md.
 *
 * Bez zależności – sam Node (≥ 18). Słucha tylko na 127.0.0.1; HTTPS robi Caddy przed nim.
 *
 * Zmienne środowiskowe:
 *   MAIL_API_KEY        – wymagany, ten sam co w Cloudflare (min. 32 znaki)
 *   ALLOWED_FROM_DOMAIN – domena nadawcy (domyślnie oprzut.app); inny nadawca = odrzucenie
 *   PORT                – domyślnie 8025
 *   SENDMAIL_PATH       – domyślnie /usr/sbin/sendmail
 *   MAX_PER_MINUTE      – limit maili na minutę (domyślnie 60) – hamulec, gdyby klucz wyciekł
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";

const KLUCZ = process.env.MAIL_API_KEY ?? "";
const DOMENA = (process.env.ALLOWED_FROM_DOMAIN ?? "oprzut.app").toLowerCase();
const PORT = Number(process.env.PORT ?? 8025);
const SENDMAIL = process.env.SENDMAIL_PATH ?? "/usr/sbin/sendmail";
const LIMIT = Number(process.env.MAX_PER_MINUTE ?? 60);
const MAX_BODY = 512 * 1024;
const MAX_ODBIORCOW = 20;

if (KLUCZ.length < 32) {
  console.error("MAIL_API_KEY musi mieć co najmniej 32 znaki (np. openssl rand -hex 32).");
  process.exit(1);
}

/* ---------- walidacja ---------- */

const EMAIL_RE = /^[^\s@<>()",;:\\[\]]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const bezNowejLinii = (s) => typeof s === "string" && !/[\r\n\0]/.test(s);

/** „Nazwa <adres>” albo sam adres → { nazwa, adres }; null = zły format. */
function adresZNazwa(v) {
  if (!bezNowejLinii(v)) return null;
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^<>]+)>\s*$/.exec(v);
  const adres = (m ? m[2] : v).trim();
  if (!EMAIL_RE.test(adres)) return null;
  return { nazwa: m?.[1]?.trim() || "", adres };
}

function sprawdz(b) {
  if (!b || typeof b !== "object") return "Oczekiwano obiektu JSON.";
  const od = adresZNazwa(b.from);
  if (!od) return "Zły nadawca (from).";
  if (od.adres.split("@")[1].toLowerCase() !== DOMENA) return `Nadawca musi być z domeny ${DOMENA}.`;
  if (!Array.isArray(b.to) || !b.to.length || b.to.length > MAX_ODBIORCOW) return `Od 1 do ${MAX_ODBIORCOW} odbiorców (to).`;
  if (b.to.some((t) => !bezNowejLinii(t) || !EMAIL_RE.test(t.trim()))) return "Zły adres odbiorcy.";
  if (b.reply_to !== undefined && b.reply_to !== null && !adresZNazwa(b.reply_to)) return "Zły adres reply_to.";
  if (!bezNowejLinii(b.subject) || !b.subject.trim() || b.subject.length > 300) return "Zły temat (subject).";
  if (typeof b.text !== "string" && typeof b.html !== "string") return "Brak treści (text albo html).";
  return null;
}

/* ---------- MIME ---------- */

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const linie76 = (s) => s.replace(/.{1,76}/g, "$&\r\n");
/** Nagłówek z polskimi znakami (RFC 2047); czysty ASCII zostaje bez zmian. */
const naglowek = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const adresNaglowka = ({ nazwa, adres }) => (nazwa ? `${naglowek(nazwa.replace(/"/g, ""))} <${adres}>` : adres);

function zbudujMime(b, id) {
  const od = adresZNazwa(b.from);
  const granica = `=_oprzut_${randomBytes(12).toString("hex")}`;
  const h = [
    `From: ${adresNaglowka(od)}`,
    `To: ${b.to.map((t) => t.trim()).join(", ")}`,
    ...(b.reply_to ? [`Reply-To: ${adresNaglowka(adresZNazwa(b.reply_to))}`] : []),
    `Subject: ${naglowek(b.subject.trim())}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${id}@${DOMENA}>`,
    "MIME-Version: 1.0",
  ];
  const czesci = [];
  if (typeof b.text === "string") czesci.push(["text/plain", b.text]);
  if (typeof b.html === "string") czesci.push(["text/html", b.html]);
  if (czesci.length === 1) {
    const [typ, tresc] = czesci[0];
    return [...h, `Content-Type: ${typ}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", linie76(b64(tresc))].join("\r\n");
  }
  return [
    ...h,
    `Content-Type: multipart/alternative; boundary="${granica}"`,
    "",
    ...czesci.flatMap(([typ, tresc]) => [`--${granica}`, `Content-Type: ${typ}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", linie76(b64(tresc))]),
    `--${granica}--`,
    "",
  ].join("\r\n");
}

/** Oddaje wiadomość Postfixowi. Odbiorcy jako argumenty (nie z nagłówków – bez wstrzykiwania adresów). */
function wyslij(mime, nadawca, odbiorcy) {
  return new Promise((resolve, reject) => {
    const p = spawn(SENDMAIL, ["-i", "-f", nadawca, "--", ...odbiorcy], { stdio: ["pipe", "ignore", "pipe"] });
    let blad = "";
    p.stderr.on("data", (d) => (blad += d));
    p.on("error", reject);
    p.on("close", (kod) => (kod === 0 ? resolve() : reject(new Error(`sendmail ${kod}: ${blad.slice(0, 300)}`))));
    p.stdin.end(mime);
  });
}

/* ---------- HTTP ---------- */

const kluczBuf = Buffer.from(KLUCZ);
function autoryzacja(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
  if (!m) return false;
  const dany = Buffer.from(m[1]);
  return dany.length === kluczBuf.length && timingSafeEqual(dany, kluczBuf);
}

let okno = { start: Date.now(), ile: 0 };
function limit(n) {
  if (Date.now() - okno.start > 60_000) okno = { start: Date.now(), ile: 0 };
  if (okno.ile + n > LIMIT) return false;
  okno.ile += n;
  return true;
}

const odpowiedz = (res, kod, obj) => {
  res.writeHead(kod, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

const serwer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return odpowiedz(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/emails") return odpowiedz(res, 404, { error: "not_found" });
  if (!autoryzacja(req)) return odpowiedz(res, 401, { error: "unauthorized" });
  let rozmiar = 0;
  const kawalki = [];
  req.on("data", (c) => {
    rozmiar += c.length;
    if (rozmiar > MAX_BODY) {
      odpowiedz(res, 413, { error: "too_large" });
      req.destroy();
    } else kawalki.push(c);
  });
  req.on("end", async () => {
    if (res.writableEnded) return;
    let b;
    try {
      b = JSON.parse(Buffer.concat(kawalki).toString("utf8"));
    } catch {
      return odpowiedz(res, 400, { error: "invalid_json" });
    }
    const blad = sprawdz(b);
    if (blad) return odpowiedz(res, 422, { error: "invalid", message: blad });
    if (!limit(b.to.length)) return odpowiedz(res, 429, { error: "rate_limited", message: `Limit ${LIMIT} maili na minutę.` });
    const id = `${Date.now().toString(36)}.${randomBytes(8).toString("hex")}`;
    try {
      await wyslij(zbudujMime(b, id), adresZNazwa(b.from).adres, b.to.map((t) => t.trim()));
      // W logu tylko id i liczba odbiorców – bez adresów i treści (dane osobowe).
      console.log(`wyslano ${id} odbiorcow=${b.to.length}`);
      odpowiedz(res, 200, { id });
    } catch (e) {
      console.error(`blad ${id}`, e.message);
      odpowiedz(res, 502, { error: "send_failed" });
    }
  });
});

serwer.listen(PORT, "127.0.0.1", () => console.log(`mail-relay słucha na 127.0.0.1:${PORT}, nadawca @${DOMENA}`));
