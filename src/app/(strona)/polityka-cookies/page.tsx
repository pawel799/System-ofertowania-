import type { Metadata } from "next";
import { COOKIES } from "@/content/prawne";
import LegalDoc from "@/components/site/LegalDoc";
import { LinkUstawienZgod } from "@/components/ZgodyCookies";

export const metadata: Metadata = { title: "Polityka cookies · OP RZUT" };

export default function PolitykaCookiesPage() {
  return (
    <LegalDoc
      eyebrow="Dokumenty"
      title="Polityka cookies"
      sections={COOKIES}
      dodatek={
        <p className="mt-6">
          <LinkUstawienZgod className="rounded-full border border-white/25 px-5 py-2.5 text-sm text-stone-100 transition-colors hover:border-white/60 hover:bg-white/10">
            Zmień ustawienia cookies
          </LinkUstawienZgod>
        </p>
      }
    />
  );
}
