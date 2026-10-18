"use client";

import { FIRMA } from "@/content/firma";
import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { btn, INPUT, LABEL } from "./styles";
import { wyslijZapytanie } from "@/lib/zapytania";

/*
 * Formularz kontaktowy strony. Wiadomość zapisuje się przez /api/zapytania (KV)
 * i trafia do zakładki „Zgłoszenia” w panelu.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({
  id,
  label,
  error,
  hint,
  right,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  right?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {right}
      </div>
      <input
        id={id}
        className={INPUT}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      {error ? (
        <p id={`${id}-err`} className="mt-2 text-sm text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-sm text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Done({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 outline-none">
      <p className="text-lg text-stone-50">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-stone-400">{children}</div>
    </div>
  );
}

/* ---------- Logowanie ---------- */

/* ---------- Kontakt ---------- */

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", company: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");
  const set = (k: keyof typeof f, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!f.name.trim()) next.name = "Wpisz imię i nazwisko.";
    if (!EMAIL.test(f.email.trim())) next.email = "Wpisz adres e-mail, żebyśmy mogli odpisać.";
    if (f.message.trim().length < 10) next.message = "Napisz kilka słów, w czym możemy pomóc.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setSendError("");
    const err = await wyslijZapytanie({ typ: "kontakt", imie: f.name, email: f.email, firma: f.company, uwagi: f.message });
    setBusy(false);
    if (err) return setSendError(err);
    setDone(true);
  };
  if (done)
    return (
      <Done title="Dziękujemy za wiadomość">
        <p>Wiadomość trafiła do nas. Odpiszemy na {f.email} – zwykle w ciągu kilku dni roboczych.</p>
      </Done>
    );
  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="c-name" label="Imię i nazwisko" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        <Field id="c-company" label="Firma (opcjonalnie)" autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} />
      </div>
      <Field id="c-email" label="E-mail" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
      <div>
        <label htmlFor="c-message" className={LABEL}>
          Wiadomość
        </label>
        <textarea
          id="c-message"
          rows={6}
          value={f.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          className={`${INPUT} h-auto resize-y py-3 leading-relaxed`}
        />
        {errors.message ? <p className="mt-2 text-sm text-red-300">{errors.message}</p> : null}
      </div>
      {sendError ? (
        <p className="text-sm text-red-300" role="alert">
          {sendError}
        </p>
      ) : null}
  <p className="text-xs leading-relaxed text-stone-500">
        Administratorem danych jest {FIRMA.nazwaPrawna || FIRMA.nazwaHandlowa}. Dane wykorzystamy tylko do odpowiedzi na to zgłoszenie (art. 6 ust. 1 lit. b i f RODO) i usuniemy po 180 dniach. Szczegóły i Twoje prawa:{" "}
        <a href="/polityka-prywatnosci" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-stone-200">polityka prywatności</a>.
      </p>
      <button type="submit" className={btn("solid")} disabled={busy}>
        {busy ? "Wysyłanie…" : "Wyślij wiadomość"}
      </button>
    </form>
  );
}
