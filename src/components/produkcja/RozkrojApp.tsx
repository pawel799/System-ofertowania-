"use client";

/*
 * /panel/rozkroj – formatki i rozkrój bez projektu w kreatorze: lista z KD Max, PRO100 albo Excela
 * (wklejona lub CSV) i formatki z modelu 3D (OBJ z PRO100, 3DS, GLB). Liczy się w przeglądarce, wymaga zalogowania.
 * Na start: rozkrój z 3 ostatnich projektów z kreatora (pozycje i materiały z ofert).
 */
import { useCallback, useEffect, useState } from "react";
import PrzelacznikMotywu from "../motyw/PrzelacznikMotywu";
import { useBrand } from "@/lib/brand";
import { ApiError, assetsApi, forgetLogin, hasLogin, panelApi } from "../panel/offerApi";
import { loadOffers, type Offer } from "../panel/offers";
import type { Palette } from "../palettes";
import type { KatalogPozycja } from "../katalogFirmy";
import { zrodloMaterialow } from "./zrodloOferty";
import { LoginDialog, LogoutButton, PanelBrand } from "../panel/PanelGate";
import { Toaster, Tooltips } from "../panel/ui";
import Produkcja, { type OstatnieProjekty } from "./Produkcja";

/** Ile ostatnich projektów idzie do rozkroju. */
const ILE_OSTATNICH = 3;

const czas = (o: Offer) => Date.parse(o.updatedAt ?? o.createdAt ?? "") || 0;

/** Najnowsze oferty z meblami z kreatora (bez samych modeli 3D) jako projekty do rozkroju. */
function ostatnieProjekty(oferty: readonly Offer[], palettes: Palette[], katalog: KatalogPozycja[]) {
  return [...oferty]
    .filter((o) => o.kuchnia?.elementy.some((e) => e.zrodlo !== "model"))
    .sort((a, b) => czas(b) - czas(a))
    .slice(0, ILE_OSTATNICH)
    .map((o) => ({
      id: o.id,
      nazwa: [o.title, o.client].filter(Boolean).join(" · ") || "Projekt",
      plan: o.kuchnia!,
      zrodlo: zrodloMaterialow({ palettes, katalog }, { front: o.front, hardware: o.hardware, countertop: o.countertop, kolory: o.kuchnia!.kolory, plyty: o.kuchnia!.plyty }),
    }));
}

export default function RozkrojApp() {
  const brand = useBrand();
  const [auth, setAuth] = useState<{ need: boolean; error: string }>({ need: false, error: "" });
  const [ostatnie, setOstatnie] = useState<OstatnieProjekty>({ stan: "wczytuje" });
  const wczytaj = useCallback(async () => {
    setOstatnie({ stan: "wczytuje" });
    try {
      const [oferty, palettes, katalog] = await Promise.all([
        panelApi.list(),
        assetsApi.palettes().catch(() => [] as Palette[]),
        assetsApi.katalog().catch(() => [] as KatalogPozycja[]),
      ]);
      setOstatnie({ stan: "gotowe", projekty: ostatnieProjekty(oferty, palettes, katalog) });
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 401) {
        forgetLogin();
        setAuth({ need: true, error: "Sesja wygasła. Zaloguj się ponownie." });
      } else if (err?.code === "no_api" && process.env.NODE_ENV === "development") {
        // next dev bez API: oferty z pamięci przeglądarki.
        setOstatnie({ stan: "gotowe", projekty: ostatnieProjekty(loadOffers() ?? [], [], []) });
      } else setOstatnie({ stan: "blad", tekst: err?.message ?? "Nie udało się pobrać projektów." });
    }
  }, []);
  useEffect(() => {
    if (!hasLogin() && process.env.NODE_ENV !== "development") setAuth({ need: true, error: "" });
    else void wczytaj();
  }, [wczytaj]);
  const data = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="pnl set">
      <header className="top">
        <a className="btn btn-plain" href="/panel" aria-label="Wróć do ofert">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <PanelBrand />
        <div className="crumb">
          <span>/</span>
          <b>Formatki i rozkrój</b>
        </div>
        <span className="grow" />
        {!auth.need ? <LogoutButton /> : null}
        <a className="btn btn-ghost" href="/panel">
          Oferty
        </a>
        <PrzelacznikMotywu className="btn btn-plain" domyslny="system" />
      </header>
      <main className="surface set-main">
        {auth.need ? null : <Produkcja ostatnie={ostatnie} meta={{ firma: brand.name, tytul: "Lista formatek", kod: "ROZKROJ", data }} />}
      </main>
      {auth.need ? <LoginDialog error={auth.error} onLoggedIn={() => {
            setAuth({ need: false, error: "" });
            void wczytaj();
          }} /> : null}
      <Toaster />
      <Tooltips />
    </div>
  );
}
