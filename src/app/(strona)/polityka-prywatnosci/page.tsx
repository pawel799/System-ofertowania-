import type { Metadata } from "next";
import LegalDoc from "@/components/site/LegalDoc";

export const metadata: Metadata = { title: "Polityka prywatności · System ofertowania" };

export default function PolitykaPage() {
  return (
    <LegalDoc
      eyebrow="Dokumenty"
      title="Polityka prywatności"
      sections={[
        "Administrator danych",
        "Jakie dane zbieramy",
        "Cele i podstawy przetwarzania",
        "Odbiorcy danych",
        "Pliki cookies",
        "Twoje prawa",
        "Kontakt w sprawie danych",
      ]}
    />
  );
}
