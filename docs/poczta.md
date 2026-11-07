# Wysyłka e-maili – własny serwer (VPS)

Strona działa na Cloudflare Pages, a Cloudflare nie pozwala wysyłać poczty przez SMTP (port 25 jest zablokowany).
Dlatego maile idą tak:

```
Cloudflare Pages Functions ──HTTPS + klucz──▶ poczta.oprzut.app (Caddy) ──▶ mail-relay (Node, 127.0.0.1:8025)
                                                                         ──▶ Postfix + OpenDKIM ──▶ skrzynki odbiorców
```

- `functions/_lib/notify.ts` – wysyła JSON `{ from, to[], reply_to?, subject, text, html }` na `MAIL_API_URL`.
- `mail-relay/server.mjs` – przekaźnik na VPS: sprawdza klucz, nadawcę (tylko `@oprzut.app`), limit na minutę,
  buduje wiadomość MIME (UTF-8, tekst + HTML) i oddaje ją Postfixowi. Bez zależności – sam Node ≥ 18.
- Co wysyłamy: zgłoszenia z formularzy, powiadomienia o ofertach (otwarcie, akceptacja, uwagi, kolory),
  przypomnienia dla klientów, linki do zmiany hasła, prośby o plan. Spis: `docs/akceptacja-i-powiadomienia.md`.

## 1. Zanim kupicie VPS – sprawdźcie

- **Port 25 na zewnątrz musi być otwarty.** Wielu dostawców blokuje go domyślnie (np. Hetzner – trzeba poprosić
  o odblokowanie po pierwszej fakturze; OVH, Mikrus, DigitalOcean – różnie). Zapytajcie przed zakupem.
- **Rekord PTR (reverse DNS)** dla IP serwera musi dać się ustawić na `poczta.oprzut.app` – ustawia się go
  w panelu dostawcy VPS. Bez tego Gmail i Outlook wrzucają pocztę do spamu albo ją odrzucają.
- IP nie może być na czarnych listach: sprawdźcie na https://mxtoolbox.com/blacklists.aspx.

## 2. Postfix (tylko wysyłka) i OpenDKIM

Debian / Ubuntu:

```bash
apt install -y postfix opendkim opendkim-tools nodejs caddy
```

Przy instalacji Postfixa: „Internet Site”, nazwa systemu poczty: `oprzut.app`.

`/etc/postfix/main.cf` – najważniejsze:

```
myhostname = poczta.oprzut.app
myorigin = oprzut.app
inet_interfaces = loopback-only        # nie przyjmujemy poczty z internetu – tylko wysyłka
mydestination =
smtp_tls_security_level = may
smtpd_milters = inet:127.0.0.1:8891
non_smtpd_milters = inet:127.0.0.1:8891
milter_default_action = accept
```

DKIM:

```bash
mkdir -p /etc/opendkim/keys/oprzut.app
opendkim-genkey -b 2048 -d oprzut.app -s mail -D /etc/opendkim/keys/oprzut.app
chown -R opendkim:opendkim /etc/opendkim/keys
```

`/etc/opendkim.conf` (dopisz / zmień):

```
Domain      oprzut.app
Selector    mail
KeyFile     /etc/opendkim/keys/oprzut.app/mail.private
Socket      inet:8891@127.0.0.1
Canonicalization relaxed/simple
```

```bash
systemctl restart opendkim postfix
```

## 3. DNS w Cloudflare (strefa oprzut.app)

| Typ | Nazwa | Wartość |
| --- | --- | --- |
| A | `poczta` | IP VPS – **DNS only** (szara chmurka) |
| TXT | `@` | `v=spf1 ip4:<IP VPS> -all` |
| TXT | `mail._domainkey` | zawartość `/etc/opendkim/keys/oprzut.app/mail.txt` (`v=DKIM1; k=rsa; p=…`, bez cudzysłowów i nawiasów) |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<wasz adres>` – po kilku tygodniach bez problemów zmieńcie na `p=quarantine` |

Uwagi:
- Rekord SPF może być tylko jeden. Jeśli w strefie jest już `v=spf1 …` (np. z Cloudflare Email Routing:
  `include:_spf.mx.cloudflare.net`), dopiszcie do niego `ip4:<IP VPS>` zamiast dodawać drugi.
- PTR (w panelu VPS): `<IP VPS>` → `poczta.oprzut.app`.
- Odbieranie poczty na `@oprzut.app` (np. `kontakt@`) – Cloudflare **Email Routing** (przekierowanie do Gmaila).
  Nie koliduje z wysyłką z VPS.

## 4. Przekaźnik

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin mailrelay
mkdir -p /opt/mail-relay && cp mail-relay/server.mjs /opt/mail-relay/
echo "MAIL_API_KEY=$(openssl rand -hex 32)" > /etc/mail-relay.env && chmod 600 /etc/mail-relay.env
cp mail-relay/mail-relay.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now mail-relay
cp mail-relay/Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy
```

Sprawdzenie: `curl https://poczta.oprzut.app/health` → `{"ok":true}`.

Test wysyłki z serwera (adres testowy z https://www.mail-tester.com – pokaże ocenę SPF / DKIM / DMARC / PTR):

```bash
. /etc/mail-relay.env; curl -s https://poczta.oprzut.app/emails -H "authorization: Bearer $MAIL_API_KEY" \
  -H "content-type: application/json" \
  -d '{"from":"OP RZUT <powiadomienia@oprzut.app>","to":["<adres z mail-tester>"],"subject":"Test","text":"Test wysyłki"}'
```

Cel: 9/10 albo 10/10. Logi: `journalctl -u mail-relay` (bez adresów i treści) i `/var/log/mail.log` (Postfix).

## 5. Cloudflare Pages – zmienne projektu

Workers & Pages → `system-ofertowania` → Settings → Variables and Secrets (Production):

| Nazwa | Typ | Wartość |
| --- | --- | --- |
| `MAIL_API_URL` | Text | `https://poczta.oprzut.app/emails` |
| `MAIL_API_KEY` | Secret | ten sam klucz co w `/etc/mail-relay.env` |
| `NOTIFY_FROM` | Text | `OP RZUT <powiadomienia@oprzut.app>` (domyślnie właśnie ten) |
| `NOTIFY_EMAIL` | Text | adres(y) właściciela systemu na zgłoszenia, po przecinku |

Zmienne działają od następnego wdrożenia. Test w działającym systemie: „Nie pamiętasz hasła?” w panelu albo formularz `/kontakt`.

## Bezpieczeństwo przekaźnika

- Klucz porównywany w stałym czasie; bez klucza – 401.
- Nadawca tylko z `ALLOWED_FROM_DOMAIN` (oprzut.app); nowe linie w nagłówkach odrzucane (bez wstrzykiwania `Bcc:`).
- Odbiorcy przekazywani Postfixowi jako argumenty, nie z nagłówków; max 20 na maila.
- Limit `MAX_PER_MINUTE` (domyślnie 60) – hamulec, gdyby klucz wyciekł.
- Postfix słucha tylko na 127.0.0.1 (`inet_interfaces = loopback-only`) – serwer nie jest otwartym przekaźnikiem.
