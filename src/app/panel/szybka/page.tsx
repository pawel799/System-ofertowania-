import type { Metadata } from "next";
import localFont from "next/font/local";
import SzybkaOfertaApp from "@/components/panel/SzybkaOfertaApp";
import "../panel.css";

// Ten sam krój co panel ofert (Geist z repo).
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
  title: "Szybka oferta · Panel ofert · OP RZUT",
  description: "Opisz, czego potrzebuje klient – elementy i cena układają się same.",
  robots: { index: false, follow: false },
};

export default function SzybkaPage() {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <SzybkaOfertaApp />
    </div>
  );
}
