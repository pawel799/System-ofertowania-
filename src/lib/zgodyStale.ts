/* Stałe zgód wspólne dla skryptu w <head> (zgodySkrypt.ts) i logiki w przeglądarce (zgody.ts). */

/** Zmiana treści zgody (nowe kategorie, nowi dostawcy) → nowa wersja = pytamy ponownie. */
export const WERSJA_ZGOD = "2026-11-08";
export const KLUCZ_ZGOD = "oprzut:zgody";
/** Po tylu dniach pytamy ponownie (organy ochrony danych: nie dłużej niż ok. 12 miesięcy). */
export const WAZNOSC_DNI = 365;
