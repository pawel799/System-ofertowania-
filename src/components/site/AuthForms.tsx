"use client";

/*
 * Konta firm na stronie: logowanie (/logowanie), rejestracja stolarni (/rejestracja)
 * i zmiana hasła (/reset-hasla). Po zalogowaniu albo rejestracji – przejście do panelu.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cleanNip, isValidNip } from "@/components/panel/company";
import { authApi } from "@/components/panel/offerApi";
import { isPlanId, PLAN_NAMES, TRIAL_DAYS, type PlanId } from "@/lib/plans";
import { Done, Field } from "./SiteForms";
import { btn } from "./styles";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak. Spróbuj ponownie.");

export function AuthCard({ title, lede, children }: { title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-balance text-4xl leading-[1.05] text-stone-50">{title}</h1>
      {lede ? <p className="mt-4 text-base leading-relaxed text-stone-400">{lede}</p> : null}
      <div className="mt-10">{children}</div>
    </div>
  );
}

function FormError({ text }: { text: string }) {
  return text ? (
    <p role="alert" className="text-sm text-red-300">
      {text}
    </p>
  ) : null;
}

/* ---------- Logowanie ---------- */

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = "Wpisz adres e-mail, np. jan@firma.pl.";
    if (!password) next.password = "Wpisz hasło.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setSendError("");
    try {
      await authApi.login(email.trim(), password);
      window.location.href = "/panel";
    } catch (err) {
      setSendError(errText(err));
      setBusy(false);
    }
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
      <FormError text={sendError} />
      <button type="submit" className={`${btn("solid")} w-full`} disabled={busy}>
        {busy ? "Logowanie…" : "Zaloguj się"}
      </button>
      <p className="text-center text-sm text-stone-500">
        Nie masz konta?{" "}
        <Link href="/rejestracja" className="text-stone-200 underline-offset-4 hover:underline">
          Załóż konto firmy
        </Link>
      </p>
    </form>
  );
}

/* ---------- Rejestracja firmy ---------- */

