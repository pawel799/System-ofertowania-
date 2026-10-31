"use client";

import ModulyDialog from "../modul/ModulyDialog";
import { useCallback, useEffect, useRef, useState } from "react";
import OfferView from "../OfferView";
import ClientComments from "./ClientComments";
import { setCountertop } from "../countertopStore";
import { setFront } from "../frontStore";
import { setHardware } from "../hardwareStore";
import { setPalettes } from "../paletteStore";
import { setKatalog, setSnapshotMaterialow } from "../katalogStore";
import { ApiError, publicApi, type BrandSettings, type PublicOffer } from "./offerApi";
import { setBrandCache, useBrand } from "@/lib/brand";
import { FIRMA } from "@/content/firma";
import { setRequestLink } from "@/lib/zapytania";
import { slowaProjektu } from "@/lib/projekt";

/*
 * Strona, którą klient dostaje z panelu: /oferta/<link>.
 * Statyczna strona /oferta/view (public/_redirects podaje ją pod każdym linkiem)
 * czyta identyfikator z adresu, pobiera ofertę z API (GET /api/public/<link>)
 * i zgłasza otwarcie (panel widzi je na każdym urządzeniu).
 * Przy zwykłym `next dev` działa /oferta/view?id=<link>.
 */

type State =
  | { k: "loading" }
  | { k: "missing" }
  | { k: "expired" }
  | { k: "locked" }
  | { k: "failed" }
  | { k: "pin" }
  | { k: "ready"; offer: PublicOffer };

function slugFromLocation() {
  const q = new URLSearchParams(window.location.search).get("id");
  if (q) return q;
  const parts = window.location.pathname.replace(/\/+$/, "").split("/");
  const last = decodeURIComponent(parts[parts.length - 1] ?? "");
  return last === "view" ? "" : last;
}

