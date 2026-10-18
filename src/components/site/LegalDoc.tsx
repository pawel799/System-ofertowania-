import PageIntro from "./PageIntro";

/* Dokument prawny (regulamin, polityka): spis treści i paragrafy. Treść do podmiany. */
export default function LegalDoc({
  eyebrow,
  title,
  sections,
}: {
  eyebrow: string;
  title: string;
  sections: string[];
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow={eyebrow} title={title}>
        <p className="text-sm text-stone-500">Dokument w przygotowaniu – pełna treść zostanie opublikowana przed uruchomieniem płatnych planów.</p>
      </PageIntro>

      <div className="mt-14 grid gap-12 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Spis treści" className="md:sticky md:top-24 md:self-start">
          <ol className="space-y-2 text-sm">
            {sections.map((s, i) => (
              <li key={s}>
                <a href={`#par-${i + 1}`} className="text-stone-400 transition-colors hover:text-stone-100">
                  § {i + 1}. {s}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-2xl space-y-12">
          {sections.map((s, i) => (
            <section key={s} id={`par-${i + 1}`} className="scroll-mt-24">
              <h2 className="text-xl text-stone-50">
                § {i + 1}. {s}
              </h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-stone-400 marker:text-stone-600">
                <li>Treść tego paragrafu jest w przygotowaniu.</li>
              </ol>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
