import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";

/* Wspólny układ podstron: pasek z logo, treść, stopka. Grupa (strona) nie zmienia adresów. */
export default function StronaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-[#0c0b0a] text-stone-200">
      <style>{`html,body{background:#0c0b0a}`}</style>
      <SiteHeader />
      <main className="flex-1 px-6 py-16 md:px-10 md:py-24">{children}</main>
      <SiteFooter />
    </div>
  );
}
