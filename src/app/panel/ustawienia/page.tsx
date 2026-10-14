import type { Metadata } from "next";
import localFont from "next/font/local";
import SettingsApp from "@/components/panel/SettingsApp";
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
  title: "Ustawienia · Panel ofert",
  description: "Modele 3D, pakiety kolorów RAL i własna domena linków.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <div className={`${geist.variable} ${geistMono.variable}`}>
      <SettingsApp />
    </div>
  );
}
