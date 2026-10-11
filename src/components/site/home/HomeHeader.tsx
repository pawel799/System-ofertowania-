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

  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
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
          <Link href="/logowanie" className={btn("ghost", "sm")}>
            Zaloguj się
          </Link>
          <Link href="/rejestracja" className={btn("solid", "sm")}>
            Zarejestruj się
          </Link>
        </div>
      </div>
    </header>
  );
}
