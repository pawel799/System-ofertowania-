import type { Metadata } from "next";
import localFont from "next/font/local";
import PanelApp from "@/components/panel/PanelApp";
import "./panel.css";

// Geist jest już w repo (src/app/fonts); panel używa go zamiast Rubika ze strony oferty.
const geist = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Panel ofert",
  description: "Oferty kuchni, linki dla klientów i podgląd 3D.",
  robots: { index: false, follow: false },
};

export default function PanelPage() {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <PanelApp />
    </div>
  );
}
