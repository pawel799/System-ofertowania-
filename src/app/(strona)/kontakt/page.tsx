import type { Metadata } from "next";
import PageIntro from "@/components/site/PageIntro";
import { ContactForm } from "@/components/site/SiteForms";
import { FIRMA, adresFirmy } from "@/content/firma";

export const metadata: Metadata = { title: "Kontakt · System ofertowania" };

// Dane z src/content/firma.ts – puste pola się nie wyświetlają.
const DETAILS = [
  { label: "E-mail", value: FIRMA.email, href: FIRMA.email ? `mailto:${FIRMA.email}` : "" },
  { label: "Telefon", value: FIRMA.telefon, href: FIRMA.telefon ? `tel:${FIRMA.telefon.replace(/[^\d+]/g, "")}` : "" },
  { label: "Adres", value: adresFirmy(), href: "" },
  { label: "Godziny", value: FIRMA.godziny, href: "" },
].filter((d) => d.value);

export default function KontaktPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow="Kontakt" title="Porozmawiajmy o Twojej pracowni">
        <p>
          Chcesz zobaczyć, jak Twoje meble wyglądałyby w ofercie 3D, albo masz pytanie o wdrożenie? Napisz kilka słów –
          wiadomość trafi prosto do nas, odpiszemy na podany adres e-mail.
        </p>
      </PageIntro>

      <div className="mt-14 grid gap-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <dl className="space-y-6">
          {DETAILS.map((d) => (
            <div key={d.label}>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-stone-500">{d.label}</dt>
              <dd className="mt-1 select-all text-lg text-stone-100">
                {d.href ? (
                  <a href={d.href} className="underline-offset-4 hover:underline">
                    {d.value}
                  </a>
                ) : (
                  d.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        <ContactForm />
      </div>
    </div>
  );
}
