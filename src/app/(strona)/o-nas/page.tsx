import type { Metadata } from "next";
import Link from "next/link";
import PageIntro, { LOREM, LOREM_SHORT } from "@/components/site/PageIntro";
import { btn } from "@/components/site/styles";

export const metadata: Metadata = { title: "O nas · System ofertowania" };

const POINTS = [
  { title: "Oferta w 3D", text: LOREM_SHORT },
  { title: "Link dla klienta", text: LOREM_SHORT },
  { title: "Akceptacja online", text: LOREM_SHORT },
];

export default function ONasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow="O nas" title="Lorem ipsum dolor sit amet">
        <p>{LOREM}</p>
      </PageIntro>

      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
        {POINTS.map((p) => (
          <section key={p.title} className="bg-[#0c0b0a] p-6 md:p-8">
            <h2 className="text-lg text-stone-50">{p.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">{p.text}</p>
          </section>
        ))}
      </div>

      <div className="mt-16 max-w-2xl space-y-5 text-base leading-relaxed text-stone-400">
        <p>{LOREM}</p>
        <p>{LOREM}</p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/kontakt" className={btn("solid")}>
          Napisz do nas
        </Link>
        <Link href="/oferta/demo" className={btn("ghost")}>
          Zobacz przykładową ofertę
        </Link>
      </div>
    </div>
  );
}
