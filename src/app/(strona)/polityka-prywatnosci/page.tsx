import type { Metadata } from "next";
import { POLITYKA } from "@/content/prawne";
import LegalDoc from "@/components/site/LegalDoc";

export const metadata: Metadata = { title: "Polityka prywatności · OP RZUT" };

export default function PolitykaPage() {
  return (
    <LegalDoc
      eyebrow="Dokumenty"
      title="Polityka prywatności"
      sections={POLITYKA}
    />
  );
}
