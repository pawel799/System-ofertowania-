import type { Config } from "tailwindcss";

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
      },
    },
  },
  plugins: [],
};
export default config;
