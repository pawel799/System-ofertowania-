"use client";

import { podzielModele } from "@/lib/bibliotekaModeli";
import type { ModelMeta } from "./offerApi";

/**
 * Model całej oferty (zamiast kuchni demo).
 * Gotowe kuchnie 47–50 i pliki wgrane w ustawieniach. Moduły biblioteki zostają w kreatorze.
 */
export default function WyborModeluOferty({
  id,
  models,
  value,
  onChange,
  className = "input",
}: {
  id: string;
  models: ModelMeta[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const { kuchnie, wlasne, moduly } = podzielModele(models);
  const modul = value ? moduly.find((x) => x.model.id === value) : undefined;
  const znany = models.some((m) => m.id === value);
  return (
    <select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Kuchnia demo</option>
      {kuchnie.length ? (
        <optgroup label="Gotowe kuchnie">
          {kuchnie.map(({ model, wpis }) => (
            <option key={model.id} value={model.id}>
              {model.name || wpis.nazwa}
            </option>
          ))}
        </optgroup>
      ) : null}
      {wlasne.length ? (
        <optgroup label="Własne modele">
          {wlasne.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {modul ? (
        <optgroup label="Moduł biblioteki">
          <option value={modul.model.id}>{modul.model.name || modul.wpis.nazwa}</option>
        </optgroup>
      ) : null}
      {value && !znany ? <option value={value}>Model niedostępny</option> : null}
    </select>
  );
}
