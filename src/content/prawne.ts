import { FIRMA, adresFirmy } from "./firma";

/*
 * Treść regulaminu i polityki prywatności (projekt). Dane firmy pochodzą z firma.ts;
 * gdy pole jest puste, używamy neutralnego sformułowania zamiast zmyślonych danych.
 * Przed publikacją dokumenty powinien przejrzeć prawnik.
 */

export type LegalSection = { title: string; items: string[] };

const nazwa = () => FIRMA.nazwaPrawna || FIRMA.nazwaHandlowa || "właściciel serwisu";
const admin = () => {
  const parts = [nazwa(), adresFirmy() && `z siedzibą: ${adresFirmy()}`, FIRMA.nip && `NIP ${FIRMA.nip}`, FIRMA.krs && `KRS ${FIRMA.krs}`];
  return parts.filter(Boolean).join(", ");
};
const kontakt = () => {
  const c = [FIRMA.email && `e-mail: ${FIRMA.email}`, FIRMA.telefon && `tel. ${FIRMA.telefon}`].filter(Boolean).join(", ");
  return c ? c : "dane kontaktowe podane na stronie /kontakt";
};

export const LEGAL_UPDATED = "18 października 2026";

export const POLITYKA: LegalSection[] = [
  {
    title: "Administrator danych",
    items: [
      `Administratorem Twoich danych osobowych jest ${admin()} (dalej: „Administrator”).`,
      `W sprawach dotyczących danych osobowych możesz kontaktować się z Administratorem: ${kontakt()}.`,
    ],
  },
  {
    title: "Jakie dane zbieramy",
    items: [
      "Dane podane w formularzu kontaktowym lub w formularzu zapytania o pomiar: imię lub nazwę, adres e-mail i/lub numer telefonu oraz treść wiadomości.",
      "Uwagi i wybory konfiguracji (fronty, blat, uchwyty) zapisane przez Ciebie na stronie oferty.",
      "Dane techniczne niezbędne do działania serwisu (np. adres IP w logach serwera, informacja o otwarciu linku z ofertą). Serwis nie używa reklamowych plików cookies ani narzędzi śledzących.",
    ],
  },
  {
    title: "Cele i podstawy prawne",
    items: [
      "Odpowiedź na zapytanie, przygotowanie oferty i umówienie pomiaru – art. 6 ust. 1 lit. b RODO (działania przed zawarciem umowy, na Twoje żądanie).",
      "Prowadzenie korespondencji, zapewnienie bezpieczeństwa serwisu oraz ustalenie, dochodzenie lub obrona roszczeń – art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes Administratora).",
      "Podanie danych jest dobrowolne, ale bez nich nie odpowiemy na zapytanie.",
    ],
  },
  {
    title: "Okres przechowywania",
    items: [
      "Zapytania z formularzy przechowujemy przez 180 dni od ich wysłania, po czym są automatycznie usuwane – chyba że wcześniej zawrzemy umowę albo dane będą potrzebne do obrony roszczeń.",
      "Link z ofertą i powiązane z nim uwagi przechowujemy do czasu unieważnienia lub wygaśnięcia linku, a następnie usuwamy w rozsądnym terminie.",
    ],
  },
  {
    title: "Odbiorcy danych",
    items: [
      "Dane mogą być przekazywane wyłącznie dostawcom usług, z których korzysta Administrator: hostingu i bazy danych (Cloudflare) oraz wysyłki powiadomień e-mail (Resend). Działają oni na podstawie umów powierzenia.",
      "Część dostawców może przetwarzać dane poza Europejskim Obszarem Gospodarczym – w takim przypadku na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską.",
    ],
  },
  {
    title: "Twoje prawa",
    items: [
      "Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie.",
      "Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).",
      "Twoje dane nie są wykorzystywane do zautomatyzowanego podejmowania decyzji ani profilowania.",
    ],
  },
  {
    title: "Kontakt",
    items: [`Aby skorzystać ze swoich praw lub zadać pytanie o dane, napisz do Administratora: ${kontakt()}.`],
  },
];

export const REGULAMIN: LegalSection[] = [
  {
    title: "Postanowienia ogólne",
    items: [
      `Regulamin określa zasady korzystania z serwisu prowadzonego przez ${admin()} (dalej: „Usługodawca”).`,
      "Serwis umożliwia zapoznanie się z ofertą Usługodawcy, wysłanie zapytania lub prośby o pomiar oraz przeglądanie przygotowanych ofert kuchni w trójwymiarowym podglądzie.",
      `Kontakt z Usługodawcą: ${kontakt()}.`,
    ],
  },
  {
    title: "Definicje",
    items: [
      "Serwis – strona internetowa wraz ze stronami ofert i panelem.",
      "Klient – osoba, która otrzymała link do oferty lub korzysta z formularzy serwisu.",
      "Oferta – strona z projektem kuchni, wyceną i możliwością zmiany wybranych materiałów, udostępniana Klientowi pod indywidualnym linkiem.",
      "Panel – część serwisu dla Usługodawcy, dostępna po zalogowaniu na konto firmy.",
    ],
  },
  {
    title: "Wymagania techniczne",
    items: [
      "Do korzystania z serwisu potrzebne jest urządzenie z dostępem do internetu i aktualną przeglądarką obsługującą WebGL (podgląd 3D).",
      "Korzystanie z serwisu przez Klienta jest bezpłatne i nie wymaga zakładania konta.",
    ],
  },
  {
    title: "Oferty i zapytania",
    items: [
      "Oferta udostępniona w serwisie ma charakter informacyjny i nie stanowi oferty w rozumieniu art. 66 Kodeksu cywilnego. Ostateczna cena i zakres prac są ustalane po pomiarze, w umowie zawieranej poza serwisem.",
      "Wizualizacja 3D jest poglądowa – kolory i faktury materiałów na ekranie mogą różnić się od rzeczywistych próbek.",
      "Link do oferty może mieć ograniczony czas ważności i być zabezpieczony PIN-em. Klient nie powinien udostępniać go osobom trzecim.",
      "Wysłanie zapytania lub akceptacja oferty w serwisie nie zobowiązuje Klienta do zawarcia umowy.",
    ],
  },
  {
    title: "Zasady korzystania",
    items: [
      "Zabronione jest dostarczanie treści o charakterze bezprawnym oraz podejmowanie działań zakłócających pracę serwisu.",
      "Usługodawca może czasowo ograniczyć dostęp do serwisu z przyczyn technicznych.",
    ],
  },
  {
    title: "Reklamacje",
    items: [
      `Reklamacje dotyczące działania serwisu można zgłaszać: ${kontakt()}.`,
      "Usługodawca rozpatruje reklamację w ciągu 14 dni od jej otrzymania i odpowiada w taki sposób, w jaki została złożona, chyba że Klient wskaże inaczej.",
    ],
  },
  {
    title: "Dane osobowe",
    items: ["Zasady przetwarzania danych osobowych opisuje Polityka prywatności dostępna pod adresem /polityka-prywatnosci."],
  },
  {
    title: "Postanowienia końcowe",
    items: [
      "Usługodawca może zmienić regulamin z ważnych przyczyn (np. zmiana przepisów lub funkcji serwisu). Zmiana obowiązuje od opublikowania nowej wersji w serwisie.",
      "W sprawach nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności Kodeksu cywilnego i ustawy o świadczeniu usług drogą elektroniczną.",
    ],
  },
];
