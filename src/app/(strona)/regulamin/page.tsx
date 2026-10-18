import type { Metadata } from "next";
import { REGULAMIN } from "@/content/prawne";
import LegalDoc from "@/components/site/LegalDoc";

export const metadata: Metadata = { title: "Regulamin · System ofertowania" };

export default function RegulaminPage() {
  return (
    <LegalDoc
      eyebrow="Dokumenty"
      title="Regulamin świadczenia usług"
      sections={REGULAMIN}
    />
  );
}
