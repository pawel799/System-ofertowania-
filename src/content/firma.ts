/*
 * Dane firmy – JEDYNE miejsce, w którym się je wpisuje.
 * Używają ich: stopka (SiteFooter), strona /kontakt i podgląd maila z ofertą (/podglad-maila).
 *
 * Puste pole ("") = nie pokazujemy go nigdzie (bez zastępczych „000…”).
 * Wpisz prawdziwe dane przed publikacją; nic tu nie zmyślamy.
 */
export const FIRMA = {
  /** Pełna nazwa prawna, np. "Jan Kowalski Meble sp. z o.o.". */
  nazwaPrawna: "",
  /** Nazwa handlowa pokazywana klientom (nagłówek maila, podpis). */
  nazwaHandlowa: "Studio Kuchnie",
  /** NIP w zapisie z kreskami, np. "123-456-78-90". */
  nip: "",
  /** REGON (opcjonalnie). */
  regon: "",
  /** KRS (opcjonalnie, tylko spółki). */
  krs: "",
  /** Ulica i numer, np. "ul. Stolarska 5". */
  ulica: "",
  /** Kod i miejscowość, np. "00-001 Warszawa". */
  kodMiasto: "",
  /** Adres e-mail do kontaktu. */
  email: "",
  /** Telefon, np. "+48 600 000 000". */
  telefon: "",
  /** Godziny pracy biura. */
  godziny: "pon.–pt. 9:00–17:00",
};

/** Adres w jednej linii albo "" gdy brak danych. */
export const adresFirmy = () => [FIRMA.ulica, FIRMA.kodMiasto].filter(Boolean).join(", ");

/** Linia rejestrowa do stopki: nazwa · NIP · adres – tylko uzupełnione części. */
export const liniaRejestrowa = () =>
  [FIRMA.nazwaPrawna, FIRMA.nip && `NIP ${FIRMA.nip}`, FIRMA.krs && `KRS ${FIRMA.krs}`, adresFirmy()]
    .filter(Boolean)
    .join(" · ");
