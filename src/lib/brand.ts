"use client";

import { useEffect, useState } from "react";
import { FIRMA } from "@/content/firma";

/*
 * Marka firmy z panelu (Ustawienia → Firma): nazwa i logo z /api/marka.
 * Brak ustawień albo brak API (zwykły next dev) = nazwa handlowa z src/content/firma.ts, bez logo.
 */
export type Brand = { name: string; logo: string | null };

const FALLBACK: Brand = { name: FIRMA.nazwaHandlowa, logo: null };
let cached: Brand | null = null;
let pending: Promise<Brand> | null = null;
const listeners = new Set<(b: Brand) => void>();

export function loadBrand(force = false): Promise<Brand> {
  if (cached && !force) return Promise.resolve(cached);
  if (pending && !force) return pending;
  pending = fetch("/api/marka", { cache: force ? "no-store" : "default" })
    .then((r) => ((r.headers.get("content-type") ?? "").includes("json") ? r.json() : { brand: null }))
    .then((d: { brand: Partial<Brand> | null }) => ({ name: d.brand?.name?.trim() || FALLBACK.name, logo: d.brand?.logo || null }))
    .catch(() => FALLBACK)
    .then((b) => {
      cached = b;
      listeners.forEach((l) => l(b));
      return b;
    });
  return pending;
}

/** Po zapisaniu w Ustawieniach – od razu nowa marka bez przeładowania. */
export function setBrandCache(b: Brand) {
  cached = { name: b.name.trim() || FALLBACK.name, logo: b.logo };
  listeners.forEach((l) => l(cached!));
}

export function useBrand(): Brand {
  const [brand, setBrand] = useState<Brand>(cached ?? FALLBACK);
  useEffect(() => {
    listeners.add(setBrand);
    void loadBrand().then(setBrand);
    return () => {
      listeners.delete(setBrand);
    };
  }, []);
  return brand;
}

/** Inicjały do znaczka, gdy nie ma logo (np. "Studio Kuchnie" -> "SK"). */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "•";
