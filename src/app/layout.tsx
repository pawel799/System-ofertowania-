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
  title: "System ofertowania",
  description: "Oferty mebli na wymiar w 3D.",
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
