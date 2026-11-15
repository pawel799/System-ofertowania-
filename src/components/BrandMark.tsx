"use client";

import { useBrand } from "@/lib/brand";

/* Nazwa (albo logo) firmy w nagłówku strony oferty – z Ustawień → Firma. */
export default function BrandMark() {
  const brand = useBrand();
  if (brand.logo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo z KV jako data URL
      <img src={brand.logo} alt={brand.name} className="h-7 w-auto max-w-[160px] object-contain" />
    );
  // Długa nazwa na telefonie: jedna linia z wielokropkiem (pełna nazwa w podpowiedzi), bez łamania „FIRMA TESTOWA / 5”.
  return (
    <span className="min-w-0 truncate whitespace-nowrap text-stone-100" title={brand.name}>
      {brand.name}
    </span>
  );
}
