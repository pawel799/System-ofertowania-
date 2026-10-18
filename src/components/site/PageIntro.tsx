import type { ReactNode } from "react";

/* Nagłówek podstrony: mały napis, tytuł i wstęp. */
export default function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">{eyebrow}</p>
      <h1 className="mt-4 text-balance text-4xl leading-[1.05] text-stone-50 md:text-5xl">{title}</h1>
      {children ? <div className="mt-5 text-base leading-relaxed text-stone-400">{children}</div> : null}
    </header>
  );
}
