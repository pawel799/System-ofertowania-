import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import { btn } from "@/components/site/styles";

export const metadata: Metadata = { title: "Nie ma takiej strony · OP RZUT" };

/* Strona 404 (w statycznym eksporcie trafia do out/404.html, Cloudflare Pages podaje ją sam). */
export default function NotFound() {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[#0c0b0a] text-stone-200">
      <style>{`html,body{background:#0c0b0a}`}</style>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24 md:px-10">
        <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">Błąd 404</p>
        <h1 className="mt-4 max-w-2xl text-balance text-4xl leading-[1.05] text-stone-50 md:text-5xl">Nie ma takiej strony</h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-stone-400">
          Adres mógł się zmienić albo link jest niepełny. Jeśli to link do oferty od firmy, poproś o przesłanie go jeszcze raz.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className={btn("solid")}>
            Wróć na stronę główną
          </Link>
          <Link href="/kontakt" className={btn("ghost")}>
            Napisz do nas
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
