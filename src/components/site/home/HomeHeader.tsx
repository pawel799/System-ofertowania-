"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HOME } from "@/content/strona-glowna";
import Logo from "../Logo";
import { btn } from "../styles";

/*
 * Pasek strony głównej: schowany, dopóki widać hero (tam są już logo i przyciski),
 * wysuwa się po zjechaniu niżej. Podświetla kotwicę sekcji, która jest na ekranie.
 */
export default function HomeHeader({ heroId }: { heroId: string }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setShown(!e.isIntersecting);
        if (e.isIntersecting) setMenu(false);
      },
      { rootMargin: "-80px 0px 0px 0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [heroId]);

  useEffect(() => {
    const sections = HOME.nav
      .map((l) => document.getElementById(l.href.slice(1)))
      .filter((el): el is HTMLElement => el !== null);
    // Aktywna jest sekcja przecinająca pas w okolicy 40% wysokości ekranu.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(`#${e.target.id}`);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#0c0b0a]/85 px-6 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md transition-[transform,opacity,visibility] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none md:px-10 ${
        shown ? "visible translate-y-0 opacity-100" : "invisible -translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6">
        <a href="#start" className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <Logo />
        </a>
        <nav aria-label="Sekcje" className="hidden items-center gap-7 text-sm lg:flex">
          {HOME.nav.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={active === l.href ? "true" : undefined}
              className="rounded-sm text-stone-400 transition-colors duration-150 hover:text-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 aria-[current=true]:text-stone-50"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/panel" className={`${btn("ghost", "sm")} hidden sm:inline-flex`}>
            Wejdź do panelu
          </Link>
          <Link href="/kontakt" className={btn("solid", "sm")}>
            Umów prezentację
          </Link>
          {/* Telefon/tablet: sekcje w rozwijanym menu. */}
          <button
            type="button"
            aria-expanded={menu}
            aria-controls="menu-sekcji"
            aria-label={menu ? "Zamknij menu" : "Menu sekcji"}
            onClick={() => setMenu((m) => !m)}
            className="-mr-2 rounded-full p-2 text-stone-300 hover:text-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 lg:hidden"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-5 w-5">
              {menu ? (
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {menu ? (
        <nav id="menu-sekcji" aria-label="Sekcje" className="mx-auto max-w-6xl border-t border-white/10 py-2 lg:hidden">
          <ul>
            {HOME.nav.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setMenu(false)} className="block py-3 text-base text-stone-200 hover:text-stone-50">
                  {l.label}
                </a>
              </li>
            ))}
            <li className="sm:hidden">
              <Link href="/panel" className="block py-3 text-base text-stone-200 hover:text-stone-50">
                Wejdź do panelu
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
