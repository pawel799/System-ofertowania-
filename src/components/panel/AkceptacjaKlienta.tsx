"use client";

/*
 * Strona klienta: „Akceptuję ofertę”. Okno z wersją oferty (i tym, co się zmieniło od poprzedniej),
 * szacunkiem ceny i materiałami, które klient ma wybrane na dole strony; imię i nazwisko + zgoda.
 * Zapis: POST /api/public/<link>/akceptuj (serwer sprawdza, że to bieżąca wersja). Firma dostaje e-mail.
 * Po akceptacji – potwierdzenie; gdy firma zmieni ofertę później, klient widzi „Zaakceptuj nową wersję”.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { dataPl } from "@/lib/wersje";
import { formatPln } from "../pricing";
import { getWyborKlienta } from "../wyborKlienta";
import { ApiError, publicApi } from "./offerApi";

type Akceptacja = { wersja: number; data: string; imie: string };

export default function AkceptacjaKlienta({
  slug,
  pin,
  wersja,
  zmiany,
  akceptacja: poczatkowa,
  showPrice,
}: {
  slug: string;
  pin?: string;
  wersja: { nr: number; data: string } | null;
  zmiany: string[];
  akceptacja: Akceptacja | null;
  showPrice: boolean;
}) {
  const [akceptacja, setAkceptacja] = useState(poczatkowa);
  const [open, setOpen] = useState(false);
  const nr = wersja?.nr ?? 1;
  const aktualna = !!akceptacja && akceptacja.wersja === nr;

  if (aktualna && akceptacja)
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-sm text-stone-100" role="status" data-akceptacja>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden style={{ flex: "none" }}>
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Zaakceptowano {dataPl(akceptacja.data)}
        {nr > 1 ? ` · wersja ${nr}` : ""}
      </span>
    );

  return (
    <>
      {/* Główne wezwanie na stronie oferty – pełny przycisk (w jasnym motywie ciemny). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-stone-100 px-5 py-2.5 text-sm text-stone-900 transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        data-akceptuj
      >
        {akceptacja ? "Akceptuję nową wersję" : "Akceptuję ofertę"}
      </button>
      {akceptacja ? (
        <span className="text-sm text-stone-300">Oferta zmieniona po Twojej akceptacji (wersja {akceptacja.wersja} → {nr}).</span>
      ) : null}
      {open ? (
        <OknoAkceptacji
          slug={slug}
          pin={pin}
          nr={nr}
          wersja={wersja}
          zmiany={zmiany}
          showPrice={showPrice}
          onClose={() => setOpen(false)}
          onDone={(a) => {
            setAkceptacja(a);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function OknoAkceptacji({
  slug,
  pin,
  nr,
  wersja,
  zmiany,
  showPrice,
  onClose,
  onDone,
}: {
  slug: string;
  pin?: string;
  nr: number;
  wersja: { nr: number; data: string } | null;
  zmiany: string[];
  showPrice: boolean;
  onClose: () => void;
  onDone: (a: Akceptacja) => void;
}) {
  const [imie, setImie] = useState("");
  const [zgoda, setZgoda] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const wybor = getWyborKlienta();

  useEffect(() => {
    opener.current = document.activeElement;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (imie.trim().length < 3) {
      setError("Wpisz imię i nazwisko.");
      inputRef.current?.focus();
      return;
    }
    if (!zgoda) {
      setError("Zaznacz, że akceptujesz ofertę.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await publicApi.akceptuj(slug, { imie: imie.trim(), wersja: nr, zgoda: true, ...(wybor.opis ? { wybor: wybor.opis } : {}), ...(wybor.kwota !== null ? { kwota: wybor.kwota } : {}) }, pin);
      onDone(r.akceptacja);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(apiErr && apiErr.status !== 0 && apiErr.code !== "no_api" ? apiErr.message : "Nie udało się wysłać. Sprawdź internet i spróbuj ponownie.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-tlo/80 px-6 backdrop-blur-md" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="akceptacja-tytul"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90svh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-black/60 p-7 text-stone-100 shadow-2xl"
      >
        <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400">
          Akceptacja oferty{wersja ? ` · wersja ${wersja.nr} z ${dataPl(wersja.data)}` : ""}
        </p>
        <h2 id="akceptacja-tytul" className="mt-3 text-2xl leading-tight text-stone-50">
          Akceptujesz ofertę?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          Firma dostanie potwierdzenie i odezwie się w sprawie pomiaru i umowy. To nie jest jeszcze umowa ani zamówienie.
        </p>
        {zmiany.length ? (
          <div className="mt-4 rounded-xl border border-white/15 px-4 py-3 text-sm">
            <p className="text-stone-400">Zmiany od poprzedniej wersji</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-stone-200">
              {zmiany.map((z) => (
                <li key={z}>{z}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {showPrice && wybor.kwota !== null ? (
            <>
              <dt className="text-stone-400">Szacunek netto</dt>
              <dd className="tabular-nums text-stone-50">{formatPln(wybor.kwota)}</dd>
            </>
          ) : null}
          {wybor.opis ? (
            <>
              <dt className="text-stone-400">Twój wybór</dt>
              <dd className="text-stone-200">{wybor.opis}</dd>
            </>
          ) : null}
        </dl>
        <label className="mt-5 block text-sm text-stone-300" htmlFor="akc-imie">
          Imię i nazwisko
        </label>
        <input
          ref={inputRef}
          id="akc-imie"
          autoComplete="name"
          maxLength={120}
          value={imie}
          onChange={(e) => {
            setImie(e.target.value);
            if (error) setError("");
          }}
          aria-invalid={error && imie.trim().length < 3 ? true : undefined}
          className="mt-1.5 block w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-stone-50 outline-none transition-colors placeholder:text-stone-500 focus:border-white/50"
        />
        <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-stone-200" htmlFor="akc-zgoda">
          <input
            id="akc-zgoda"
            type="checkbox"
            checked={zgoda}
            onChange={(e) => {
              setZgoda(e.target.checked);
              if (error) setError("");
            }}
            className="mt-1 h-4 w-4 shrink-0 accent-stone-100"
          />
          Akceptuję tę ofertę{wersja ? ` (wersja ${wersja.nr})` : ""} z wybranymi materiałami.
        </label>
        <p className="mt-3 min-h-[1.25rem] text-xs text-red-300" role={error ? "alert" : undefined}>
          {error}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-stone-100 px-6 py-3 text-sm text-stone-900 transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? "Wysyłanie…" : "Akceptuję ofertę"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/25 px-5 py-3 text-sm text-stone-100 transition-colors hover:border-white/60 hover:bg-white/10"
          >
            Anuluj
          </button>
        </div>
      </form>
    </div>
  );
}
