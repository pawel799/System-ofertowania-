/*
 * Wszystkie teksty i media strony głównej w jednym miejscu.
 * Treści pod sprzedaż systemu firmom – zmieniasz je tutaj, układ (src/components/site/home/*) zostaje bez zmian.
 *
 * Media (zrzuty ekranu, nagrania): wrzuć plik do public/strona/ i wpisz ścieżkę w `src`
 * (obraz: .webp/.png/.jpg) albo `video` (.mp4, odtwarzane bez dźwięku w pętli).
 * Puste `src`/`video` = szare pole z opisem, co ma się tam znaleźć.
 */

import { CENA_ZAKRES, formatZl, MODEL_SERVICE_PRICE, PLANS, TRIAL_DAYS } from "@/lib/plans";

export type Media = {
  /** Obraz, np. "/strona/panel.webp". */
  src?: string;
  /** Nagranie .mp4, np. "/strona/oferta.mp4" (ma pierwszeństwo przed obrazem). */
  video?: string;
  /** To samo nagranie w .webm – zapas dla przeglądarek bez H.264 (opcjonalnie). */
  videoWebm?: string;
  /** Kadr pokazywany przed startem nagrania (i zamiast niego przy ograniczonym ruchu). */
  poster?: string;
  /** Opis dla czytników ekranu, a bez pliku – podpis pola. */
  alt: string;
  /** Proporcje pola, domyślnie 16 / 10. */
  ratio?: string;
};

export type Link = { href: string; label: string };

