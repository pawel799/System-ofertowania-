import { FIRMA, adresFirmy } from "./firma";

/*
 * Dokumenty prawne serwisu OP RZUT: regulamin (z umową powierzenia jako załącznikiem), polityka prywatności,
 * polityka cookies. Dane usługodawcy pochodzą z firma.ts – gdy pole jest puste, używamy neutralnego sformułowania
 * zamiast zmyślonych danych (UZUPEŁNIJ firma.ts przed publikacją – wymaga tego art. 5 ustawy o świadczeniu
 * usług drogą elektroniczną).
 *
 * Podstawy: RODO, ustawa o świadczeniu usług drogą elektroniczną, Prawo komunikacji elektronicznej (art. 399 –
 * pliki cookies), Akt o usługach cyfrowych (DSA), Kodeks cywilny, ustawa o prawach konsumenta.
 * To projekt przygotowany starannie, ale przed publikacją powinien go przejrzeć prawnik.
 *
 * Zmiana treści regulaminu albo umowy powierzenia = nowa WERSJA_DOKUMENTOW (zapisuje się przy akceptacji konta).
 */

export type LegalSection = {
  title: string;
  items: string[];
  /** Tabela pod punktami (np. lista plików cookies). */
  tabela?: { naglowki: string[]; wiersze: string[][] };
};

/** Wersja regulaminu i umowy powierzenia – zapisywana przy rejestracji (dowód akceptacji). */
export const WERSJA_DOKUMENTOW = "2026-11-08";
export const LEGAL_UPDATED = "8 listopada 2026";

const nazwa = () => FIRMA.nazwaPrawna || FIRMA.nazwaHandlowa || "właściciel serwisu";
const admin = () => {
  const parts = [
    nazwa(),
    adresFirmy() && `z siedzibą (adresem): ${adresFirmy()}`,
    FIRMA.nip && `NIP ${FIRMA.nip}`,
    FIRMA.regon && `REGON ${FIRMA.regon}`,
    FIRMA.krs && `KRS ${FIRMA.krs}`,
  ];
  return parts.filter(Boolean).join(", ");
};
const email = () => FIRMA.email || "adres e-mail podany na stronie /kontakt";
const kontakt = () => {
  const c = [FIRMA.email && `e-mail: ${FIRMA.email}`, FIRMA.telefon && `tel. ${FIRMA.telefon}`].filter(Boolean).join(", ");
  return c ? c : "dane kontaktowe podane na stronie /kontakt";
};

/* ===================================================================================================== */
/* Regulamin                                                                                             */
/* ===================================================================================================== */

