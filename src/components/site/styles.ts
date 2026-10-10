/*
 * Klasy Tailwind wspólne dla strony głównej i podstron (/o-nas, /kontakt, …).
 * Trzymane tutaj zamiast w globals.css, żeby nie dotykać stylów panelu i oferty.
 */

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm select-none touch-manipulation " +
  "transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
  "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const BTN_SIZE = { md: "h-11 px-6", sm: "h-9 px-4" } as const;

const BTN_VARIANT = {
  solid: "bg-stone-50 text-stone-950 hover:bg-white",
  ghost: "border border-white/25 text-stone-100 hover:border-white/60 hover:bg-white/10",
} as const;

/** Przycisk-pigułka: jasny (solid) albo z obrysem (ghost). */
export const btn = (variant: keyof typeof BTN_VARIANT, size: keyof typeof BTN_SIZE = "md") =>
  `${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]}`;

export const INPUT =
  "h-12 w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 text-base text-stone-50 outline-none " +
  "transition-colors duration-150 placeholder:text-stone-600 focus:border-white/50 focus:bg-white/[0.07] " +
  "aria-[invalid=true]:border-red-400/70";

export const LABEL = "mb-2 block text-[11px] uppercase tracking-[0.2em] text-stone-400";
