import type { Metadata } from "next";
import localFont from "next/font/local";
import RozkrojApp from "@/components/produkcja/RozkrojApp";
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
  title: "Formatki i rozkrój · Panel ofert · OP RZUT",
  description: "Lista formatek z KD Max, PRO100 lub Excela, rozkrój płyt i CSV dla hurtowni.",
  robots: { index: false, follow: false },
};

export default function RozkrojPage() {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <RozkrojApp />
    </div>
  );
}
