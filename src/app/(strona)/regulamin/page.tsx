import type { Metadata } from "next";
import LegalDoc from "@/components/site/LegalDoc";

export const metadata: Metadata = { title: "Regulamin · System ofertowania" };

export default function RegulaminPage() {
  return (
    <LegalDoc
      eyebrow="Dokumenty"
      title="Regulamin świadczenia usług"
      sections={[
        "Postanowienia ogólne",
        "Definicje",
        "Konto i rejestracja",
        "Abonament i płatności",
        "Odpowiedzialność",
        "Reklamacje",
        "Postanowienia końcowe",
      ]}
    />
  );
}
