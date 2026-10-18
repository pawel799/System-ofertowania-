# Zgłoszenia i powiadomienia e-mail

## Gdzie trafiają zgłoszenia
Formularze „Poproś o wycenę”, „Umów pomiar” (strona oferty) i formularz `/kontakt` zapisują zgłoszenie
w KV (`OFFERS`, klucz `zapytanie:<data>:<losowe>`, automatyczne usunięcie po 180 dniach).

Lista: **Panel → Zgłoszenia** (`/panel/zgloszenia`). Można oznaczyć jako obsłużone albo usunąć.

## Powiadomienie e-mail (Resend) – opcjonalne
Bez konfiguracji zgłoszenia nadal się zapisują, tylko nie przychodzi mail.

1. Załóż konto na https://resend.com (darmowy plan: 3000 maili/mies.).
2. **Domains → Add domain** – dodaj swoją domenę i wpisz u rejestratora/w Cloudflare DNS rekordy, które poda Resend (SPF, DKIM). Poczekaj na „Verified”.
   Bez własnej domeny można testowo użyć nadawcy `onboarding@resend.dev` – wtedy mail dojdzie tylko na adres, którym założono konto Resend.
3. **API Keys → Create API key** (uprawnienie „Sending access”). Skopiuj klucz `re_…`.
4. Cloudflare → Workers & Pages → projekt → **Settings → Variables and Secrets** (Production):
   - `RESEND_API_KEY` – typ **Secret**, wartość `re_…`
   - `NOTIFY_EMAIL` – adres, na który mają przychodzić powiadomienia (można kilka, po przecinku)
   - `NOTIFY_FROM` – nadawca z zweryfikowanej domeny, np. `Zgłoszenia <zgloszenia@twojadomena.pl>` (domyślnie `onboarding@resend.dev`)
5. Zrób nowy deploy (zmienne działają od następnego wdrożenia) i wyślij testowe zgłoszenie z `/kontakt`.

Błąd wysyłki nie blokuje zapisu zgłoszenia – w razie problemów sprawdź **Resend → Logs**.
