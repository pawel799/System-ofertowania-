"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { cleanNip, isValidNip } from "@/components/panel/company";
import { btn, INPUT, LABEL } from "./styles";

/*
 * Formularze strony: logowanie, rejestracja, reset hasła, kontakt.
 * Walidacja działa, backendu jeszcze nie ma:
 * - logowanie przechodzi od razu do /panel,
 * - pozostałe pokazują potwierdzenie z dopiskiem "wersja demo".
 * Miejsca do podpięcia API są oznaczone komentarzem TODO(backend).
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

export function AuthCard({ title, lede, children }: { title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-balance text-4xl leading-[1.05] text-stone-50">{title}</h1>
      {lede ? <p className="mt-4 text-base leading-relaxed text-stone-400">{lede}</p> : null}
      <div className="mt-10">{children}</div>
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

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = "Wpisz adres e-mail, np. jan@firma.pl.";
    if (!password) next.password = "Wpisz hasło.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    // TODO(backend): POST /api/auth/login, potem przekierowanie.
    router.push("/panel");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Field id="login-email" label="E-mail" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <Field
        id="login-password"
        label="Hasło"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        right={
          <Link href="/reset-hasla" className="text-xs text-stone-400 transition-colors hover:text-stone-100">
            Nie pamiętasz hasła?
          </Link>
        }
      />
      <button type="submit" className={`${btn("solid")} w-full`} disabled={busy}>
        {busy ? "Logowanie…" : "Zaloguj się"}
      </button>
      <p className="text-center text-sm text-stone-500">
        Nie masz konta?{" "}
        <Link href="/rejestracja" className="text-stone-200 underline-offset-4 hover:underline">
          Zarejestruj firmę
        </Link>
      </p>
      <p className="text-center text-xs text-stone-600">Wersja demo: logowanie od razu otwiera panel, bez sprawdzania hasła.</p>
    </form>
  );
}

/* ---------- Rejestracja firmy ---------- */

