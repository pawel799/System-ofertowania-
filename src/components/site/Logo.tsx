/* Znak marki (public/logo.svg): rzut kuchni L z osią Z. Bez nazwy – nazwa jest w alt i w tytule strony. */

export const BRAND_NAME = "System ofertowania";

const SIZES = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-24 w-24 md:h-32 md:w-32" } as const;

export default function Logo({ size = "sm", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- statyczny eksport: zwykły <img> z pliku SVG
    <img src="/logo.svg" alt={BRAND_NAME} width={64} height={64} className={`${SIZES[size]} ${className}`} />
  );
}
