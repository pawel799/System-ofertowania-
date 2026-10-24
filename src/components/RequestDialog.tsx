"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useBrand } from "@/lib/brand";
import { EMAIL_RE, isPhone, wyslijZapytanie } from "@/lib/zapytania";

/*
 * Formularz na stronie oferty: „Poproś o wycenę” (pasek materiałów) i „Umów pomiar” (nagłówek).
 * Ten sam formularz, różni się rodzajem zgłoszenia. Zapis: POST /api/zapytania (KV).
 * Otwierany z dowolnego miejsca przez openRequest() albo adres z #wycena / #pomiar.
 */

export type RequestType = "wycena" | "pomiar";

let current: RequestType | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Dodatek do „Twój wybór” (np. wymiary szafki z konfiguratora modułu). */
let extra = "";
export function openRequest(typ: RequestType, note = "") {
  current = typ;
  extra = note;
  emit();
}
function closeRequest() {
  current = null;
  emit();
}
function useRequest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

const COPY: Record<RequestType, { title: string; lede: string; submit: string; done: string }> = {
  wycena: {
    title: "Poproś o wycenę",
    lede: "Zostaw kontakt – przygotujemy dokładną wycenę dla wybranych materiałów.",
    submit: "Wyślij prośbę o wycenę",
    done: "Dziękujemy! Prośba o wycenę dotarła. Skontaktujemy się w ciągu jednego dnia roboczego.",
  },
  pomiar: {
    title: "Umów pomiar",
    lede: "Przyjedziemy, zmierzymy pomieszczenie i doradzimy na miejscu. Podaj kontakt, a ustalimy termin.",
    submit: "Umów pomiar",
    done: "Dziękujemy! Zgłoszenie pomiaru dotarło. Zadzwonimy, żeby ustalić termin.",
  },
};

const INPUT =
  "mt-1.5 block w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900 aria-[invalid=true]:border-red-500";
const LABEL = "text-xs text-stone-600";

type Errors = Partial<Record<"imie" | "telefon" | "email", string>>;

/** Przycisk „Umów pomiar” (link #pomiar działa też bez JS jako kotwica do paska). */
export function MeasureButton({ className = "" }: { className?: string }) {
  return (
    <a
      href="#pomiar"
      onClick={(e) => {
        e.preventDefault();
        openRequest("pomiar");
      }}
      className={className}
    >
      Umów pomiar
    </a>
  );
}

export default function RequestDialog({ code, summary: base }: { code?: string; summary: string }) {
  const typ = useRequest();
  const brand = useBrand();
  const summary = typ && extra ? `${base}; ${extra}`.slice(0, 300) : base;
  const dialog = useRef<HTMLDialogElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const uid = useId();
  const [f, setF] = useState({ imie: "", telefon: "", email: "", uwagi: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const [done, setDone] = useState(false);

  // Adres z #wycena lub #pomiar otwiera formularz od razu.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (h === "wycena" || h === "pomiar") openRequest(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (typ && !d.open) {
      setDone(false);
      setSendError("");
      setErrors({});
      d.showModal();
      requestAnimationFrame(() => first.current?.focus());
    } else if (!typ && d.open) d.close();
  }, [typ]);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!typ) return;
    const next: Errors = {};
    if (!f.imie.trim()) next.imie = "Podaj imię.";
    if (f.telefon.trim() && !isPhone(f.telefon)) next.telefon = "Wpisz numer telefonu, np. 600 123 456.";
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) next.email = "Wpisz poprawny adres e-mail, np. jan@poczta.pl.";
    if (!f.telefon.trim() && !f.email.trim()) next.telefon = "Podaj telefon albo e-mail, żebyśmy mogli się odezwać.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setSendError("");
    const err = await wyslijZapytanie({ typ, ...f, oferta: code, wybor: summary });
    setBusy(false);
    if (err) return setSendError(err);
    setDone(true);
  };

  const copy = COPY[typ ?? "wycena"];

  return (
    <dialog
      ref={dialog}
      onClose={closeRequest}
      onClick={(e) => {
        if (e.target === dialog.current) closeRequest();
      }}
      aria-labelledby={`${uid}-t`}
      className="pointer-events-auto w-[min(92vw,28rem)] rounded-2xl bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-black/60"
    >
      <div className="p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${uid}-t`} className="text-xl">
            {copy.title}
          </h2>
          <button
            type="button"
            onClick={closeRequest}
            aria-label="Zamknij"
            className="-mr-2 -mt-1 rounded-full p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {done ? (
          <div role="status" className="mt-4">
            <p className="text-sm leading-relaxed text-stone-700">{copy.done}</p>
            <button
              type="button"
              onClick={closeRequest}
              className="mt-6 rounded-full bg-stone-900 px-5 py-2.5 text-sm text-white hover:bg-black"
            >
              Zamknij
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-2 space-y-4">
            <p className="text-sm leading-relaxed text-stone-600">{copy.lede}</p>
            <div>
              <label htmlFor={`${uid}-imie`} className={LABEL}>
                Imię
              </label>
              <input
                ref={first}
                id={`${uid}-imie`}
                autoComplete="given-name"
                value={f.imie}
                onChange={(e) => set("imie", e.target.value)}
                aria-invalid={!!errors.imie}
                className={INPUT}
              />
              {errors.imie ? <p className="mt-1 text-xs text-red-600">{errors.imie}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-tel`} className={LABEL}>
                  Telefon
                </label>
                <input
                  id={`${uid}-tel`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={f.telefon}
                  onChange={(e) => set("telefon", e.target.value)}
                  aria-invalid={!!errors.telefon}
                  className={INPUT}
                />
                {errors.telefon ? <p className="mt-1 text-xs text-red-600">{errors.telefon}</p> : null}
              </div>
              <div>
                <label htmlFor={`${uid}-mail`} className={LABEL}>
                  E-mail
                </label>
                <input
                  id={`${uid}-mail`}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={f.email}
                  onChange={(e) => set("email", e.target.value)}
                  aria-invalid={!!errors.email}
                  className={INPUT}
                />
                {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
              </div>
            </div>
            <div>
              <label htmlFor={`${uid}-uwagi`} className={LABEL}>
                Uwagi (opcjonalnie)
              </label>
              <textarea
                id={`${uid}-uwagi`}
                rows={3}
                value={f.uwagi}
                onChange={(e) => set("uwagi", e.target.value)}
                placeholder={typ === "pomiar" ? "Np. miejscowość, dogodne dni i godziny" : "Np. wymiary, termin, pytania"}
                className={`${INPUT} resize-y`}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-stone-500">Twój wybór: {summary}</p>
            {sendError ? (
              <p role="alert" className="text-sm text-red-600">
                {sendError}
              </p>
            ) : null}
<p className="text-[11px] leading-relaxed text-stone-500">
              Administratorem danych jest {brand.name}. Dane wykorzystamy tylko do odpowiedzi na to zgłoszenie (art. 6 ust. 1 lit. b i f RODO) i usuniemy po 180 dniach. Szczegóły i Twoje prawa:{" "}
              <a href="/polityka-prywatnosci" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-stone-800">polityka prywatności</a>.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-stone-900 px-5 py-3 text-sm text-white transition-colors hover:bg-black disabled:opacity-60"
            >
              {busy ? "Wysyłanie…" : copy.submit}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
