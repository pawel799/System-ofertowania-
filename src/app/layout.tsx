import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

// Rubik to jedyny globalny font strony (tylko grubość 400, z polskimi znakami).
const rubik = Rubik({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Studio Kuchnie",
  description: "Projekty i oferty kuchni na wymiar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className={`${rubik.className} antialiased`}>{children}</body>
    </html>
  );
}
