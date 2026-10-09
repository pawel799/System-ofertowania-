import type { Metadata } from "next";
import ClientOffer from "@/components/panel/ClientOffer";

/*
 * Link wysłany klientowi z panelu: /oferta/<identyfikator>.
 *
 * Strona jest eksportowana statycznie (output: "export"), więc nie da się
 * zbudować osobnej strony dla każdego linku. Budujemy jedną: /oferta/view,
 * a public/_redirects na Cloudflare podaje ją pod każdym /oferta/<id> (rewrite 200).
 * ClientOffer czyta identyfikator z adresu i pobiera ofertę z API.
 * Przy zwykłym `next dev` (bez _redirects) działa /oferta/view?id=<identyfikator>.
 */
export const metadata: Metadata = {
  title: "Oferta · Studio Kuchnie",
  description: "Twoja kuchnia w 3D: materiały do wyboru i wycena.",
  robots: { index: false, follow: false },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ slug: "view" }];
}

export default function OfertaPage() {
  return <ClientOffer />;
}
