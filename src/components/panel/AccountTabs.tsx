"use client";

/*
 * Ustawienia → Konto (moje dane, zmiana hasła), Zespół (konta pracowników firmy)
 * i Firmy (tylko administrator systemu: plany i status kont firm).
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PLAN_IDS, PLAN_NAMES, type PlanId } from "@/lib/plans";
import { adminApi, authApi, teamApi, type AdminFirm, type Me, type UserInfo } from "./offerApi";
import { HoldButton, toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
const dateText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Kto jest zalogowany (/api/auth/me); reload() po zalogowaniu albo zmianie. */
export function useMe(enabled: boolean): [Me | null, () => void] {
  const [me, setMe] = useState<Me | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    authApi
      .me()
      .then((m) => alive && setMe(m))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, [enabled, tick]);
  return [me, useCallback(() => setTick((t) => t + 1), [])];
}

type Props = { onAuthError: (e: unknown) => boolean };

/* ---------- Konto ---------- */

export function AccountTab({ me, onAuthError }: Props & { me: Me | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setErr("Nowe hasło musi mieć co najmniej 8 znaków.");
    setBusy(true);
    setErr("");
    try {
      await authApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      toast("Zmieniono hasło", { desc: "Inne przeglądarki zostały wylogowane." });
    } catch (e2) {
      if (!onAuthError(e2)) setErr(errText(e2));
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <p className="lede">Wczytywanie…</p>;
  return (
    <div className="set-grid">
      <section className="set-card">
        <h2>Twoje konto</h2>
        <ul className="set-list">
          <li className="set-row">
            <div className="set-row-main">
              <b>{me.user?.name}</b>
              <span className="faint">{me.user?.email}</span>
            </div>
            <span className="badge badge-ok">{me.role === "owner" ? "Właściciel" : "Pracownik"}</span>
          </li>
          <li className="set-row">
            <div className="set-row-main">
              <b>{me.firm?.name}</b>
              <span className="faint">NIP {me.firm?.nip}</span>
            </div>
          </li>
        </ul>
      </section>
      <section className="set-card">
        <h2>Zmiana hasła</h2>
        <form onSubmit={save} noValidate style={{ maxWidth: 420 }}>
          <div className="field">
            <label htmlFor="pw-old">Obecne hasło</label>
            <input id="pw-old" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw-new">Nowe hasło (min. 8 znaków)</label>
            <input id="pw-new" className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          {err ? (
            <p className="err" role="alert">
              {err}
            </p>
          ) : null}
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? "Zapisywanie…" : "Zmień hasło"}
          </button>
        </form>
      </section>
    </div>
  );
}

/* ---------- Zespół ---------- */

export function TeamTab({ me, onAuthError }: Props & { me: Me | null }) {
  const [users, setUsers] = useState<UserInfo[] | null>(null);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ imie: "", email: "", haslo: "" });
  const [busy, setBusy] = useState(false);
  const owner = me?.role === "owner";

  const load = useCallback(() => {
    teamApi
      .list()
      .then(setUsers)
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);
  useEffect(load, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const u = await teamApi.add({ imie: f.imie.trim(), email: f.email.trim(), haslo: f.haslo });
      setUsers((list) => [...(list ?? []), u]);
      setF({ imie: "", email: "", haslo: "" });
      toast("Dodano konto", { desc: `${u.email} – przekaż mu hasło startowe.` });
    } catch (e2) {
      if (!onAuthError(e2)) setErr(errText(e2));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: UserInfo) => {
    try {
      await teamApi.remove(u.email);
      setUsers((list) => (list ?? []).filter((x) => x.email !== u.email));
      toast("Usunięto konto", { desc: u.email });
    } catch (e2) {
      if (!onAuthError(e2)) toast("Nie udało się usunąć", { desc: errText(e2), type: "err" });
    }
  };

  // Nowe hasło dla pracownika: pole pod jego wierszem.
  const [pwFor, setPwFor] = useState<{ email: string; haslo: string } | null>(null);
  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!pwFor) return;
    try {
      await teamApi.setPassword(pwFor.email, pwFor.haslo);
      toast("Ustawiono nowe hasło", { desc: `Przekaż je: ${pwFor.email}` });
      setPwFor(null);
    } catch (e2) {
      if (!onAuthError(e2)) toast("Nie udało się zmienić hasła", { desc: errText(e2), type: "err" });
    }
  };

  return (
    <div className="set-grid">
      {owner ? (
        <section className="set-card">
          <h2>Dodaj pracownika</h2>
          <p className="lede">Pracownik widzi i tworzy oferty firmy. Hasło startowe przekaż mu sam – zmieni je w Ustawieniach → Konto.</p>
          <form onSubmit={add} noValidate>
            <div className="field">
              <label htmlFor="t-name">Imię i nazwisko</label>
              <input id="t-name" className="input" autoComplete="off" value={f.imie} onChange={(e) => setF({ ...f, imie: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="t-email">E-mail</label>
              <input id="t-email" className="input" type="email" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="t-pass">Hasło startowe (min. 8 znaków)</label>
              <input id="t-pass" className="input" type="text" autoComplete="off" value={f.haslo} onChange={(e) => setF({ ...f, haslo: e.target.value })} />
            </div>
            {err ? (
              <p className="err" role="alert">
                {err}
              </p>
            ) : null}
            <button type="submit" className="btn btn-ink wide" disabled={busy}>
              {busy ? "Dodawanie…" : "Dodaj konto"}
            </button>
          </form>
        </section>
      ) : null}
      <section className="set-card">
        <h2>Zespół</h2>
        <p className="lede">{owner ? "Konta osób, które mają dostęp do ofert firmy." : "Konta w Twojej firmie. Zmieniać je może właściciel konta."}</p>
        {!owner && err ? <p className="err">{err}</p> : null}
        {users === null && !err ? <p className="lede">Wczytywanie…</p> : null}
        <ul className="set-list">
          {(users ?? []).map((u) => (
            <li key={u.email} className="set-row">
              <div className="set-row-main">
                <b>{u.name}</b>
                <span className="faint">
                  {u.email} · {u.role === "owner" ? "właściciel" : "pracownik"} · ostatnio: {dateText(u.lastLogin)}
                </span>
              </div>
              {owner && u.role !== "owner" && pwFor?.email === u.email ? (
                <form className="set-row-actions" onSubmit={resetPassword} noValidate>
                  <input
                    className="input"
                    type="text"
                    autoComplete="off"
                    aria-label={`Nowe hasło dla ${u.email}`}
                    placeholder="Nowe hasło (min. 8 znaków)"
                    value={pwFor.haslo}
                    onChange={(e) => setPwFor({ email: u.email, haslo: e.target.value })}
                  />
                  <button type="submit" className="btn btn-ink">
                    Zapisz
                  </button>
                  <button type="button" className="btn btn-plain" onClick={() => setPwFor(null)}>
                    Anuluj
                  </button>
                </form>
              ) : owner && u.role !== "owner" ? (
                <div className="set-row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setPwFor({ email: u.email, haslo: "" })}>
                    Nowe hasło
                  </button>
                  <HoldButton holdLabel="Przytrzymaj…" ariaLabel={`Przytrzymaj, aby usunąć konto ${u.email}`} onConfirm={() => void remove(u)}>
                    Usuń
                  </HoldButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Firmy (administrator) ---------- */

const STATUS_LABEL: Record<AdminFirm["status"], string> = { trial: "Okres próbny", active: "Aktywna", suspended: "Zawieszona" };

export function AdminFirmsTab({ onAuthError }: Props) {
  const [firms, setFirms] = useState<AdminFirm[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi
      .firms()
      .then(setFirms)
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);

  const update = async (f: AdminFirm, patch: Parameters<typeof adminApi.updateFirm>[1]) => {
    try {
      const saved = await adminApi.updateFirm(f.id, patch);
      setFirms((list) => (list ?? []).map((x) => (x.id === f.id ? { ...x, ...saved } : x)));
      toast("Zapisano", { desc: f.name });
    } catch (e2) {
      if (!onAuthError(e2)) toast("Nie udało się zapisać", { desc: errText(e2), type: "err" });
    }
  };

  return (
    <section className="set-card">
      <h2>Firmy z kontami</h2>
      <p className="lede">Plan, status i daty dla każdej stolarni. „Opłacone do” wpisujesz po zaksięgowaniu przelewu.</p>
      {err ? <p className="err">{err}</p> : null}
      {firms === null && !err ? <p className="lede">Wczytywanie…</p> : null}
      {firms && !firms.length ? <p className="empty">Nie ma jeszcze firm z kontami.</p> : null}
      <ul className="set-list">
        {(firms ?? []).map((f) => (
          <li key={f.id} className="set-row">
            <div className="set-row-main">
              <b>{f.name}</b>
              <span className="faint">
                NIP {f.nip} · {f.users.join(", ")} · od {dateText(f.createdAt)}
                {f.status === "trial" ? ` · próba do ${dateText(f.trialEnds)}` : f.paidUntil ? ` · opłacone do ${dateText(f.paidUntil)}` : ""}
              </span>
            </div>
            <div className="set-row-actions">
              <select className="input" aria-label={`Plan: ${f.name}`} value={f.plan} onChange={(e) => void update(f, { plan: e.target.value as PlanId })}>
                {PLAN_IDS.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_NAMES[p]}
                  </option>
                ))}
              </select>
              <select
                className="input"
                aria-label={`Status: ${f.name}`}
                value={f.status}
                onChange={(e) => void update(f, { status: e.target.value as AdminFirm["status"] })}
              >
                {(Object.keys(STATUS_LABEL) as AdminFirm["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="date"
                aria-label={`Opłacone do: ${f.name}`}
                value={f.paidUntil ? f.paidUntil.slice(0, 10) : ""}
                onChange={(e) => void update(f, { paidUntil: e.target.value ? new Date(`${e.target.value}T23:59:59Z`).toISOString() : null })}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
