import Link from "next/link";
import Logo from "./Logo";
import { btn } from "./styles";

/* Górny pasek podstron (strona główna ma logo na środku zamiast paska). */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0c0b0a]/85 px-6 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md md:px-10">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6">
        <Link href="/" className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/panel" className={`${btn("ghost", "sm")} hidden sm:inline-flex`}>
            Wejdź do panelu
          </Link>
          <Link href="/kontakt" className={btn("solid", "sm")}>
            Umów prezentację
          </Link>
        </nav>
      </div>
    </header>
  );
}
