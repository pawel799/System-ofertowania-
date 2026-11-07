# Zgłoszenia i powiadomienia e-mail

## Gdzie trafiają zgłoszenia
Formularze „Poproś o wycenę”, „Umów pomiar” (strona oferty) i formularz `/kontakt` zapisują zgłoszenie
w KV (`OFFERS`, klucz `zapytanie:<data>:<losowe>`, automatyczne usunięcie po 180 dniach).

Lista: **Panel → Zgłoszenia** (`/panel/zgloszenia`). Można oznaczyć jako obsłużone albo usunąć.

## Powiadomienie e-mail – opcjonalne

Wysyłka przez własny serwer poczty (VPS) – konfiguracja w `docs/poczta.md`. Na zgłoszenia właściciela systemu
mail idzie na `NOTIFY_EMAIL`, dla firm z kontami – na adresy właścicieli konta. Odpowiedź z poczty trafia
do klienta (Reply-To = e-mail z formularza). Błąd wysyłki nie blokuje zapisu zgłoszenia.