export default function ClientOffer() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [slug, setSlug] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  // PIN, z którym oferta się otworzyła – potrzebny też przy wysyłaniu uwag.
  const [okPin, setOkPin] = useState<string | undefined>();
  const recorded = useRef(false);
  // Marka firmy, która wysłała ofertę (z odpowiedzi API) – także na ekranie PIN-u i wygasłego linku.
  const [brandKnown, setBrandKnown] = useState(false);
  const brand = useBrand();
  const applyBrand = useCallback((b: BrandSettings | null | undefined) => {
    if (b === undefined) return;
    setBrandCache(b ?? { name: FIRMA.nazwaHandlowa, logo: null });
    setBrandKnown(true);
  }, []);

  const load = useCallback(async (s: string, withPin?: string) => {
    try {
      const offer = await publicApi.get(s, withPin);
      applyBrand(offer.brand);
      setOkPin(withPin);
      setState({ k: "ready", offer });
      if (!recorded.current) {
        recorded.current = true;
        publicApi.open(s, withPin).catch(() => {}); // licznik otwarć: błąd nie przeszkadza klientowi
      }
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      applyBrand(err?.data?.brand as BrandSettings | null | undefined);
      if (err?.code === "pin_required") setState({ k: "pin" });
      else if (err?.code === "pin_wrong") {
        setState({ k: "pin" });
        setPinError(true);
      } else if (err?.status === 404) setState({ k: "missing" });
      else if (err?.status === 410) setState({ k: "expired" });
      else if (err?.status === 429) setState({ k: "locked" });
      else setState({ k: "failed" });
    }
  }, [applyBrand]);

  useEffect(() => {
    const s = slugFromLocation();
    setSlug(s);
    // Prośba o wycenę / pomiar z tej strony trafia do firmy, która wysłała ofertę.
    setRequestLink(s);
    if (!/^[A-Za-z0-9]{6,32}$/.test(s)) setState({ k: "missing" });
    else void load(s);
  }, [load]);

  useEffect(() => {
    if (state.k !== "ready") return;
    // Pakiety najpierw: front z pakietu RAL musi mieć swój kolor, zanim go wybierzemy.
    setPalettes(state.offer.palettes ?? []);
    setKatalog(state.offer.katalog ?? []);
    setSnapshotMaterialow(state.offer.materialy ?? null);
    setFront(state.offer.front);
    setCountertop(state.offer.countertop);
    setHardware(state.offer.hardware);
  }, [state]);

  if (state.k === "ready") {
    const { offer } = state;
    return (
      <OfferView
        code={offer.id}
        title={offer.title}
        eyebrow={`Oferta dla: ${offer.who}`}
        base={offer.base}
        showPrice={offer.showPrice}
        actions={
          offer.comments || offer.moduly?.length ? (
            <>
              {offer.comments ? <ClientComments slug={slug} pin={okPin} /> : null}
              {offer.moduly?.length ? (
                <ModulyDialog mode="oferta" moduly={offer.moduly} etykieta={offer.kuchnia ? `${slowaProjektu(offer.projekt).pozycje} (${offer.moduly.length})` : undefined} />
              ) : null}
            </>
          ) : undefined
        }
        model={offer.model ?? null}
        kuchnia={offer.kuchnia}
        modele={offer.modele}
        projekt={offer.projekt}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c0b0a] px-6 text-stone-100">
      <div className="w-full max-w-sm text-center">
        {brandKnown ? (
          brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo z KV jako data URL
            <img src={brand.logo} alt={brand.name} className="mx-auto h-8 w-auto max-w-[180px] object-contain" />
          ) : (
            <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400">{brand.name}</p>
          )
        ) : null}

        {state.k === "loading" ? (
          <p className="mt-6 text-sm text-stone-400">Wczytywanie oferty…</p>
        ) : null}

        {state.k === "missing" ? (
          <>
            <h1 className="mt-6 text-3xl leading-tight text-stone-50">Nie znaleźliśmy tej oferty</h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              Link mógł wygasnąć albo zostać unieważniony. Poproś firmę, od której masz link, o nowy.
            </p>
          </>
        ) : null}

        {state.k === "expired" || state.k === "locked" || state.k === "failed" ? (
          <>
            <h1 className="mt-6 text-3xl leading-tight text-stone-50">
              {state.k === "expired"
                ? "Ten link wygasł"
                : state.k === "locked"
                  ? "Za dużo prób PIN-u"
                  : "Nie udało się wczytać oferty"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-400">
              {state.k === "expired"
                ? "Oferta była ważna przez ograniczony czas. Napisz do nas, a wyślemy aktualny link."
                : state.k === "locked"
                  ? "Ze względów bezpieczeństwa spróbuj ponownie za godzinę."
                  : "Sprawdź połączenie z internetem i odśwież stronę."}
            </p>
          </>
        ) : null}

        {state.k === "pin" ? (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length >= 4) void load(slug, pin);
              else setPinError(true);
            }}
          >
            <h1 className="text-3xl leading-tight text-stone-50">Wpisz PIN z wiadomości</h1>
            <p className="mt-3 text-sm text-stone-400">Ta oferta jest zabezpieczona.</p>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              enterKeyHint="go"
              maxLength={4}
              aria-label="PIN"
              aria-invalid={pinError || undefined}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setPinError(false);
              }}
              className="mx-auto mt-6 block h-14 w-44 rounded-xl border border-white/15 bg-white/5 text-center text-2xl tracking-[0.4em] text-stone-50 outline-none transition-colors focus:border-white/50"
            />
            {pinError ? (
              <p className="mt-3 text-sm text-red-300" role="alert">
                Ten PIN nie pasuje. Sprawdź wiadomość od nas.
              </p>
            ) : null}
            <button
              type="submit"
              className="mt-6 rounded-full bg-stone-100 px-6 py-3 text-sm text-stone-900 transition-transform active:scale-[0.97]"
            >
              Pokaż ofertę
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
