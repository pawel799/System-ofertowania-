"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getCountertop } from "../countertopStore";
import { getFront } from "../frontStore";
import { getHardware } from "../hardwareStore";
import { ApiError, publicApi } from "./offerApi";

/*
 * Uwagi klienta na stronie oferty (/oferta/<link>): przycisk pod tytułem
 * i okno z polem tekstowym. Zapis: POST /api/public/<link>/comment.
 * Razem z tekstem idą materiały, które klient ma wybrane w pasku na dole,
 * więc projektant widzi, o jaką wersję chodzi.
 * Wygląd jak reszta strony oferty: ciemne szkło, białe obrysy, przyciski-pigułki.
 */

const MAX = 1800;

export default function ClientComments({ slug, pin }: { slug: string; pin?: string }) {
  const [open, setOpen] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/25 px-5 py-2.5 text-sm text-stone-100 transition-colors hover:border-white/60 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {sentCount ? "Dodaj kolejne uwagi" : "Uwagi do projektu"}
      </button>
      {sentCount ? (
        <span className="text-sm text-stone-300" role="status">
          Uwagi wysłane. Projektant odezwie się do Ciebie.
        </span>
      ) : null}
      {open ? (
        <CommentDialog
          slug={slug}
          pin={pin}
          onClose={() => setOpen(false)}
          onSent={() => {
            setSentCount((n) => n + 1);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function CommentDialog({
  slug,
  pin,
  onClose,
  onSent,
}: {
  slug: string;
  pin?: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    areaRef.current?.focus();
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
    const value = text.trim();
    if (value.length < 3) {
      setError("Napisz, co chcesz zmienić.");
      areaRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await publicApi.comment(slug, value, { front: getFront(), countertop: getCountertop(), hardware: getHardware() }, pin);
      onSent();
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setError(
        apiErr && apiErr.status !== 0 && apiErr.code !== "no_api"
          ? apiErr.message
          : "Nie udało się wysłać. Sprawdź internet i spróbuj ponownie.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0c0b0a]/80 px-6 backdrop-blur-md" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="uwagi-tytul"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-black/60 p-7 text-stone-100 shadow-2xl"
      >
        <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400">Uwagi do projektu</p>
        <h2 id="uwagi-tytul" className="mt-3 text-2xl leading-tight text-stone-50">
          Co chcesz zmienić?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          Uwagi trafią do projektanta razem z materiałami, które masz teraz wybrane na dole strony.
        </p>
        <textarea
          ref={areaRef}
          rows={5}
          maxLength={MAX}
          value={text}
          aria-label="Uwagi do projektu"
          aria-invalid={error ? true : undefined}
          placeholder="Np. wyspa o 20 cm krótsza, jaśniejszy blat"
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          className="mt-5 block w-full resize-y rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base leading-relaxed text-stone-50 outline-none transition-colors placeholder:text-stone-500 focus:border-white/50"
        />
        <div className="mt-2 flex items-start justify-between gap-4 text-xs">
          <p className="text-red-300" role={error ? "alert" : undefined}>
            {error}
          </p>
          <span className="shrink-0 tabular-nums text-stone-500">
            {text.length}/{MAX}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-stone-100 px-6 py-3 text-sm text-stone-900 transition-transform active:scale-[0.97] disabled:opacity-60"
          >
            {busy ? "Wysyłanie…" : "Wyślij uwagi"}
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
