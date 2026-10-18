import PageIntro from "./PageIntro";
import { LEGAL_UPDATED, type LegalSection } from "@/content/prawne";

/* Dokument prawny (regulamin, polityka): spis treści i paragrafy. Treść w src/content/prawne.ts. */
export default function LegalDoc({
  eyebrow,
  title,
  sections,
}: {
  eyebrow: string;
  title: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow={eyebrow} title={title}>
        <p className="text-sm text-stone-500">Ostatnia aktualizacja: {LEGAL_UPDATED}.</p>
      </PageIntro>

      <div className="mt-14 grid gap-12 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Spis treści" className="md:sticky md:top-24 md:self-start">
          <ol className="space-y-2 text-sm">
            {sections.map((s, i) => (
              <li key={s.title}>
                <a href={`#par-${i + 1}`} className="text-stone-400 transition-colors hover:text-stone-100">
                  § {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-2xl space-y-12">
          {sections.map((s, i) => (
            <section key={s.title} id={`par-${i + 1}`} className="scroll-mt-24">
              <h2 className="text-xl text-stone-50">
                § {i + 1}. {s.title}
              </h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-stone-400 marker:text-stone-600">
                {s.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
