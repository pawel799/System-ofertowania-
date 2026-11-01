/*
 * Skrypt do <head> (layout.tsx, komponent serwerowy – dlatego osobny plik bez „use client”):
 * ustawia <html data-motyw> z localStorage przed pierwszym malowaniem, bez mignięcia ciemnego / jasnego.
 */
export const KLUCZ_MOTYWU = "motyw";

export const SKRYPT_MOTYWU = `try{var m=localStorage.getItem("${KLUCZ_MOTYWU}");if(m==="jasny"||m==="ciemny")document.documentElement.setAttribute("data-motyw",m)}catch(e){}`;
