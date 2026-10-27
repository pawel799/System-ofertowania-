import type { Metadata } from "next";
import Link from "next/link";
import PageIntro from "@/components/site/PageIntro";
import { btn } from "@/components/site/styles";
import { formatZl, MODEL_SERVICE, PLAN_IDS, PLANS as PLAN_INFO, TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = { title: "Cennik · System ofertowania" };

// Ceny i limity w src/lib/plans.ts – te same, których pilnuje API.
const PLANS = PLAN_IDS.map((id) => {
  const p = PLAN_INFO[id];
  return {
    name: p.name,
    price: `${p.from ? "od " : ""}${formatZl(p.monthly)}`,
    period: [
      "netto miesięcznie",
      p.yearly !== null ? `albo ${formatZl(p.yearly)} rocznie (2 miesiące gratis)` : null,
      p.setup ?? null,
      p.quote ?? null,
    ]
      .filter(Boolean)
      .join(" · "),
    text: p.audience,
    features: p.features,
    cta:
      id === "producent"
        ? { href: "/kontakt", label: "Porozmawiajmy" }
        : { href: `/rejestracja?plan=${id}`, label: `Wypróbuj ${TRIAL_DAYS} dni za darmo` },
    featured: id === "pracownia",
  };
});

export default function CennikPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow="Cennik" title="Plan dopasowany do Twojej pracowni">
        <p>
          Pierwsze {TRIAL_DAYS} dni za darmo, bez podawania karty. Potem płacisz miesięcznie albo rocznie na fakturę, bez umowy na lata.
          Ceny netto (+23% VAT).
        </p>
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
      <p className="mt-8 text-sm text-stone-500">{MODEL_SERVICE}</p>
    </div>
  );
}