export const REGULAMIN: LegalSection[] = [
  {
    title: "Postanowienia ogólne",
    items: [
      `Regulamin określa zasady świadczenia usług drogą elektroniczną w serwisie OP RZUT dostępnym pod adresem oprzut.app (dalej: „Serwis”), w tym warunki zawierania i rozwiązywania umów oraz tryb reklamacji. Regulamin jest regulaminem, o którym mowa w art. 8 ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.`,
      `Usługodawcą jest ${admin()} (dalej: „Usługodawca”). Kontakt: ${kontakt()}.`,
      "Regulamin jest dostępny bezpłatnie pod adresem oprzut.app/regulamin w sposób umożliwiający jego pobranie, utrwalenie i wydrukowanie. Integralną częścią Regulaminu jest Załącznik nr 1 – Umowa powierzenia przetwarzania danych osobowych (oprzut.app/umowa-powierzenia).",
    ],
  },
  {
    title: "Definicje",
    items: [
      "Serwis – serwis internetowy OP RZUT wraz z panelem, kreatorem, stronami ofert i kuchnią do osadzania na stronach Firm.",
      "Firma – przedsiębiorca (osoba fizyczna prowadząca działalność gospodarczą, osoba prawna albo jednostka organizacyjna z osobowością prawną nadaną ustawą), który zakłada Konto w celu związanym z prowadzoną działalnością, w szczególności stolarnia, studio, salon lub producent mebli.",
      "Użytkownik – osoba fizyczna korzystająca z Konta Firmy (właściciel konta albo osoba dodana przez Firmę).",
      "Konto – zbiór zasobów w Serwisie przypisany Firmie, dostępny po zalogowaniu.",
      "Klient – osoba, której Firma udostępniła link do Oferty, albo osoba korzystająca z formularzy Serwisu lub strony Firmy (np. prośba o wycenę lub pomiar).",
      "Oferta – strona z projektem mebli, wizualizacją 3D, wyceną i możliwością wyboru materiałów, przygotowana przez Firmę w Serwisie i udostępniana Klientowi pod indywidualnym linkiem.",
      "Plan – pakiet funkcji i limitów Serwisu opisany na stronie /cennik (np. Start, Pracownia, Producent).",
      "Treści Firmy – dane, pliki, modele 3D, opisy, ceny, logo i inne materiały wprowadzone do Serwisu przez Firmę lub Użytkowników.",
    ],
  },
  {
    title: "Rodzaje i zakres usług",
    items: [
      "Usługodawca świadczy na rzecz Firm usługę Konta: tworzenie ofert mebli w kreatorze, wgrywanie modeli 3D, udostępnianie Ofert Klientom pod linkiem, powiadomienia e-mail, generowanie dokumentów (np. oferty PDF, list formatek) oraz osadzanie kuchni 3D na stronie Firmy – w zakresie wybranego Planu.",
      "Usługodawca świadczy na rzecz Klientów nieodpłatnie: przeglądanie Ofert, wybór materiałów, przesyłanie uwag, akceptację Oferty oraz wysyłanie zapytań przez formularze.",
      "Oferta przygotowana przez Firmę jest ofertą tej Firmy – Usługodawca nie jest stroną umowy między Firmą a Klientem i nie odpowiada za treść, ceny ani wykonanie mebli. Wizualizacja 3D jest poglądowa; kolory i faktury na ekranie mogą różnić się od rzeczywistych.",
    ],
  },
  {
    title: "Wymagania techniczne",
    items: [
      "Do korzystania z Serwisu potrzebne jest urządzenie z dostępem do internetu, aktualna przeglądarka (Chrome, Edge, Firefox, Safari) z włączoną obsługą JavaScript i WebGL (podgląd 3D) oraz – w przypadku Konta – aktywny adres e-mail.",
      "Serwis korzysta wyłącznie z niezbędnych plików cookies i pamięci przeglądarki (szczegóły: Polityka cookies). Ich zablokowanie może uniemożliwić zalogowanie się do Konta.",
      "Szczególne zagrożenia związane z korzystaniem z usług drogą elektroniczną to m.in. złośliwe oprogramowanie, wyłudzanie danych (phishing) i przejęcie hasła. Użytkownik powinien chronić hasło, nie udostępniać go innym osobom i korzystać z aktualnego oprogramowania. Usługodawca nigdy nie prosi o podanie hasła w wiadomości e-mail.",
    ],
  },
  {
    title: "Konto: zawarcie i rozwiązanie umowy",
    items: [
      "Umowa o świadczenie usługi Konta zostaje zawarta z chwilą rejestracji – podania danych Firmy, akceptacji Regulaminu wraz z Umową powierzenia i utworzenia Konta. Umowa jest zawierana na czas nieokreślony.",
      "Konto może założyć wyłącznie przedsiębiorca w celu związanym z prowadzoną działalnością gospodarczą. Osoba rejestrująca Konto w imieniu Firmy oświadcza, że jest do tego upoważniona.",
      "Nowe Konto ma bezpłatny okres próbny wskazany na stronie /cennik. Okres próbny nie przechodzi automatycznie w płatny Plan – dalsze korzystanie wymaga wyboru i opłacenia Planu. Po okresie próbnym bez opłaty Konto działa w trybie tylko do odczytu, a udostępnione Klientom linki działają do końca ich ważności.",
      "Firma może w każdej chwili rozwiązać umowę, wysyłając prośbę o usunięcie Konta na adres: " + email() + ". Opłacony okres nie podlega zwrotowi, chyba że przepisy stanowią inaczej.",
      "Usługodawca może rozwiązać umowę z zachowaniem 30-dniowego okresu wypowiedzenia, a bez wypowiedzenia – gdy Firma rażąco narusza Regulamin (np. zamieszcza treści bezprawne, podejmuje próby włamania), po bezskutecznym wezwaniu do zaprzestania naruszeń, o ile wezwanie jest możliwe.",
      "Po rozwiązaniu umowy Firma może przez 30 dni poprosić o wydanie swoich danych (oferty, zgłoszenia) w formacie elektronicznym. Następnie dane Konta są usuwane, z wyjątkiem danych, które Usługodawca musi przechowywać na podstawie przepisów (np. faktury).",
    ],
  },
  {
    title: "Plany, opłaty i faktury",
    items: [
      "Opłaty za Plany są określone na stronie /cennik. Ceny podane są w złotych netto – do ceny dolicza się podatek VAT według obowiązującej stawki.",
      "Opłata jest pobierana z góry za okres rozliczeniowy (miesiąc albo rok) na podstawie faktury lub przez operatora płatności wskazanego w Serwisie. Faktury są wystawiane w formie elektronicznej, na co Firma wyraża zgodę.",
      "Usługodawca może zmienić ceny Planów z ważnych przyczyn (np. wzrost kosztów utrzymania, zmiana przepisów). Nowa cena obowiązuje od następnego okresu rozliczeniowego, po powiadomieniu Firmy e-mailem co najmniej 30 dni wcześniej; Firma może przed tym terminem rozwiązać umowę.",
      "Przekroczenie limitu Planu nie powoduje dodatkowych opłat – Serwis blokuje jedynie czynność ponad limit.",
    ],
  },
  {
    title: "Obowiązki Firmy i Treści Firmy",
    items: [
      "Firma odpowiada za Treści Firmy, w tym za to, że ma prawo z nich korzystać (np. prawa autorskie do modeli 3D, zdjęć i logo) oraz że są zgodne z prawem. Firma udziela Usługodawcy niewyłącznej, nieodpłatnej licencji na przechowywanie, przetwarzanie i wyświetlanie Treści Firmy w zakresie niezbędnym do świadczenia usług, na czas trwania umowy.",
      "Firma odpowiada za treść i ceny swoich Ofert wobec Klientów oraz za zgodność swojej działalności z przepisami, w tym ochrony konsumentów.",
      "W zakresie danych osobowych Klientów wprowadzanych do Serwisu (np. imię, telefon, e-mail, uwagi) administratorem danych jest Firma, a Usługodawca przetwarza je w jej imieniu na podstawie Umowy powierzenia (Załącznik nr 1). Firma odpowiada za posiadanie podstawy prawnej przetwarzania i za poinformowanie Klientów (art. 13–14 RODO), w tym o wysyłce powiadomień e-mail o Ofercie (np. przypomnienie o wygasającym linku), które Firma może wyłączyć w ustawieniach.",
      "Firma, która osadza kuchnię 3D Serwisu na swojej stronie, uwzględnia to w polityce prywatności i polityce cookies swojej strony.",
      "Zakazane jest: dostarczanie treści o charakterze bezprawnym, naruszających dobra osobiste lub prawa osób trzecich; wysyłanie za pomocą Serwisu niezamówionych informacji handlowych; podejmowanie działań zakłócających pracę Serwisu, obchodzenie zabezpieczeń i limitów; udostępnianie Konta osobom nieupoważnionym.",
    ],
  },
  {
    title: "Zgłaszanie nielegalnych treści",
    items: [
      `Punktem kontaktowym Usługodawcy dla organów państw członkowskich UE, Komisji Europejskiej i odbiorców usług (art. 11 i 12 rozporządzenia (UE) 2022/2065 – Aktu o usługach cyfrowych) jest adres e-mail: ${email()}. Komunikacja odbywa się w języku polskim lub angielskim.`,
      "Każdy może zgłosić treść w Serwisie, którą uważa za nielegalną, wysyłając wiadomość na powyższy adres. Zgłoszenie powinno zawierać: uzasadnienie, dlaczego treść jest nielegalna, dokładny adres (URL) treści, imię i nazwisko (lub nazwę) i adres e-mail zgłaszającego (nie dotyczy zgłoszeń o niektórych przestępstwach przeciwko dzieciom) oraz oświadczenie, że zgłoszenie jest dokonywane w dobrej wierze, a zawarte w nim informacje są prawidłowe i kompletne.",
      "Usługodawca potwierdza otrzymanie zgłoszenia, rozpatruje je bez zbędnej zwłoki, w sposób staranny i obiektywny, i informuje zgłaszającego o decyzji. Jeśli treść zostanie usunięta lub dostęp do niej zostanie zablokowany, Usługodawca przekazuje Firmie uzasadnienie decyzji (art. 17 Aktu o usługach cyfrowych). Od decyzji można się odwołać, pisząc na ten sam adres.",
      "Usługodawca nie stosuje zautomatyzowanego moderowania treści.",
    ],
  },
  {
    title: "Odpowiedzialność",
    items: [
      "Usługodawca dokłada starań, by Serwis działał nieprzerwanie i bezpiecznie. Firma powinna przechowywać kopie dokumentów ważnych dla jej działalności (np. pobrane oferty PDF) także poza Serwisem. Usługodawca może czasowo ograniczyć dostęp do Serwisu z przyczyn technicznych (np. konserwacja, aktualizacja), w miarę możliwości informując o tym z wyprzedzeniem.",
      "Wobec Firm odpowiedzialność Usługodawcy z tytułu umowy jest ograniczona do szkody rzeczywistej i do wysokości opłat zapłaconych przez Firmę za ostatnie 12 miesięcy; Usługodawca nie odpowiada za utracone korzyści. Ograniczenie nie dotyczy szkody wyrządzonej umyślnie.",
      "Usługodawca nie odpowiada za Treści Firmy, za Oferty Firm ani za umowy zawierane między Firmą a Klientem.",
    ],
  },
  {
    title: "Reklamacje",
    items: [
      `Reklamacje dotyczące działania Serwisu można zgłaszać na adres: ${email()}. Reklamacja powinna zawierać dane kontaktowe i opis problemu.`,
      "Usługodawca rozpatruje reklamację w ciągu 14 dni od jej otrzymania i odpowiada e-mailem albo w sposób wskazany przez zgłaszającego.",
    ],
  },
  {
    title: "Klienci będący konsumentami",
    items: [
      "Korzystanie z Serwisu przez Klienta (przeglądanie Oferty, uwagi, akceptacja, formularze) jest bezpłatne i nie wymaga zakładania konta. Umowa o świadczenie tych usług zostaje zawarta z chwilą otwarcia Oferty lub wysłania formularza i rozwiązuje się z chwilą opuszczenia strony.",
      "Akceptacja Oferty lub wysłanie zapytania w Serwisie nie jest zawarciem umowy na wykonanie mebli – taka umowa jest zawierana bezpośrednio między Klientem a Firmą.",
      "Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, np. z pomocy miejskiego lub powiatowego rzecznika konsumentów albo wojewódzkiego inspektoratu Inspekcji Handlowej. Informacje: uokik.gov.pl.",
      "Przepisy dotyczące konsumentów stosuje się także do osoby fizycznej zawierającej umowę bezpośrednio związaną z jej działalnością gospodarczą, gdy z treści umowy wynika, że nie ma ona dla niej charakteru zawodowego (art. 385⁵ Kodeksu cywilnego i art. 38a ustawy o prawach konsumenta) – w zakresie, w jakim przysługuje jej ta ochrona.",
    ],
  },
  {
    title: "Dane osobowe i pliki cookies",
    items: [
      "Zasady przetwarzania danych osobowych opisuje Polityka prywatności (oprzut.app/polityka-prywatnosci), a pliki cookies – Polityka cookies (oprzut.app/polityka-cookies).",
    ],
  },
  {
    title: "Postanowienia końcowe",
    items: [
      "Usługodawca może zmienić Regulamin z ważnych przyczyn, w szczególności zmiany przepisów, zmiany funkcji Serwisu lub zapewnienia bezpieczeństwa. Firmy są powiadamiane e-mailem co najmniej 14 dni przed wejściem zmian w życie (30 dni – przy zmianie cen); Firma, która nie akceptuje zmian, może przed tym terminem rozwiązać umowę.",
      "Prawem właściwym jest prawo polskie. Spory z Firmami rozstrzyga sąd właściwy dla siedziby Usługodawcy; nie dotyczy to sporów z konsumentami i osobami, o których mowa w § 11 ust. 4.",
      "Regulamin obowiązuje od dnia " + LEGAL_UPDATED + ".",
    ],
  },
];

