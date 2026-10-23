"use client";

/*
 * Widżet kuchni 3D na stronie firmy (/osadz?f=<id firmy>, w iframe).
 * Ten sam widok co oferta dla klienta: obracanie, zmiana materiałów, cena, „Poproś o wycenę”.
 * Zgłoszenie z formularza trafia do panelu firmy (Zgłoszenia).
 */
import { useEffect, useState } from "react";
import OfferView from "./OfferView";
import { setCountertop } from "./countertopStore";
import { setFront } from "./frontStore";
import { setHardware } from "./hardwareStore";
import { setPalettes } from "./paletteStore";
import { publicEmbedApi, type PublicEmbed } from "./panel/offerApi";
import { setBrandCache } from "@/lib/brand";
import { FIRMA } from "@/content/firma";
import { setRequestFirm } from "@/lib/zapytania";

type State = { k: "loading" } | { k: "off" } | { k: "ready"; embed: PublicEmbed };

export default function EmbedOffer() {
  const [state, setState] = useState<State>({ k: "loading" });

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("f") ?? "";
    if (!/^[A-Za-z0-9]{4,32}$/.test(f)) return setState({ k: "off" });
    setRequestFirm(f);
    publicEmbedApi
      .get(f)
      .then((embed) => {
        setBrandCache(embed.brand ?? { name: FIRMA.nazwaHandlowa, logo: null });
        // Pakiety najpierw: front z pakietu RAL musi mieć swój kolor, zanim go wybierzemy.
        setPalettes(embed.palettes ?? []);
        setFront(embed.front);
        setCountertop(embed.countertop);
        setHardware(embed.hardware);
        setState({ k: "ready", embed });
      })
      .catch(() => setState({ k: "off" }));
  }, []);

  if (state.k === "ready") {
    const { embed } = state;
    return <OfferView code="" title={embed.title} base={embed.base} showPrice={embed.showPrice} model={embed.model} />;
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c0b0a] px-6 text-center text-stone-400">
      {state.k === "loading" ? <p className="text-sm">Wczytywanie kuchni 3D…</p> : <p className="text-sm">Ta kuchnia 3D nie jest teraz dostępna.</p>}
    </main>
  );
}
