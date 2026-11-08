import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { SKRYPT_MOTYWU } from "@/lib/motywSkrypt";
import { SKRYPT_ZGOD } from "@/lib/zgodySkrypt";
import ZgodyCookies from "@/components/ZgodyCookies";

// Rubik to jedyny globalny font strony (tylko grubość 400, z polskimi znakami).
const rubik = Rubik({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OP RZUT",
  description: "Oferty mebli na wymiar w 3D.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        {/* Google Consent Mode v2: domyślnie „denied” PRZED jakimkolwiek tagiem + zapisany wybór (src/lib/zgody.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SKRYPT_ZGOD }} />
        {/* Motyw jasny / ciemny z localStorage przed pierwszym malowaniem (src/lib/motyw.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SKRYPT_MOTYWU }} />
      </head>
      <body className={`${rubik.className} antialiased`}>
        {children}
        {/* Baner i ustawienia zgód na cookies (Consent Mode v2). */}
        <ZgodyCookies />
      </body>
    </html>
  );
}