export function RegisterForm() {
  const [f, setF] = useState({ nip: "", company: "", name: "", email: "", phone: "", password: "", terms: false });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [lookup, setLookup] = useState<"idle" | "loading" | "found" | string>("idle");
  const [done, setDone] = useState(false);
  const fetched = useRef("");

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const nip = cleanNip(f.nip);

  // Poprawny NIP od razu pobiera nazwę firmy z wykazu VAT i KRS.
  // Publiczny endpoint /api/rejestracja/firma (limit na IP); panelowe /api/firma wymaga tokenu.
  useEffect(() => {
    if (!isValidNip(nip) || fetched.current === nip) return;
    const t = setTimeout(async () => {
      fetched.current = nip;
      setLookup("loading");
      try {
        const res = await fetch(`/api/rejestracja/firma?nip=${nip}`, { cache: "no-store" });
        const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
        const data = (isJson ? await res.json() : { ok: false, error: "" }) as
          | { ok: true; name: string }
          | { ok: false; error: string };
        if (fetched.current !== nip) return;
        if (data.ok) {
          setF((s) => ({ ...s, company: data.name }));
          setLookup("found");
        } else setLookup(data.error || "Nie udało się pobrać danych. Wpisz nazwę ręcznie.");
      } catch {
        setLookup("Nie udało się pobrać danych. Wpisz nazwę ręcznie.");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [nip]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isValidNip(nip)) next.nip = "Wpisz poprawny NIP firmy (10 cyfr).";
    if (!f.company.trim()) next.company = "Wpisz nazwę firmy.";
    if (!f.name.trim()) next.name = "Wpisz imię i nazwisko.";
    if (!EMAIL.test(f.email.trim())) next.email = "Wpisz adres e-mail, np. jan@firma.pl.";
    if (f.password.length < 8) next.password = "Hasło musi mieć co najmniej 8 znaków.";
    if (!f.terms) next.terms = "Zaakceptuj regulamin, żeby założyć konto.";
    setErrors(next);
    if (Object.keys(next).length) return;
    // TODO(backend): POST /api/auth/register
    setDone(true);
  };

  if (done)
    return (
      <Done title="Konto utworzone">
        <p>
          Wersja demo: konto nie zostało nigdzie zapisane. Po podpięciu backendu tu przyjdzie e-mail z linkiem aktywacyjnym na{" "}
          <span className="text-stone-200">{f.email}</span>.
        </p>
        <Link href="/panel" className={`${btn("solid")} mt-6`}>
          Przejdź do panelu
        </Link>
      </Done>
    );

  const nipHint =
    lookup === "loading" ? "Szukam firmy w wykazie VAT i KRS…" : lookup === "found" ? "Nazwa firmy pobrana z rejestrów. Możesz ją poprawić." : lookup !== "idle" ? lookup : "Nazwę firmy uzupełnimy sami.";

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Field id="reg-nip" label="NIP firmy" inputMode="numeric" autoComplete="off" placeholder="000-000-00-00" value={f.nip} onChange={(e) => set("nip", e.target.value)} error={errors.nip ?? (nip.length === 10 && !isValidNip(nip) ? "Ten NIP ma błąd (nie zgadza się suma kontrolna)." : undefined)} hint={nipHint} />
      <Field id="reg-company" label="Nazwa firmy" autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} error={errors.company} />
      <Field id="reg-name" label="Imię i nazwisko" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="reg-email" label="E-mail" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <Field id="reg-phone" label="Telefon (opcjonalnie)" type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <Field id="reg-password" label="Hasło" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} error={errors.password} hint="Co najmniej 8 znaków." />
      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-stone-400">
          <input
            type="checkbox"
            checked={f.terms}
            onChange={(e) => set("terms", e.target.checked)}
            className="mt-1 h-4 w-4 flex-none accent-stone-100"
            aria-invalid={errors.terms ? true : undefined}
          />
          <span>
            Akceptuję{" "}
            <Link href="/regulamin" className="text-stone-200 underline underline-offset-4">
              regulamin
            </Link>{" "}
            i{" "}
            <Link href="/polityka-prywatnosci" className="text-stone-200 underline underline-offset-4">
              politykę prywatności
            </Link>
            .
          </span>
        </label>
        {errors.terms ? <p className="mt-2 text-sm text-red-300">{errors.terms}</p> : null}
      </div>
      <button type="submit" className={`${btn("solid")} w-full`}>
        Załóż konto firmy
      </button>
      <p className="text-center text-sm text-stone-500">
        Masz już konto?{" "}
        <Link href="/logowanie" className="text-stone-200 underline-offset-4 hover:underline">
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}

/* ---------- Reset hasła ---------- */

export function ResetForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Wpisz adres e-mail, na który założono konto.");
    setError("");
    // TODO(backend): POST /api/auth/reset
    setDone(true);
  };
  if (done)
    return (
      <Done title="Sprawdź skrzynkę">
        <p>
          Jeśli konto <span className="text-stone-200">{email}</span> istnieje, wyślemy na nie link do zmiany hasła. Wersja demo: e-mail nie
          wychodzi.
        </p>
        <Link href="/logowanie" className={`${btn("ghost")} mt-6`}>
          Wróć do logowania
        </Link>
      </Done>
    );
  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Field id="reset-email" label="E-mail" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
      <button type="submit" className={`${btn("solid")} w-full`}>
        Wyślij link
      </button>
      <p className="text-center text-sm text-stone-500">
        <Link href="/logowanie" className="text-stone-200 underline-offset-4 hover:underline">
          Wróć do logowania
        </Link>
      </p>
    </form>
  );
}

/* ---------- Kontakt ---------- */

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", company: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!f.name.trim()) next.name = "Wpisz imię i nazwisko.";
    if (!EMAIL.test(f.email.trim())) next.email = "Wpisz adres e-mail, żebyśmy mogli odpisać.";
    if (f.message.trim().length < 10) next.message = "Napisz kilka słów, w czym możemy pomóc.";
    setErrors(next);
    if (Object.keys(next).length) return;
    // TODO(backend): POST /api/kontakt (np. wysyłka maila)
    setDone(true);
  };
  if (done)
    return (
      <Done title="Dziękujemy za wiadomość">
        <p>Odpowiemy na {f.email} w ciągu jednego dnia roboczego. Wersja demo: wiadomość nigdzie nie została wysłana.</p>
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
      <button type="submit" className={btn("solid")}>
        Wyślij wiadomość
      </button>
    </form>
  );
}
