/*
 * Wszystkie teksty i media strony głównej w jednym miejscu.
 * Treści są robocze – podmień je tutaj, układ (src/components/site/home/*) zostaje bez zmian.
 *
 * Media (zrzuty ekranu, nagrania): wrzuć plik do public/strona/ i wpisz ścieżkę w `src`
 * (obraz: .webp/.png/.jpg) albo `video` (.mp4, odtwarzane bez dźwięku w pętli).
 * Puste `src`/`video` = szare pole z opisem, co ma się tam znaleźć.
 */

export type Media = {
  /** Obraz, np. "/strona/panel.webp". */
  src?: string;
  /** Nagranie .mp4, np. "/strona/oferta.mp4" (ma pierwszeństwo przed obrazem). */
  video?: string;
  /** Opis dla czytników ekranu, a bez pliku – podpis pola. */
  alt: string;
  /** Proporcje pola, domyślnie 16 / 10. */
  ratio?: string;
};

export type Link = { href: string; label: string };

export const HOME = {
  /** Przewijanie pod przyciskami w hero (prowadzi do pierwszej sekcji). */
  scrollHint: "Jak to działa",

  /** Kotwice w pasku, który pojawia się po zjechaniu z hero. Id sekcji – patrz niżej. */
  nav: [
    { href: "#jak-to-dziala", label: "Jak to działa" },
    { href: "#funkcje", label: "Funkcje" },
    { href: "#dla-kogo", label: "Dla kogo" },
    { href: "#cennik", label: "Cennik" },
    { href: "#pytania", label: "Pytania" },
  ] satisfies Link[],

  steps: {
    id: "jak-to-dziala",
    eyebrow: "Jak to działa",
    title: "Od projektu do akceptacji w trzech krokach",
    lead: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Klient dostaje link, a nie załącznik.",
    items: [
      {
        title: "Przygotuj ofertę w panelu",
        text: "Wpisz klienta (prywatny albo firma po NIP-ie), wybierz model kuchni i cenę bazową. Lorem ipsum dolor sit amet.",
        media: { alt: "Panel: nowa oferta z danymi klienta" } as Media,
      },
      {
        title: "Wyślij link",
        text: "Gotowy mail z linkiem, opcjonalnie z PIN-em i datą ważności. Lorem ipsum dolor sit amet, consectetur.",
        media: { alt: "Mail z ofertą i linkiem dla klienta" } as Media,
      },
      {
        title: "Klient ogląda kuchnię w 3D",
        text: "Obraca model, zmienia fronty, blat i uchwyty, widzi cenę i zostawia uwagi. Ty widzisz, kiedy otworzył ofertę.",
        media: { alt: "Strona oferty u klienta: kuchnia 3D z paskiem materiałów" } as Media,
      },
    ],
  },

  demo: {
    eyebrow: "Przykładowa oferta",
    title: "Zobacz ofertę oczami klienta",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Otwórz przykład i pozmieniaj materiały – tak samo zobaczy to Twój klient.",
    cta: { href: "/oferta/demo", label: "Otwórz przykładową ofertę" } satisfies Link,
    media: { alt: "Nagranie: klient zmienia fronty i blat w ofercie 3D", ratio: "16 / 9" } as Media,
  },

  features: {
    id: "funkcje",
    eyebrow: "Funkcje",
    title: "Wszystko, czego potrzeba do wysłania oferty",
    items: [
      {
        title: "Link z PIN-em i datą ważności",
        text: "Każda oferta ma własny adres. Możesz go zabezpieczyć PIN-em i ustawić, do kiedy działa.",
      },
      {
        title: "Cena liczona na bieżąco",
        text: "Klient zmienia materiały, cena przelicza się od razu. Jeśli wolisz, ukryj ją dla danej oferty.",
      },
      {
        title: "Uwagi od klienta",
        text: "Klient zostawia uwagi przy ofercie, a Ty widzisz je w panelu razem z historią.",
      },
      {
        title: "Wiesz, kiedy otworzył",
        text: "Panel pokazuje każde otwarcie linku – na komputerze i telefonie. Lorem ipsum dolor sit.",
      },
      {
        title: "Dane firmy po NIP-ie",
        text: "Wpisujesz NIP, a nazwa i adres uzupełniają się z białej listy VAT i KRS.",
      },
      {
        title: "Gotowy mail z ofertą",
        text: "Wiadomość z linkiem i podsumowaniem, gotowa do wysłania. Lorem ipsum dolor sit amet.",
      },
    ],
  },

  audience: {
    id: "dla-kogo",
    eyebrow: "Dla kogo",
    title: "Dla firm, które sprzedają kuchnie na wymiar",
    items: [
      {
        title: "Studia projektowe",
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Projektant wysyła ofertę tego samego dnia.",
      },
      {
        title: "Salony i sieci meblowe",
        text: "Lorem ipsum dolor sit amet. Szef dodaje sprzedawców i widzi oferty całego zespołu.",
      },
      {
        title: "Producenci mebli",
        text: "Lorem ipsum dolor sit amet. Własne modele i katalog materiałów w ofercie dla klienta.",
      },
    ],
  },

  pricing: {
    id: "cennik",
    eyebrow: "Cennik",
    title: "Abonament miesięczny, bez umowy na lata",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Plany dla jednego projektanta, studia i sieci salonów.",
    cta: { href: "/cennik", label: "Zobacz cennik" } satisfies Link,
  },

  faq: {
    id: "pytania",
    eyebrow: "Pytania",
    title: "Częste pytania",
    items: [
      {
        q: "Czy klient musi coś instalować albo zakładać konto?",
        a: "Nie. Klient otwiera link w przeglądarce na komputerze albo telefonie. Lorem ipsum dolor sit amet.",
      },
      {
        q: "Skąd biorą się modele 3D kuchni?",
        a: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.",
      },
      {
        q: "Czy mogę ukryć cenę przed klientem?",
        a: "Tak, cenę włączasz albo wyłączasz osobno dla każdej oferty.",
      },
      {
        q: "Ile osób z firmy może korzystać z panelu?",
        a: "Lorem ipsum dolor sit amet – zależy od planu. Szczegóły w cenniku.",
      },
      {
        q: "Co z danymi moich klientów?",
        a: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Szczegóły w polityce prywatności.",
      },
    ],
  },

  finalCta: {
    title: "Wyślij pierwszą ofertę w 3D jeszcze dziś",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    primary: { href: "/rejestracja", label: "Zarejestruj się" } satisfies Link,
    secondary: { href: "/kontakt", label: "Umów prezentację" } satisfies Link,
  },
};
