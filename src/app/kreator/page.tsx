import type { Metadata } from "next";
import localFont from "next/font/local";
import KreatorApp from "@/components/panel/KreatorApp";
import "../panel/panel.css";

// Test kreatora bez konta: ten sam kreator co w panelu (KreatorApp z test), bez logowania
// i bez zapisu na serwerze. Projekt można zapisać w linku (część adresu po "#").
const geist = localFont({ src: "../fonts/GeistVF.woff", variable: "--font-geist", weight: "100 900" });
const geistMono = localFont({ src: "../fonts/GeistMonoVF.woff", variable: "--font-geist-mono", weight: "100 900" });

export const metadata: Metadata = {
  title: "Test kreatora · OP RZUT",
  description:
    "Wypróbuj kreator mebli na wymiar bez konta: kuchnia w 3D, rzut, ściany, materiały i wycena. Nic nie wysyłamy na serwer – projekt zapiszesz w linku.",
};

export default function KreatorTestPage() {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <KreatorApp test />
    </div>
  );
}
