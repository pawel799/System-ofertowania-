/*
 * Skrypt do <head> (layout.tsx – komponent serwerowy, dlatego osobny plik bez „use client”), wykonywany PRZED
 * jakimkolwiek tagiem Google: Consent Mode v2 – wszystko „denied” domyślnie, potem zapisany wybór użytkownika
 * (jeśli jest aktualny) jako 'update'. Logika i stałe: src/lib/zgody.ts (te same klucze i wersja).
 */
import { KLUCZ_ZGOD, WAZNOSC_DNI, WERSJA_ZGOD } from "./zgodyStale";

export const SKRYPT_ZGOD = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;
gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied",functionality_storage:"granted",personalization_storage:"denied",security_storage:"granted",wait_for_update:500});
gtag("set","ads_data_redaction",true);gtag("set","url_passthrough",false);
try{var z=JSON.parse(localStorage.getItem("${KLUCZ_ZGOD}")||"null");if(z&&z.wersja==="${WERSJA_ZGOD}"&&Date.now()-Date.parse(z.at)<${WAZNOSC_DNI}*864e5){var m=z.marketingowe?"granted":"denied";gtag("consent","update",{ad_storage:m,ad_user_data:m,ad_personalization:m,analytics_storage:z.analityczne?"granted":"denied"})}}catch(e){}`;
