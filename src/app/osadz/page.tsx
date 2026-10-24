import type { Metadata } from "next";
import EmbedOffer from "@/components/EmbedOffer";

/* Kuchnia 3D firmy do osadzenia na jej stronie (iframe). Id firmy w adresie: /osadz?f=<id>. */
export const metadata: Metadata = {
  title: "Kuchnia 3D",
  robots: { index: false, follow: false },
};

export default function OsadzPage() {
  return <EmbedOffer />;
}
