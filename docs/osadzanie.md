# Kuchnia 3D na stronie firmy (kod osadzenia)

Stolarnia wstawia na swoją stronę internetową kuchnię 3D: klient obraca ją, zmienia fronty, blat
i uchwyty, widzi szacunkową cenę i wysyła „Poproś o wycenę” albo „Umów pomiar”. Zgłoszenie trafia do
**Zgłoszeń** w panelu tej firmy (z dopiskiem „Z podglądu 3D na Twojej stronie”) i – przy skonfigurowanym
Resend – mailem do właściciela konta.

## W panelu

**Ustawienia → Na stronie**: tytuł, model 3D (albo kuchnia demo), cena bazowa, materiały na start,
„Pokaż cenę”, włącznik widżetu. Obok gotowy kod do skopiowania i podgląd:

```html
<iframe src="https://<domena systemu>/osadz?f=<id firmy>" title="Kuchnia 3D"
  style="width:100%;height:640px;border:0;border-radius:12px" loading="lazy" allow="fullscreen"></iframe>
```

Widżet działa w planach **Pracownia** i **Producent** (`embed` w `src/lib/plans.ts`), gdy jest włączony
i plan nie wygasł. W innym wypadku na stronie firmy widać „Ta kuchnia 3D nie jest teraz dostępna”.

## Technicznie

- Strona `/osadz?f=<id firmy>` (statyczna, `src/components/EmbedOffer.tsx`) – ten sam widok co oferta
  dla klienta (`OfferView`).
- `GET /api/osadz/:firm` – publiczne dane widżetu (tytuł, materiały, cena, model, pakiety RAL, marka);
  404 `embed_off`, gdy widżet wyłączony, plan go nie obejmuje albo firma zawieszona.
- `GET/PUT /api/settings/embed` – ustawienia w panelu; KV firmy: `settings:embed`.
- `POST /api/zapytania` z polem `f` = id firmy → zgłoszenie do tej firmy (`zrodlo: "osadzenie"`).
- `public/_headers`: dla `/osadz*` zdjęte `X-Frame-Options: DENY`, a CSP ma
  `frame-ancestors https: http://localhost:*` – ramka działa na każdej stronie https.
  Reszta strony i panel dalej nie dają się osadzić w ramce.
