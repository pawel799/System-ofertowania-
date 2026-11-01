/*
 * Znak marki (jak public/logo.svg): rzut kuchni L z osią Z. Bez nazwy – nazwa jest w etykiecie i w tytule strony.
 * Wstawiony jako SVG (nie <img>), żeby kreski brały kolory z palety – w jasnym motywie znak jest ciemny.
 */

export const BRAND_NAME = "OP RZUT";

const SIZES = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-24 w-24 md:h-32 md:w-32" } as const;

export default function Logo({ size = "sm", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={64} height={64} role="img" aria-label={BRAND_NAME} className={`${SIZES[size]} ${className}`}>
      <rect x="4" y="4" width="56" height="56" fill="none" className="stroke-stone-600" strokeWidth="1" />
      <path d="M26 13 V38 H51" fill="none" className="stroke-stone-100" strokeWidth="7" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M26 38 L13.5 50.5" fill="none" className="stroke-stone-100" strokeWidth="7" strokeLinecap="butt" />
    </svg>
  );
}
