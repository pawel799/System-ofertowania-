import type { Metadata } from "next";
import { COOKIES } from "@/content/prawne";
import LegalDoc from "@/components/site/LegalDoc";

export const metadata: Metadata = { title: "Polityka cookies · OP RZUT" };

export default function PolitykaCookiesPage() {
  return <LegalDoc eyebrow="Dokumenty" title="Polityka cookies" sections={COOKIES} />;
}
