import type { Metadata } from "next";
import localFont from "next/font/local";
import RequestsApp from "@/components/panel/RequestsApp";
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
  title: "Zgłoszenia · Panel ofert · OP RZUT",
  description: "Prośby o wycenę i pomiar oraz wiadomości z formularza kontaktowego.",
  robots: { index: false, follow: false },
};

export default function RequestsPage() {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <RequestsApp />
    </div>
  );
}
