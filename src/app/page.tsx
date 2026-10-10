import type { Metadata } from "next";
import Link from "next/link";
import HeroBackground from "@/components/site/HeroBackground";
import Logo, { BRAND_NAME } from "@/components/site/Logo";
import SiteFooter from "@/components/site/SiteFooter";
import { btn } from "@/components/site/styles";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "Oferty kuchni w 3D dla studiów meblowych: wycena, link dla klienta, akceptacja.",
};

/*
 * Strona główna: znak na środku, w tle scena 3D kuchni (kamera powoli się kołysze)
 * pod czarną nakładką 80%, pod znakiem logowanie i rejestracja. Niżej stopka.
 * Oferta demo jest pod /oferta/demo (bez zmian).
 */
export default function HomePage() {
  return (
    <>
      <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#0c0b0a] text-stone-100">
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
      </main>
      <SiteFooter />
    </>
  );
}
