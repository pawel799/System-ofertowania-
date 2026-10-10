import type { Metadata } from "next";
import { demoOfferEmail } from "@/lib/offerEmail";

/*
 * Podgląd maila z ofertą demo: /podglad-maila.
 * Statyczna strona (eksport): HTML maila jest liczony przy buildzie i pokazany
 * w ramce. Adresy w mailu są względne, więc logo i link działają na każdej
 * domenie. Prawdziwy mail dostanie pełny adres strony (origin) przy wysyłce.
 * Strona nie jest indeksowana (noindex) i nie ma do niej linków.
 */
export const metadata: Metadata = {
  title: "Podgląd maila · Studio Kuchnie",
  robots: { index: false, follow: false },
};

export default function PodgladMailaPage() {
  return (
    <iframe
      title="Podgląd maila z ofertą"
      srcDoc={demoOfferEmail("")}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#f5f5f4" }}
    />
  );
}
