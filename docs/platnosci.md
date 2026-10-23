# Cennik, plany i płatności

Ceny i limity planów są w jednym miejscu: `src/lib/plans.ts`. Z tego pliku korzysta strona `/cennik`,
zakładka **Ustawienia → Plan** i API, które pilnuje limitów – zmiana ceny albo limitu w jednym miejscu.

| Plan | Cena netto | Konta | Oferty w toku | Modele 3D | Pakiety RAL | Kuchnia na stronie | Własna domena |
|---|---|---|---|---|---|---|---|
| Start | 149 zł / mies. albo 1 490 zł / rok | 1 | 20 | 20 | – | – | – |
| Pracownia | 349 zł / mies. albo 3 490 zł / rok | 5 | bez limitu | 200 | tak | tak | – |
| Producent | od 899 zł / mies. + wdrożenie od 2 000 zł | bez limitu | bez limitu | bez limitu | tak | tak | tak |

„Oferta w toku” = oferta bez statusu „Zaakceptowana” i bez wygasłego linku. Firma „main” (właściciel
systemu, kod `PANEL_TOKEN`) nie ma limitów.

## Co się dzieje po okresie próbnym

Nowa firma ma `TRIAL_DAYS` (30) dni na wybranym planie. Po tym czasie (albo po dacie „opłacone do”)
panel działa w trybie tylko do odczytu: oferty, zgłoszenia i **linki wysłane klientom działają dalej**,
ale nie da się dodać oferty, utworzyć nowego linku, wgrać modelu ani dodać konta (API zwraca 402
`plan_expired`). Przekroczenie limitu planu = 403 `plan_limit`, funkcja spoza planu = 403 `plan_feature`.

## Płatności dziś: faktura ręcznie

1. Właściciel konta firmy wybiera plan w **Ustawienia → Plan** → `POST /api/billing/request`.
2. Prośba zapisuje się przy firmie, a na `NOTIFY_EMAIL` przychodzi mail (Resend).
3. Wystawiacie fakturę. Po wpłacie administrator (kod `PANEL_TOKEN`) w **Ustawienia → Firmy**
   ustawia plan, status „Aktywna” i „Opłacone do”. Prośba znika sama.

## Płatności online: co jest gotowe

- **Dane przy firmie**: `plan`, `status`, `paidUntil`, `billing { provider, customerId, subscriptionId, period }`.
- **`POST /api/billing/checkout`** `{ plan, period }` → `{ url }` strony płatności. Bez operatora: 501
  `payments_off`, a panel zamiast „Wybierz i opłać” pokazuje „Wybierz” (prośba o fakturę).
- **`POST /api/billing/webhook`** – potwierdzenie płatności w ogólnym, podpisanym formacie:

  ```json
  { "firmId": "…", "plan": "pracownia", "period": "month", "paidUntil": "2026-12-01T00:00:00Z",
    "provider": "stripe", "customerId": "cus_…", "subscriptionId": "sub_…" }
  ```

  nagłówek `X-Billing-Signature` = hex(HMAC-SHA256(`BILLING_WEBHOOK_SECRET`, surowa treść)).
  Skutek: plan, status „active”, „opłacone do”, dane operatora. Bez sekretu endpoint zwraca 404.

## Jak podpiąć operatora (Stripe, Przelewy24, PayU)

1. Konto u operatora (wymaga firmy i regulaminu sprzedaży usług – do przejrzenia z prawnikiem).
2. W `functions/_lib/billing.ts` dopisać adapter z `createCheckout()` (np. Stripe Checkout Session
   z `client_reference_id = firm.id`) i włączyć go w `billingProvider()` przez `BILLING_PROVIDER`.
3. Zdarzenie „opłacono” od operatora przetłumaczyć na format webhooka wyżej (np. osobny mały Worker
   albo drugi endpoint z weryfikacją podpisu operatora) i wysłać na `/api/billing/webhook`.
4. Sekrety w Cloudflare: `BILLING_PROVIDER`, `BILLING_WEBHOOK_SECRET` (+ klucz API operatora).