export const HOME = {
  /** Nagłówek i jedno zdanie w hero: co to jest. */
  hero: {
    title: "Oferty mebli na wymiar w 3D",
    lead: "Wysyłasz klientowi link do kuchni w 3D – ogląda ją w przeglądarce, zmienia materiały, widzi cenę i zostawia uwagi.",
  },

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
    title: "Oferta w 3D w kilka minut, bez programów i załączników",
    lead: "Projektant przygotowuje ofertę w panelu, a klient dostaje link, który otwiera na telefonie albo komputerze. Bez ciężkich PDF-ów i bez instalowania czegokolwiek.",
    items: [
      {
        title: "Wpisz klienta i wybierz kuchnię",
        text: "Klient prywatny albo firma: po wpisaniu NIP-u nazwa i adres uzupełniają się same. Kuchnię składasz w kreatorze z gotowych szafek albo wybierasz własny model 3D. Cena liczy się z Twojego cennika, a Ty decydujesz, czy klient ma ją widzieć.",
        media: { src: "/strona/krok-1-nowa-oferta.webp", alt: "Panel: nowa oferta, dane firmy uzupełnione po NIP-ie" } as Media,
      },
      {
        title: "Wyślij link jednym kliknięciem",
        text: "System przygotuje wiadomość z linkiem do oferty. Możesz ją zabezpieczyć PIN-em i ustawić datę ważności, żeby nie krążyła po sieci.",
        media: { src: "/strona/krok-2-link.webp", alt: "Panel: link dla klienta z datą ważności i gotową wiadomością" } as Media,
      },
      {
        title: "Klient ogląda, a Ty wiesz więcej",
        text: "Klient obraca kuchnię w 3D, zmienia fronty, blat i uchwyty, i zostawia uwagi. W panelu widzisz, kiedy otworzył ofertę i co napisał.",
        media: { src: "/strona/krok-3-klient.webp", alt: "Strona oferty u klienta: kuchnia 3D z paskiem materiałów" } as Media,
      },
    ],
  },

  demo: {
    eyebrow: "Przykładowa oferta",
    title: "Tak wygląda oferta, którą wyślesz klientowi",
    text: "Otwórz przykład i sprawdź, co dostaje Twój klient: kuchnię do obracania, zmianę materiałów i cenę przeliczaną na bieżąco. Każdą taką ofertę przygotujesz w panelu.",
    cta: { href: "/oferta/demo", label: "Otwórz przykładową ofertę" } satisfies Link,
    media: {
      video: "/strona/oferta-3d.mp4",
      videoWebm: "/strona/oferta-3d.webm",
      poster: "/strona/oferta-3d.webp",
      alt: "Nagranie: klient zmienia fronty, blat i uchwyty, a cena przelicza się na bieżąco",
      ratio: "16 / 9",
    } as Media,
  },

  features: {
    id: "funkcje",
    eyebrow: "Funkcje",
    title: "Mniej dopytywania, szybsza decyzja klienta",
    items: [
      {
        title: "Link z PIN-em i datą ważności",
        text: "Każda oferta ma własny adres. Zabezpieczasz ją PIN-em i decydujesz, jak długo działa.",
      },
      {
        title: "Klient sam przelicza cenę",
        text: "Zmienia materiały i od razu widzi, ile to kosztuje. Mniej pytań w stylu „a ile za inny blat?”. Cenę możesz też ukryć.",
      },
      {
        title: "Uwagi zamiast łańcucha maili",
        text: "Klient zapisuje uwagi bezpośrednio przy ofercie, a Ty masz je w panelu w jednym miejscu.",
      },
      {
        title: "Wiesz, kiedy klient otworzył ofertę",
        text: "Panel pokazuje każde otwarcie linku, więc dzwonisz wtedy, gdy klient ma ofertę przed oczami.",
      },
      {
        title: "Kreator kuchni i oferta PDF",
        text: "Składasz zabudowę z gotowych szafek i AGD, a cena liczy się z Twojego cennika. Klient dostaje link 3D i osobno ofertę PDF z pozycjami.",
      },
      {
        title: "Kuchnia 3D na Twojej stronie",
        text: "Wklejasz kod na swoją stronę: klient obraca kuchnię, zmienia materiały i prosi o wycenę. W planach Pracownia i Producent.",
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
        text: "Projekt kończysz rano, a klient ogląda go w 3D jeszcze tego samego dnia. Wyróżniasz się na tle konkurencji, która wysyła zrzuty ekranu i PDF-y.",
      },
      {
        title: "Salony i sieci meblowe",
        text: "Każda oferta wychodzi w tym samym, dopracowanym formacie. Klient od pierwszego kontaktu widzi profesjonalną firmę.",
      },
      {
        title: "Producenci mebli",
        text: "Pokazujesz swoje fronty i blaty w prawdziwej kuchni, a nie w katalogu. Modele i materiały przygotujemy pod Twoją ofertę.",
      },
    ],
  },

  pricing: {
    id: "cennik",
    eyebrow: "Cennik",
    title: "Plan dopasowany do wielkości firmy",
    text: `Od ${formatZl(PLANS.start.monthly)} netto miesięcznie za jedną stolarnię. Pierwsze ${TRIAL_DAYS} dni za darmo, bez podawania karty.`,
    cta: { href: "/cennik", label: "Zobacz cennik" } satisfies Link,
  },

  faq: {
    id: "pytania",
    eyebrow: "Pytania",
    title: "Częste pytania",
    items: [
      {
        q: "Czy klient musi coś instalować albo zakładać konto?",
        a: "Nie. Klient dostaje link i otwiera ofertę w przeglądarce na telefonie albo komputerze.",
      },
      {
        q: "Czy potrzebujemy specjalnego sprzętu albo programu?",
        a: "Nie. Panel działa w przeglądarce, wystarczy zwykły komputer z dostępem do internetu.",
      },
      {
        q: "Skąd biorą się modele 3D kuchni?",
        a: `Kuchnię składasz w kreatorze z gotowych szafek i AGD, więc własne modele nie są potrzebne. Możesz też wgrać własny model 3D (GLB). Jeśli wolisz, przygotujemy go za Ciebie: ${MODEL_SERVICE_PRICE}. W planie Producent pomagamy przy modelach w ramach wdrożenia.`,
      },
      {
        q: "Czy mogę ukryć cenę przed klientem?",
        a: "Tak. Cenę włączasz albo wyłączasz osobno dla każdej oferty. Bez ceny klient widzi „Po pomiarze” i może poprosić o wycenę.",
      },
      {
        q: "Co obejmuje cena, którą widzi klient?",
        a: `Szafki z Twojego cennika i dopłaty za wybrane materiały, netto. ${CENA_ZAKRES}`,
      },
      {
        q: "Jak wchodzi się do panelu?",
        a: "Zakładasz konto firmy na stronie (e-mail i hasło) i logujesz się w przeglądarce. Właściciel konta dodaje pracowników w Ustawieniach → Zespół.",
      },
      {
        q: "Co z danymi moich klientów?",
        a: "Oferta jest dostępna tylko pod własnym linkiem, który możesz zabezpieczyć PIN-em i ograniczyć w czasie. Szczegóły w polityce prywatności.",
      },
    ],
  },

  finalCta: {
    title: "Daj klientom ofertę w 3D zamiast PDF-a",
    text: `Załóż konto i sprawdź system przez ${TRIAL_DAYS} dni za darmo albo umów prezentację – pokażemy go na przykładzie Twojej oferty i Twoich mebli.`,
    primary: { href: "/rejestracja", label: `Wypróbuj ${TRIAL_DAYS} dni za darmo` } satisfies Link,
    secondary: { href: "/kontakt", label: "Umów prezentację" } satisfies Link,
  },
};
