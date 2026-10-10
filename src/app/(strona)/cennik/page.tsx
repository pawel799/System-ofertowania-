import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "@/components/site/PageIntro";
import { btn } from "@/components/site/styles";

export const metadata: Metadata = { title: "Cennik · System ofertowania" };

// Ceny i limity do uzupełnienia – układ jest gotowy.
const PLANS = [
  {
    name: "Start",
    price: "— zł",
    period: "netto / mies.",
    text: "Lorem ipsum dla jednego projektanta.",
    features: ["Lorem ipsum: 1 użytkownik", "Dolor sit: 20 ofert miesięcznie", "Link dla klienta z PIN-em"],
    cta: { href: "/rejestracja", label: "Załóż konto" },
  },
  {
    name: "Studio",
    price: "— zł",
    period: "netto / mies.",
    text: "Lorem ipsum dla studia z kilkoma osobami.",
    features: ["Lorem ipsum: 5 użytkowników", "Bez limitu ofert", "Własne logo na stronie oferty", "Dane firm po NIP-ie"],
    cta: { href: "/rejestracja", label: "Załóż konto" },
    featured: true,
  },
  {
    name: "Sieć salonów",
    price: "Wycena",
    period: "indywidualna",
    text: "Lorem ipsum dla sieci i producentów.",
    features: ["Lorem ipsum: wiele salonów", "Własne modele 3D i katalog", "Integracje i opiekun konta"],
    cta: { href: "/kontakt", label: "Porozmawiajmy" },
  },
];

export default function CennikPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow="Cennik" title="Lorem ipsum dla każdego studia">
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ceny netto, płatność miesięczna.</p>
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
            <p className="mt-8 text-4xl tabular-nums text-stone-50">{plan.price}</p>
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
