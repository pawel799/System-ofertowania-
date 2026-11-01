import type { Config } from "tailwindcss";

/*
 * Kolory strony i oferty ze zmiennych (--k-*, globals.css), żeby jasny motyw mógł je podmienić
 * (src/lib/motyw.ts). Wartości domyślne = standardowa paleta Tailwinda, więc wygląd bez wyboru motywu się nie zmienia.
 */
const k = (nazwa: string) => `rgb(var(--k-${nazwa}) / <alpha-value>)`;
const skala = (nazwa: string) =>
  Object.fromEntries(["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map((n) => [n, k(`${nazwa}-${n}`)]));

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        // Strona oferty: układ „scena na cały ekran + nakładka” tylko na szerokim I wysokim ekranie.
        // Telefon w poziomie (np. 844×390) dostaje układ przewijany jak w pionie.
        desk: { raw: "(min-width: 768px) and (min-height: 501px)" },
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        white: k("white"),
        black: k("black"),
        stone: skala("stone"),
        neutral: skala("neutral"),
        red: skala("red"),
        /** Tło strony i oferty (#0c0b0a) i tło kafelków / sceny (#141311). */
        tlo: k("tlo"),
        tlo2: k("tlo2"),
      },
    },
  },
  plugins: [],
};
export default config;
