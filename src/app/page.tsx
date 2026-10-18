import type { Metadata } from "next";
import Link from "next/link";
import { HOME } from "@/content/strona-glowna";
import HeroBackground from "@/components/site/HeroBackground";
import Logo, { BRAND_NAME } from "@/components/site/Logo";
import SiteFooter from "@/components/site/SiteFooter";
import HomeHeader from "@/components/site/home/HomeHeader";
import MediaSlot from "@/components/site/home/MediaSlot";
import { nr, Section, SectionHead } from "@/components/site/home/Section";
import StepsShowcase from "@/components/site/home/StepsShowcase";
import { btn } from "@/components/site/styles";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "System do ofert kuchni w 3D dla studiów i salonów meblowych: panel ofert, link dla klienta z podglądem 3D, uwagi i historia otwarć.",
};

/*
 * Strona główna. Hero: znak na środku, w tle scena 3D kuchni pod czarną nakładką 80%,
 * pod znakiem logowanie i rejestracja. Niżej sekcje promocyjne, na końcu stopka.
 * Wszystkie teksty i media: src/content/strona-glowna.ts.
 */
export default function HomePage() {
  const { steps, demo, features, audience, pricing, faq, finalCta } = HOME;

  return (
    <div className="bg-[#0c0b0a] text-stone-200">
      {/* Ciemne tło także dla html/body: inaczej przy szybkim przewijaniu (zanim przeglądarka
          domaluje kafelki) i przy „odbiciu” na końcu strony prześwituje białe body. */}
      <style>{`html,body{background:#0c0b0a}`}</style>
      <HomeHeader heroId="start" />

      <main>
        {/* Hero */}
        <section
          id="start"
          className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden text-stone-100"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
            <HeroBackground />
          </div>
          <div aria-hidden className="absolute inset-0 -z-10 bg-black/80" />

          <div className="flex flex-col items-center px-6 text-center">
            <h1 className="sr-only">{BRAND_NAME}</h1>
            <Logo size="lg" />
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link href="/logowanie" className={`${btn("ghost")} min-w-40`}>
                Zaloguj się
              </Link>
              <Link href="/rejestracja" className={`${btn("solid")} min-w-40`}>
                Zarejestruj się
              </Link>
            </div>
          </div>

          <a
            href={`#${steps.id}`}
            className="group absolute bottom-[calc(2rem+env(safe-area-inset-bottom,0px))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 rounded-sm text-[11px] uppercase tracking-[0.25em] text-stone-400 transition-colors duration-150 hover:text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {HOME.scrollHint}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden className="h-4 w-4">
              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>

        {/* Jak to działa */}
        <Section id={steps.id}>
          <SectionHead eyebrow={steps.eyebrow} title={steps.title} lead={steps.lead} />
          <StepsShowcase steps={steps.items} />
        </Section>

        {/* Przykładowa oferta */}
        <Section>
          <div className="grid gap-8 md:grid-cols-2 md:items-end md:gap-16">
            <SectionHead eyebrow={demo.eyebrow} title={demo.title} />
            <div>
              <p className="text-base leading-relaxed text-stone-400">{demo.text}</p>
              <Link href={demo.cta.href} className={`${btn("solid")} mt-6`}>
                {demo.cta.label}
              </Link>
            </div>
          </div>
          <Link
            href={demo.cta.href}
            tabIndex={-1}
            aria-hidden
            className="group mt-14 block rounded-2xl focus:outline-none"
          >
            <MediaSlot
              media={demo.media}
              className="transition-[border-color] duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-white/30"
            />
          </Link>
        </Section>

        {/* Funkcje */}
        <Section id={features.id}>
          <SectionHead eyebrow={features.eyebrow} title={features.title} />
          <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.items.map((f, i) => (
              <li key={f.title} className="border-t border-white/10 pt-6">
                <p className="text-[11px] tabular-nums tracking-[0.25em] text-stone-500">{nr(i)}</p>
                <h3 className="mt-6 text-lg text-stone-50">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-400">{f.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Dla kogo */}
        <Section id={audience.id}>
          <SectionHead eyebrow={audience.eyebrow} title={audience.title} />
          <ul className="mt-16 border-b border-white/10">
            {audience.items.map((a) => (
              <li key={a.title} className="grid gap-3 border-t border-white/10 py-8 md:grid-cols-2 md:gap-16 md:py-10">
                <h3 className="text-2xl text-stone-50 md:text-3xl">{a.title}</h3>
                <p className="text-base leading-relaxed text-stone-400 md:pt-1.5">{a.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Cennik (skrót – pełny cennik pod /cennik) */}
        <Section id={pricing.id}>
          <div className="flex flex-col gap-10 rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:flex-row md:items-end md:justify-between md:p-14">
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">{pricing.eyebrow}</p>
              <h2 className="mt-4 text-balance text-3xl leading-[1.08] text-stone-50 md:text-4xl">{pricing.title}</h2>
              <p className="mt-5 text-base leading-relaxed text-stone-400">{pricing.text}</p>
            </div>
            <Link href={pricing.cta.href} className={`${btn("ghost")} self-start md:self-auto`}>
              {pricing.cta.label}
            </Link>
          </div>
        </Section>

        {/* Pytania */}
        <Section id={faq.id}>
          <div className="grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
            <SectionHead eyebrow={faq.eyebrow} title={faq.title} />
            <div className="border-b border-white/10">
              {faq.items.map((item) => (
                <details key={item.q} className="group border-t border-white/10">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 rounded-sm py-6 text-left text-lg text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                      className="mt-1.5 h-4 w-4 flex-none text-stone-500 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-45"
                    >
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <p className="-mt-2 max-w-xl pb-6 text-sm leading-relaxed text-stone-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </Section>

        {/* Końcowe wezwanie */}
        <Section>
          <div className="flex flex-col items-center py-8 text-center">
            <Logo size="md" />
            <h2 className="mt-10 max-w-3xl text-balance text-4xl leading-[1.05] text-stone-50 md:text-6xl">
              {finalCta.title}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-400">{finalCta.text}</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href={finalCta.secondary.href} className={`${btn("ghost")} min-w-40`}>
                {finalCta.secondary.label}
              </Link>
              <Link href={finalCta.primary.href} className={`${btn("solid")} min-w-40`}>
                {finalCta.primary.label}
              </Link>
            </div>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
