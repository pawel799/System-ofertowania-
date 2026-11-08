import type { Metadata } from "next";
import { POWIERZENIE } from "@/content/prawne";
import LegalDoc from "@/components/site/LegalDoc";

export const metadata: Metadata = { title: "Umowa powierzenia przetwarzania danych · OP RZUT" };

export default function UmowaPowierzeniaPage() {
  return <LegalDoc eyebrow="Załącznik nr 1 do Regulaminu" title="Umowa powierzenia przetwarzania danych osobowych" sections={POWIERZENIE} />;
}
