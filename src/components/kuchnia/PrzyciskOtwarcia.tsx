"use client";

import { przelaczWszystkie, useOtwarcie } from "./otwarcieStore";

/** „Otwórz drzwi i szuflady” – pokazuje wnętrze mebli w 3D. Dwuklik na meblu otwiera tylko jego. */
export default function PrzyciskOtwarcia({ className, krotko = false }: { className?: string; krotko?: boolean }) {
  const { wszystkie } = useOtwarcie();
  return (
    <button
      type="button"
      aria-pressed={wszystkie}
      title="Dwuklik na meblu otwiera albo zamyka tylko jego"
      className={className}
      onClick={() => przelaczWszystkie()}
    >
      {wszystkie ? (krotko ? "Zamknij" : "Zamknij drzwi i szuflady") : krotko ? "Otwórz szafki" : "Otwórz drzwi i szuflady"}
    </button>
  );
}
