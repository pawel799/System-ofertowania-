"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { setCountertop } from "../countertopStore";
import { setFront } from "../frontStore";
import { setHardware } from "../hardwareStore";
import { ApiError, publicApi } from "./offerApi";

/*
 * Strona klienta (/oferta/<identyfikator>): pobiera ofertę z API po identyfikatorze
 * linku, ustawia jej materiały w scenie i zgłasza otwarcie (panel widzi je na
 * każdym urządzeniu). Identyfikator z adresu, a przy next dev z ?id=.
 * Gdy oferty nie ma, link wygasł albo trzeba PIN-u, pokazuje komunikat po polsku.
 */

type State =
  | { k: "loading" }
  | { k: "ok" }
  | { k: "pin"; wrong: boolean }
  | { k: "error"; title: string; desc: string };

function slugFromLocation() {
  const q = new URLSearchParams(window.location.search).get("id");
  if (q) return q;
  const parts = window.location.pathname.replace(/\/+$/, "").split("/");
  const last = decodeURIComponent(parts[parts.length - 1] ?? "");
  return last === "view" ? "" : last;
}

const NOT_FOUND = {
  title: "Nie znaleźliśmy tej oferty",
  desc: "Link mógł zostać unieważniony albo jest niepełny. Poproś o nowy link osobę, która wysłała Ci ofertę.",
};

export default function OfferSync() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [slug, setSlug] = useState("");

  const open = useCallback(async (s: string, pin?: string) => {
    try {
      const offer = await publicApi.get(s, pin);
      setFront(offer.front);
      setCountertop(offer.countertop);
      setHardware(offer.hardware);
      setState({ k: "ok" });
      publicApi.open(s, pin).catch(() => {}); // licznik otwarć: błąd nie przeszkadza klientowi
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.code === "pin_required") setState({ k: "pin", wrong: false });
      else if (err?.code === "pin_wrong") setState({ k: "pin", wrong: true });
      else if (err?.status === 404) setState({ k: "error", ...NOT_FOUND });
      else if (err?.status === 410)
        setState({
          k: "error",
          title: "Ten link wygasł",
          desc: "Oferta była ważna przez ograniczony czas. Napisz do nas, a wyślemy aktualny link.",
        });
      else if (err?.status === 429)
        setState({ k: "error", title: "Za dużo prób PIN-u", desc: "Ze względów bezpieczeństwa spróbuj ponownie za godzinę." });
      else
        setState({
          k: "error",
          title: "Nie udało się wczytać oferty",
          desc: "Sprawdź połączenie z internetem i odśwież stronę.",
        });
    }
  }, []);

  useEffect(() => {
    const s = slugFromLocation();
    setSlug(s);
    if (!s || !/^[A-Za-z0-9]{6,32}$/.test(s)) setState({ k: "error", ...NOT_FOUND });
    else void open(s);
  }, [open]);

  if (state.k === "ok" || state.k === "loading") return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0c0b0a]/80 px-6 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/60 p-7 text-stone-100 shadow-2xl">
        <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400">Studio / Kuchnie</p>
        {state.k === "pin" ? (
          <PinForm wrong={state.wrong} onSubmit={(pin) => void open(slug, pin)} />
        ) : (
          <>
            <h1 className="mt-3 text-2xl leading-tight text-stone-50">{state.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-stone-300">{state.desc}</p>
          </>
        )}
      </div>
    </div>
  );
}

function PinForm({ wrong, onSubmit }: { wrong: boolean; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pin.trim()) onSubmit(pin.trim());
  };
  return (
    <form onSubmit={submit}>
      <h1 className="mt-3 text-2xl leading-tight text-stone-50">Oferta chroniona PIN-em</h1>
      <p className="mt-3 text-sm leading-relaxed text-stone-300">Wpisz PIN z wiadomości, w której dostałeś link.</p>
      <div className="mt-5 flex gap-3">
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="PIN"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="min-w-0 flex-1 rounded-full border border-white/25 bg-transparent px-4 py-2 tracking-[0.3em] text-stone-50 outline-none focus:border-white/60"
        />
        <button
          type="submit"
          className="rounded-full border border-white/25 px-5 py-2 text-sm text-stone-100 transition-colors hover:border-white/60 hover:bg-white/10"
        >
          Otwórz
        </button>
      </div>
      {wrong ? <p className="mt-3 text-sm text-red-300">Nieprawidłowy PIN. Spróbuj jeszcze raz.</p> : null}
    </form>
  );
}
