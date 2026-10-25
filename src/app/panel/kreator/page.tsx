import type { Metadata } from "next";
import localFont from "next/font/local";
import KreatorApp from "@/components/panel/KreatorApp";
import "../panel.css";

const geist = localFont({
  src: "../../fonts/GeistVF.woff",
  variable: "--font-geist",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Kreator kuchni · Panel ofert",
  description: "Złóż kuchnię z modułów albo modeli firmy i zapisz ją jako ofertę.",
  robots: { index: false, follow: false },
};

export default function KreatorPage() {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <KreatorApp />
    </div>
  );
}
