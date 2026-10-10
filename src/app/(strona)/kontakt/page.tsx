import type { Metadata } from "next";
import PageIntro from "@/components/site/PageIntro";
import { ContactForm } from "@/components/site/SiteForms";

export const metadata: Metadata = { title: "Kontakt · System ofertowania" };

// Dane kontaktowe do podmiany.
const DETAILS = [
  { label: "E-mail", value: "kontakt@example.com" },
  { label: "Telefon", value: "+48 000 000 000" },
  { label: "Adres", value: "ul. Lorem 1, 00-000 Warszawa" },
  { label: "Godziny", value: "pon.–pt. 9:00–17:00" },
];

export default function KontaktPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow="Kontakt" title="Porozmawiajmy o Twoim studiu">
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Odpisujemy w ciągu jednego dnia roboczego.</p>
      </PageIntro>

      <div className="mt-14 grid gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <dl className="space-y-6">
          {DETAILS.map((d) => (
            <div key={d.label}>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{d.label}</dt>
              <dd className="mt-1 select-all text-lg text-stone-100">{d.value}</dd>
            </div>
          ))}
        </dl>
        <ContactForm />
      </div>
    </div>
  );
}
