import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "@/components/site/PageIntro";
import { btn } from "@/components/site/styles";

export const metadata: Metadata = { title: "Cennik · System ofertowania" };

// Plany bez cen katalogowych: wycena zależy od liczby osób i zakresu wdrożenia.
const PLANS = [
  {
    name: "Start",
    price: "Cena ustalana indywidualnie",
    period: "dla jednej pracowni",
    text: "Dla stolarza lub projektanta, który sam przygotowuje oferty i chce pokazać klientowi kuchnię w 3D.",
    features: ["Panel ofert z kodem dostępu", "Oferty z modelem 3D i linkiem dla klienta", "Link chroniony PIN-em i datą ważności", "Uwagi klienta i historia otwarć"],
    cta: { href: "/kontakt", label: "Zapytaj o wycenę" },
  },
  {
    name: "Pracownia",
    price: "Cena ustalana indywidualnie",
    period: "z własną marką",
    text: "Dla pracowni, które chcą wysyłać oferty pod własną nazwą i w swoich kolorach.",
    features: ["Wszystko z planu Start", "Własna nazwa i logo w ofercie", "Własne pakiety kolorów RAL", "Dane klienta firmowego po NIP-ie"],
    cta: { href: "/kontakt", label: "Zapytaj o wycenę" },
    featured: true,
  },
  {
    name: "Producent",
    price: "Zapytaj o wycenę",
    period: "wdrożenie na miarę",
    text: "Dla producentów mebli na wymiar, którzy chcą pokazywać klientom własne projekty.",
    features: ["Wszystko z planu Pracownia", "Własne modele 3D wgrywane w panelu", "Pomoc przy przygotowaniu modeli"],
    cta: { href: "/kontakt", label: "Porozmawiajmy" },
  },
];

export default function CennikPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow="Cennik" title="Plan dopasowany do Twojej pracowni">
        <p>Cenę ustalamy po krótkiej rozmowie – zależy od liczby ofert i od tego, czy potrzebujesz własnych modeli 3D. Napisz, a przygotujemy wycenę.</p>
      </PageIntro>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <section
            key={plan.name}
            className={`flex flex-col rounded-2xl border p-6 md:p-8 ${
              plan.featured ? "border-white/40 bg-white/[0.05]" : "border-white/10"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg text-stone-50">{plan.name}</h2>
              {plan.featured ? (
                <span className="text-[11px] uppercase tracking-[0.2em] text-stone-400">Najczęściej wybierany</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-stone-400">{plan.text}</p>
            <p className="mt-8 text-2xl text-stone-50">{plan.price}</p>
            <p className="mt-1 text-xs text-stone-500">{plan.period}</p>
            <ul className="mt-8 flex-1 space-y-3 text-sm text-stone-300">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-3">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 h-4 w-4 flex-none text-stone-500">
                    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={plan.cta.href}
              className={`${btn(plan.featured ? "solid" : "ghost")} mt-10 w-full`}
            >
              {plan.cta.label}
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
