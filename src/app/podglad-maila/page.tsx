import type { Metadata } from "next";
import MailPreview from "./MailPreview";

/*
 * Podgląd maila z ofertą demo: /podglad-maila. Strona nie jest indeksowana i nie ma do niej linków.
 * HTML liczy się w przeglądarce (data ważności od dziś, nazwa i logo z Ustawień → Firma).
 */
export const metadata: Metadata = {
  title: "Podgląd maila z ofertą",
  robots: { index: false, follow: false },
};

export default function PodgladMailaPage() {
  return <MailPreview />;
}