/* ===================================================================================================== */
/* Umowa powierzenia (Załącznik nr 1 do Regulaminu)                                                       */
/* ===================================================================================================== */

export const POWIERZENIE: LegalSection[] = [
  {
    title: "Strony i przedmiot",
    items: [
      `Umowa powierzenia przetwarzania danych osobowych (dalej: „Umowa”) jest zawierana między Firmą jako administratorem (dalej: „Administrator”) a ${admin()} jako podmiotem przetwarzającym (dalej: „Przetwarzający”), na podstawie art. 28 ust. 3 RODO. Umowa jest zawierana wraz z akceptacją Regulaminu i obowiązuje przez czas świadczenia usług.`,
      "Administrator powierza Przetwarzającemu przetwarzanie danych osobowych wprowadzanych do Serwisu w ramach Konta, w zakresie i celu niezbędnym do świadczenia usług opisanych w Regulaminie.",
    ],
  },
  {
    title: "Zakres, charakter i cel przetwarzania",
    items: [
      "Kategorie osób: Klienci Administratora (osoby, którym udostępniono Ofertę, osoby wysyłające zapytania przez stronę lub Ofertę Administratora) oraz Użytkownicy Konta.",
      "Rodzaje danych: imię i nazwisko lub nazwa, numer telefonu, adres e-mail, adres (np. miejsca montażu), treść uwag i zapytań, wybory w Ofercie, informacje o otwarciu i akceptacji Oferty, dane w plikach wgranych przez Administratora.",
      "Charakter przetwarzania: przechowywanie, organizowanie, udostępnianie Klientowi Oferty, wyświetlanie, wysyłanie powiadomień e-mail wskazanych w ustawieniach Konta, usuwanie.",
      "Cel: świadczenie usług Serwisu na rzecz Administratora. Przetwarzający nie przetwarza powierzonych danych we własnych celach.",
    ],
  },
  {
    title: "Obowiązki Przetwarzającego",
    items: [
      "Przetwarzający przetwarza dane wyłącznie na udokumentowane polecenie Administratora – za takie polecenie uważa się korzystanie z funkcji Serwisu oraz ustawienia Konta – także w zakresie przekazywania danych do państwa trzeciego, chyba że obowiązek przetwarzania nakłada na niego prawo; w takim przypadku informuje o tym Administratora, o ile prawo tego nie zabrania.",
      "Przetwarzający zapewnia, by osoby upoważnione do przetwarzania danych zobowiązały się do zachowania tajemnicy.",
      "Przetwarzający stosuje środki techniczne i organizacyjne zapewniające bezpieczeństwo danych (art. 32 RODO), w szczególności: szyfrowane połączenia (HTTPS), skróty haseł (PBKDF2), oddzielenie danych poszczególnych Firm, ograniczenie dostępu do danych, ochronę przed atakami automatycznymi, linki do Ofert z losowym identyfikatorem, opcjonalnie PIN i terminem ważności.",
      "Przetwarzający pomaga Administratorowi, w miarę możliwości, wywiązać się z obowiązku odpowiadania na żądania osób, których dane dotyczą, oraz z obowiązków z art. 32–36 RODO.",
      "Przetwarzający zgłasza Administratorowi naruszenie ochrony danych osobowych bez zbędnej zwłoki, nie później niż w ciągu 36 godzin od jego stwierdzenia, wraz z informacjami z art. 33 ust. 3 RODO, którymi dysponuje.",
      "Przetwarzający udostępnia Administratorowi informacje niezbędne do wykazania spełnienia obowiązków z art. 28 RODO i umożliwia przeprowadzanie audytów, po uzgodnieniu terminu z wyprzedzeniem co najmniej 14 dni, nie częściej niż raz w roku (chyba że audyt jest następstwem naruszenia), na koszt Administratora.",
    ],
  },
  {
    title: "Dalsze powierzenie",
    items: [
      "Administrator udziela ogólnej zgody na korzystanie przez Przetwarzającego z dalszych podmiotów przetwarzających. Aktualna lista: Cloudflare, Inc. (hosting, baza danych, przechowywanie plików, ochrona przed botami – dane mogą być przetwarzane poza EOG na podstawie decyzji Komisji Europejskiej w sprawie EU-US Data Privacy Framework oraz standardowych klauzul umownych) oraz dostawca serwera VPS, z którego wysyłane są wiadomości e-mail.",
      "Przetwarzający informuje Administratora e-mailem o zamierzonych zmianach dotyczących dalszych podmiotów przetwarzających z co najmniej 14-dniowym wyprzedzeniem; Administrator może w tym terminie wyrazić sprzeciw i rozwiązać umowę.",
      "Przetwarzający nakłada na dalsze podmioty przetwarzające te same obowiązki ochrony danych, które wynikają z Umowy.",
    ],
  },
  {
    title: "Zakończenie przetwarzania",
    items: [
      "Po zakończeniu świadczenia usług Przetwarzający – zależnie od decyzji Administratora – zwraca dane (w ciągu 30 dni, na żądanie) albo je usuwa, w tym istniejące kopie, chyba że prawo nakazuje ich dalsze przechowywanie.",
      "Odpowiedzialność stron z tytułu Umowy podlega zasadom określonym w Regulaminie, z zastrzeżeniem art. 82 RODO.",
    ],
  },
];

