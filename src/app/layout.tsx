import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import { SKRYPT_MOTYWU } from "@/lib/motywSkrypt";

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
        {/* Motyw jasny / ciemny z localStorage przed pierwszym malowaniem (src/lib/motyw.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SKRYPT_MOTYWU }} />
      </head>
      <body className={`${rubik.className} antialiased`}>{children}</body>
    </html>
  );
}
