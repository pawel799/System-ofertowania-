import PageIntro from "./PageIntro";
import { LEGAL_UPDATED, type LegalSection } from "@/content/prawne";

/* Dokument prawny (regulamin, polityki, umowa powierzenia): spis treści, paragrafy i tabela (np. lista cookies). Treść w src/content/prawne.ts. */
export default function LegalDoc({
  eyebrow,
  title,
  sections,
  dodatek,
}: {
  eyebrow: string;
  title: string;
  sections: LegalSection[];
  /** Treść pod nagłówkiem (np. przycisk ustawień cookies). */
  dodatek?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageIntro eyebrow={eyebrow} title={title}>
        <p className="text-sm text-stone-500">Ostatnia aktualizacja: {LEGAL_UPDATED}.</p>
        {dodatek}
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
              {s.tabela ? (
                <div className="mt-6 overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <thead className="bg-white/[0.04] text-stone-300">
                      <tr>
                        {s.tabela.naglowki.map((n) => (
                          <th key={n} scope="col" className="px-3 py-2.5 font-medium">
                            {n}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-stone-400">
                      {s.tabela.wiersze.map((w) => (
                        <tr key={w[0]} className="border-t border-white/10 align-top">
                          {w.map((k, j) => (
                            <td key={j} className={j === 0 ? "px-3 py-2.5 font-mono text-[12.5px] text-stone-300" : "px-3 py-2.5"}>
                              {k}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