/* ===================================================================================================== */
/* Polityka prywatności                                                                                  */
/* ===================================================================================================== */

export const POLITYKA: LegalSection[] = [
  {
    title: "Administrator danych",
    items: [
      `Administratorem danych osobowych opisanych w tej polityce jest ${admin()} (dalej: „Administrator”). Kontakt w sprawach danych osobowych: ${kontakt()}.`,
      "Administrator nie wyznaczył inspektora ochrony danych – nie ma takiego obowiązku. We wszystkich sprawach dotyczących danych można pisać na adres podany wyżej.",
    ],
  },
  {
    title: "Kiedy jesteśmy administratorem, a kiedy działamy w imieniu firmy",
    items: [
      "Jesteśmy administratorem danych: osób zakładających i używających kont firm (Użytkowników), osób piszących do nas przez formularz na oprzut.app (np. /kontakt, przykładowa oferta) oraz danych potrzebnych do rozliczeń z firmami.",
      "Jeśli otrzymałeś link do oferty od stolarni, salonu lub innej firmy korzystającej z OP RZUT albo wysłałeś zapytanie przez jej ofertę lub stronę, administratorem Twoich danych jest ta firma (jej nazwa jest widoczna na ofercie). My przetwarzamy te dane wyłącznie w jej imieniu, na podstawie umowy powierzenia (art. 28 RODO). Ze swoimi prawami najlepiej zwrócić się bezpośrednio do tej firmy – jeśli napiszesz do nas, przekażemy żądanie firmie.",
    ],
  },
  {
    title: "Jakie dane, w jakim celu i na jakiej podstawie",
    items: [
      "Konto firmy (Użytkownicy): imię i nazwisko, e-mail, skrót hasła, nazwa i NIP firmy, dane do faktury – w celu założenia i prowadzenia konta oraz świadczenia usług (art. 6 ust. 1 lit. b RODO – umowa; w przypadku Użytkowników dodanych przez firmę – art. 6 ust. 1 lit. f RODO, prawnie uzasadniony interes polegający na obsłudze konta firmy).",
      "Rozliczenia: dane z faktur – w celu wystawienia faktur i prowadzenia księgowości (art. 6 ust. 1 lit. c RODO – obowiązek prawny wynikający z przepisów podatkowych i o rachunkowości).",
      "Formularze na oprzut.app: imię, e-mail i/lub telefon, nazwa firmy, treść wiadomości – w celu odpowiedzi i przedstawienia oferty na Twoje żądanie (art. 6 ust. 1 lit. b RODO) oraz prowadzenia korespondencji (art. 6 ust. 1 lit. f RODO).",
      "Bezpieczeństwo: adres IP i dane techniczne przeglądarki – w celu ochrony przed nadużyciami (limity prób logowania i wysyłki formularzy, ochrona przed botami Cloudflare Turnstile) oraz ustalenia, dochodzenia lub obrony roszczeń (art. 6 ust. 1 lit. f RODO).",
      "Statystyki odwiedzin i pomiar reklam (Google Analytics 4, Google Ads) – wyłącznie za Twoją zgodą wyrażoną w banerze cookies (art. 6 ust. 1 lit. a RODO w związku z art. 399 ust. 1 Prawa komunikacji elektronicznej). Zgodę możesz wycofać w każdej chwili („Ustawienia cookies” na dole strony); wycofanie nie wpływa na zgodność z prawem wcześniejszego przetwarzania.",
      "Wiadomości e-mail związane z kontem (np. link do zmiany hasła, powiadomienia o ofertach, zmiany regulaminu) – w ramach świadczenia usług (art. 6 ust. 1 lit. b RODO). Nie wysyłamy newslettera ani reklam.",
      "Podanie danych jest dobrowolne, ale bez nich nie założymy konta, nie wystawimy faktury ani nie odpowiemy na wiadomość.",
    ],
  },
  {
    title: "Jak długo przechowujemy dane",
    items: [
      "Dane konta – do czasu jego usunięcia; następnie do 30 dni (możliwość wydania danych na żądanie firmy).",
      "Wiadomości z formularzy – 180 dni od wysłania (usuwane automatycznie), chyba że wcześniej zawrzemy umowę.",
      "Rejestr decyzji dotyczących cookies (bez danych identyfikujących) – 3 lata; wybór zapisany w Twojej przeglądarce – 12 miesięcy.",
      "Faktury i dane rozliczeniowe – 5 lat od końca roku kalendarzowego, w którym upłynął termin płatności podatku (przepisy podatkowe).",
      "Adresy IP do zabezpieczeń – od 30 minut do 1 godziny (liczniki prób); sesja logowania – do 30 dni lub do wylogowania.",
      "Dane potrzebne do obrony roszczeń – do upływu terminu przedawnienia roszczeń.",
    ],
  },
  {
    title: "Odbiorcy danych i przekazywanie poza EOG",
    items: [
      "Cloudflare, Inc. – hosting serwisu, baza danych, przechowywanie plików, ochrona przed botami (Turnstile). Cloudflare może przetwarzać dane poza Europejskim Obszarem Gospodarczym, w tym w USA – na podstawie decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony (EU-US Data Privacy Framework, w którym Cloudflare uczestniczy) oraz standardowych klauzul umownych.",
      "Dostawca serwera VPS, z którego wysyłamy wiadomości e-mail – w zakresie adresu odbiorcy i treści wiadomości.",
      "Google Ireland Limited i Google LLC – tylko jeśli wyrazisz zgodę na pliki analityczne lub marketingowe (Google Analytics 4, Google Ads). Google może przetwarzać dane w USA – na podstawie decyzji Komisji Europejskiej w sprawie EU-US Data Privacy Framework. W zakresie reklam Google może działać jako odrębny administrator (policies.google.com/privacy).",
      "Biuro rachunkowe i operator płatności (jeśli płacisz online) – w zakresie danych do rozliczeń.",
      "Organy publiczne – wyłącznie, gdy wymagają tego przepisy.",
      "Wszyscy dostawcy działają na podstawie umów powierzenia i przetwarzają dane tylko na nasze polecenie.",
    ],
  },
  {
    title: "Twoje prawa",
    items: [
      "Masz prawo: dostępu do danych i otrzymania ich kopii, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych (gdy przetwarzamy je na podstawie umowy) oraz sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie.",
      "Aby skorzystać z praw, napisz na adres podany w § 1. Odpowiemy w ciągu miesiąca (w wyjątkowych przypadkach termin może zostać przedłużony o dwa miesiące – poinformujemy o tym).",
      "Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).",
      "Nie podejmujemy decyzji w sposób zautomatyzowany i nie profilujemy (art. 22 RODO).",
    ],
  },
  {
    title: "Pliki cookies i pamięć przeglądarki",
    items: [
      "Niezbędne pliki cookies i pamięć przeglądarki służą do utrzymania sesji logowania, ochrony przed botami i zapamiętania Twoich ustawień. Pliki analityczne i marketingowe (Google) zapisujemy wyłącznie za Twoją zgodą, a sygnały zgody przekazujemy Google przez Consent Mode v2 – domyślnie wszystkie są ustawione na „odmowa”.",
      "Szczegóły i lista plików: Polityka cookies (oprzut.app/polityka-cookies).",
    ],
  },
  {
    title: "Bezpieczeństwo",
    items: [
      "Stosujemy szyfrowane połączenia (HTTPS), skróty haseł (PBKDF2), oddzielenie danych poszczególnych firm, ograniczenie liczby prób logowania i nagłówki bezpieczeństwa przeglądarki. Linki do ofert mają losowe identyfikatory, mogą mieć PIN i termin ważności.",
      "Pliki potrzebne do działania serwisu (np. dekoder modeli 3D, czcionki) wczytujemy z własnego serwera – bez Twojej zgody przeglądarka nie łączy się z serwerami Google ani innych dostawców reklam i statystyk.",
    ],
  },
  {
    title: "Zmiany polityki",
    items: [
      "Politykę aktualizujemy, gdy zmieniają się przepisy, dostawcy albo funkcje serwisu. Aktualna wersja jest zawsze dostępna na tej stronie; o istotnych zmianach informujemy firmy e-mailem.",
    ],
  },
];