export function RegisterForm() {
  const [f, setF] = useState({ nip: "", company: "", name: "", email: "", password: "", terms: false });
  const [plan, setPlan] = useState<PlanId>("pracownia");
  const [errors, setErrors] = useState<Partial<Record<keyof typeof f, string>>>({});
  const [lookup, setLookup] = useState<"idle" | "loading" | "found" | string>("idle");
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState(false);
  const fetched = useRef("");

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  const nip = cleanNip(f.nip);

  // Plan z adresu (/rejestracja?plan=start) – przycisk z cennika.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("plan");
    if (isPlanId(p)) setPlan(p);
  }, []);

  // Poprawny NIP od razu pobiera nazwę firmy z wykazu VAT i KRS.
  useEffect(() => {
    if (!isValidNip(nip) || fetched.current === nip) return;
    const t = setTimeout(async () => {
      fetched.current = nip;
      setLookup("loading");
      try {
        const res = await fetch(`/api/rejestracja/firma?nip=${nip}`, { cache: "no-store" });
        const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
        const data = (isJson ? await res.json() : { ok: false, error: "" }) as { ok: true; name: string } | { ok: false; error: string };
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isValidNip(nip)) next.nip = "Wpisz poprawny NIP firmy (10 cyfr).";
    if (f.company.trim().length < 2) next.company = "Wpisz nazwę firmy.";
    if (f.name.trim().length < 2) next.name = "Wpisz imię i nazwisko.";
    if (!EMAIL.test(f.email.trim())) next.email = "Wpisz adres e-mail, np. jan@firma.pl.";
    if (f.password.length < 8) next.password = "Hasło musi mieć co najmniej 8 znaków.";
    if (!f.terms) next.terms = "Zaakceptuj regulamin, żeby założyć konto.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setSendError("");
    try {
      await authApi.register({ firma: f.company.trim(), nip, imie: f.name.trim(), email: f.email.trim(), haslo: f.password, plan, zgoda: true });
      window.location.href = "/panel/ustawienia?tab=firma&nowe=1";
    } catch (err) {
      setSendError(errText(err));
      setBusy(false);
    }
  };

  const nipHint =
    lookup === "loading"
      ? "Szukam firmy w wykazie VAT i KRS…"
      : lookup === "found"
        ? "Nazwa firmy pobrana z rejestrów. Możesz ją poprawić."
        : lookup !== "idle"
          ? lookup
          : "Nazwę firmy uzupełnimy sami.";

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <p className="rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-4 text-sm leading-relaxed text-stone-300">
        Plan <span className="text-stone-50">{PLAN_NAMES[plan]}</span> – pierwsze {TRIAL_DAYS} dni za darmo, bez podawania karty.
      </p>
      <Field
        id="reg-nip"
        label="NIP firmy"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000-000-00-00"
        value={f.nip}
        onChange={(e) => set("nip", e.target.value)}
        error={errors.nip ?? (nip.length === 10 && !isValidNip(nip) ? "Ten NIP ma błąd (nie zgadza się suma kontrolna)." : undefined)}
        hint={nipHint}
      />
      <Field id="reg-company" label="Nazwa firmy" autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} error={errors.company} />
      <Field id="reg-name" label="Imię i nazwisko" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
      <Field id="reg-email" label="E-mail" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
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
      <FormError text={sendError} />
      <button type="submit" className={`${btn("solid")} w-full`} disabled={busy}>
        {busy ? "Zakładanie konta…" : "Załóż konto firmy"}
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

/* ---------- Zmiana hasła: prośba o link i ustawienie nowego (?t=…) ---------- */

export function ResetForm() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | "sent" | "manual" | "changed">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("t") ?? "");
  }, []);

  const request = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Wpisz adres e-mail, na który założono konto.");
    setError("");
    setBusy(true);
    try {
      const r = await authApi.requestReset(email.trim());
      setDone(r.mail ? "sent" : "manual");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Hasło musi mieć co najmniej 8 znaków.");
    setError("");
    setBusy(true);
    try {
      await authApi.confirmReset(token, password);
      setDone("changed");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  if (done === "changed")
    return (
      <Done title="Hasło zmienione">
        <p>Możesz się teraz zalogować nowym hasłem.</p>
        <Link href="/logowanie" className={`${btn("solid")} mt-6`}>
          Zaloguj się
        </Link>
      </Done>
    );
  if (done)
    return (
      <Done title={done === "sent" ? "Sprawdź skrzynkę" : "Poproś o nowe hasło"}>
        {done === "sent" ? (
          <p>
            Jeśli konto <span className="text-stone-200">{email}</span> istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Link działa przez godzinę.
          </p>
        ) : (
          <p>
            Jeśli jesteś pracownikiem, poproś właściciela konta firmy o nowe hasło (Ustawienia → Zespół). Właściciel konta może{" "}
            <Link href="/kontakt" className="text-stone-200 underline underline-offset-4">
              napisać do nas
            </Link>
            .
          </p>
        )}
        <Link href="/logowanie" className={`${btn("ghost")} mt-6`}>
          Wróć do logowania
        </Link>
      </Done>
    );

  if (token)
    return (
      <form onSubmit={confirm} noValidate className="space-y-6">
        <Field id="reset-new" label="Nowe hasło" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} hint="Co najmniej 8 znaków." />
        <button type="submit" className={`${btn("solid")} w-full`} disabled={busy}>
          {busy ? "Zapisywanie…" : "Ustaw nowe hasło"}
        </button>
      </form>
    );

  return (
    <form onSubmit={request} noValidate className="space-y-6">
      <Field id="reset-email" label="E-mail" type="email" autoComplete="email" autoCapitalize="none" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
      <button type="submit" className={`${btn("solid")} w-full`} disabled={busy}>
        {busy ? "Wysyłanie…" : "Wyślij link"}
      </button>
      <p className="text-center text-sm text-stone-500">
        <Link href="/logowanie" className="text-stone-200 underline-offset-4 hover:underline">
          Wróć do logowania
        </Link>
      </p>
    </form>
  );
}
