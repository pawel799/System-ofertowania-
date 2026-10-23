import Link from "next/link";
import Logo from "./Logo";
import { liniaRejestrowa } from "@/content/firma";

/* Stopka strony: czarna, logo po lewej, linki po prawej, prawa autorskie na dole. */

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Produkt",
    links: [
      { href: "/cennik", label: "Cennik" },
      { href: "/oferta/demo", label: "Przykładowa oferta" },
      { href: "/panel", label: "Panel firmy" },
      { href: "/rejestracja", label: "Załóż konto firmy" },
    ],
  },
  {
    title: "Firma",
    links: [
      { href: "/o-nas", label: "O nas" },
      { href: "/kontakt", label: "Kontakt" },
    ],
  },
  {
    title: "Dokumenty",
    links: [
      { href: "/regulamin", label: "Regulamin" },
      { href: "/polityka-prywatnosci", label: "Polityka prywatności" },
    ],
  },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  // Dane firmy z src/content/firma.ts – puste pola się nie wyświetlają.
  const rejestr = liniaRejestrowa();
  return (
    <footer className="border-t border-white/10 bg-black px-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-14 text-stone-300 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <Link href="/" className="inline-block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
            <Logo />
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-stone-500">
            System ofertowania kuchni w 3D dla studiów, salonów i producentów mebli.
          </p>
        </div>

        <nav aria-label="Stopka" className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">{col.title}</p>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-sm text-stone-300 transition-colors duration-150 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-3 border-t border-white/10 pt-6 text-xs text-stone-500 sm:flex-row sm:justify-between">
        <p>© {year} System ofertowania. Wszelkie prawa zastrzeżone.</p>
        {rejestr ? <p>{rejestr}</p> : null}
      </div>
    </footer>
  );
}