/* ===================================================================================================== */
/* Polityka cookies                                                                                      */
/* ===================================================================================================== */

export const COOKIES: LegalSection[] = [
  {
    title: "Czym są pliki cookies i pamięć przeglądarki",
    items: [
      "Pliki cookies to małe pliki tekstowe zapisywane przez stronę w Twojej przeglądarce. Podobnie działa pamięć przeglądarki (localStorage), w której strona może zapisać ustawienia na Twoim urządzeniu. Polityka opisuje jedno i drugie.",
      `Podmiotem zapisującym pliki i korzystającym z nich jest ${admin()}; w zakresie ochrony przed botami – również Cloudflare, Inc., a za Twoją zgodą – Google (Google Ireland Limited i Google LLC).`,
    ],
  },
  {
    title: "Kategorie plików i zgoda",
    items: [
      "Niezbędne – logowanie, bezpieczeństwo, zapamiętanie Twoich ustawień i wyboru dotyczącego cookies. Nie wymagają zgody (art. 399 ust. 3 ustawy – Prawo komunikacji elektronicznej); bez nich serwis nie działa.",
      "Analityczne – statystyki odwiedzin (Google Analytics 4). Tylko za Twoją zgodą (art. 399 ust. 1 Prawa komunikacji elektronicznej, art. 6 ust. 1 lit. a RODO).",
      "Marketingowe – pomiar skuteczności reklam i dopasowanie reklam (Google Ads): przekazanie Google danych o wizycie w celach reklamowych. Tylko za Twoją zgodą.",
      "Przy pierwszej wizycie wybierasz w banerze: „Akceptuj wszystkie”, „Odrzuć wszystkie” albo „Ustawienia” (wybór kategorii). Odmowa jest tak samo łatwa jak zgoda, a brak zgody nie ogranicza korzystania z serwisu.",
      "Zgodę możesz w każdej chwili zmienić albo wycofać – link „Ustawienia cookies” na dole każdej strony albo przycisk na górze tej strony. Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania przed wycofaniem; usuwamy wtedy pliki Google z naszej domeny.",
      "Zapytamy ponownie po 12 miesiącach albo gdy zmienią się kategorie lub dostawcy.",
    ],
  },
  {
    title: "Google Consent Mode v2",
    items: [
      "Stosujemy Google Consent Mode v2. Zanim załaduje się jakikolwiek tag Google, wszystkie sygnały zgody są ustawione na „odmowa” (ad_storage, ad_user_data, ad_personalization, analytics_storage). Po Twojej decyzji przekazujemy Google tylko to, na co się zgodziłeś.",
      "Tagi Google (Google Analytics, Google Ads, Google Tag Manager) ładujemy dopiero po zgodzie na pliki analityczne lub marketingowe. Bez zgody przeglądarka nie łączy się z serwerami Google.",
      "Rejestrujemy Twoją decyzję (losowy identyfikator, wersja zgody, wybrane kategorie, data) – żeby wykazać, że zgoda została udzielona (art. 7 ust. 1 RODO). Rejestr nie zawiera adresu IP ani danych pozwalających Cię zidentyfikować i jest przechowywany 3 lata.",
    ],
  },
  {
    title: "Pliki niezbędne",
    items: ["Zapisywane zawsze – bez nich serwis nie działa."],
    tabela: {
      naglowki: ["Nazwa", "Rodzaj", "Cel", "Ważność"],
      wiersze: [
        ["so_sesja", "cookie (HttpOnly, Secure)", "Sesja zalogowania do panelu firmy – tylko po zalogowaniu", "30 dni lub do wylogowania"],
        ["Pliki Cloudflare Turnstile (np. cf_clearance) i __cf_bm", "cookie Cloudflare", "Ochrona formularzy logowania, rejestracji i serwisu przed botami i atakami", "do 30 minut – 1 roku (ustala Cloudflare)"],
        ["oprzut:zgody", "pamięć przeglądarki", "Twój wybór dotyczący cookies (kategorie, wersja, data)", "12 miesięcy"],
        ["motyw", "pamięć przeglądarki", "Wybrany motyw: jasny albo ciemny", "do usunięcia przez Ciebie"],
        ["studio-kuchnie:panel-sesja, studio-kuchnie:panel-token", "pamięć przeglądarki", "Znacznik zalogowania (żeby nie migało okno logowania); kod administratora – tylko u administratora", "do wylogowania"],
        ["op-rzut:samouczek-kreatora", "pamięć przeglądarki", "Czy samouczek kreatora był już pokazany", "do usunięcia przez Ciebie"],
        ["kr-katalog-*", "pamięć przeglądarki", "Które kategorie katalogu w kreatorze są rozwinięte", "do usunięcia przez Ciebie"],
        ["oferta:obroc-telefon-zamkniete", "pamięć przeglądarki", "Zamknięta podpowiedź „obróć telefon” na stronie oferty", "do usunięcia przez Ciebie"],
        ["oprzut-produkcja-v1", "pamięć przeglądarki", "Lista formatek w module rozkroju – zapis roboczy w Twojej przeglądarce", "do usunięcia przez Ciebie"],
      ],
    },
  },
  {
    title: "Pliki zapisywane tylko za Twoją zgodą",
    items: [
      "Zapisywane wyłącznie po zgodzie na daną kategorię i tylko wtedy, gdy narzędzie jest włączone w serwisie. Dostawca: Google Ireland Limited (Irlandia) i Google LLC (USA) – przekazanie danych do USA na podstawie decyzji Komisji Europejskiej w sprawie EU-US Data Privacy Framework, w którym Google uczestniczy. Zasady Google: policies.google.com/privacy.",
    ],
    tabela: {
      naglowki: ["Nazwa", "Kategoria", "Cel", "Ważność"],
      wiersze: [
        ["_ga", "analityczne", "Google Analytics 4 – rozróżnienie użytkowników w statystykach", "2 lata"],
        ["_ga_<identyfikator>", "analityczne", "Google Analytics 4 – stan sesji", "2 lata"],
        ["_gcl_au", "marketingowe", "Google Ads – pomiar konwersji z reklam", "90 dni"],
        ["_gcl_aw, _gcl_dc", "marketingowe", "Google Ads – identyfikator kliknięcia reklamy", "90 dni"],
        ["IDE, test_cookie (domena doubleclick.net)", "marketingowe", "Google – wyświetlanie i pomiar reklam", "do 13 miesięcy"],
      ],
    },
  },
  {
    title: "Jak zarządzać plikami cookies",
    items: [
      "Najprościej: link „Ustawienia cookies” na dole strony. Możesz też usunąć pliki cookies i dane stron albo zablokować ich zapisywanie w ustawieniach przeglądarki (zwykle: Ustawienia → Prywatność i bezpieczeństwo → Pliki cookie i dane witryn).",
      "Zablokowanie niezbędnych plików może uniemożliwić zalogowanie się do panelu albo wysłanie formularza (ochrona przed botami).",
    ],
  },
  {
    title: "Oferty firm i kuchnia 3D osadzona na stronach firm",
    items: [
      "Na stronach ofert, które firmy wysyłają swoim klientom (oprzut.app/oferta/…), oraz w kuchni 3D osadzonej na stronach firm nie ładujemy żadnych narzędzi analitycznych ani marketingowych – zapisywane są wyłącznie pliki niezbędne z tabeli powyżej. Za informację o plikach na stronie firmy odpowiada ta firma.",
    ],
  },
  {
    title: "Kontakt",
    items: [`Pytania dotyczące plików cookies: ${kontakt()}. Więcej o danych osobowych: Polityka prywatności (oprzut.app/polityka-prywatnosci).`],
  },
];
