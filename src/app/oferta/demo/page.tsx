import type { Metadata } from "next";
import OfferView from "@/components/OfferView";

export const metadata: Metadata = {
  title: "Oferta KUCH-2026/12",
  description: "Oferta prywatna: kuchnia w linii dębowej, układ L.",
};

export default function OfertaDemoPage() {
  return (
    <OfferView
      code="KUCH-2026/12"
      title={
        <>
          Linia dębowa, <span className="whitespace-nowrap">w kształcie L</span>
        </>
      }
    />
  );
}
