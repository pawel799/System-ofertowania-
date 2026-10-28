"use client";

/*
 * Ustawienia → Plan: obecny plan, okres próbny / opłacone do, wykorzystanie limitów
 * i zmiana planu (prośba o fakturę albo płatność online, gdy jest skonfigurowana).
 */
import { useEffect, useState } from "react";
import { formatZl, PLAN_IDS, type PlanId, type PlanInfo } from "@/lib/plans";
import { billingApi, type BillingView, type Me } from "./offerApi";
import { Seg, toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
const dateText = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "—";

function Usage({ label, used, max }: { label: string; used: number; max: number | null }) {
  const part = max ? Math.min(1, used / max) : 0;
  return (
    <li className="set-row">
      <div className="set-row-main" style={{ flex: 1 }}>
        <b>{label}</b>
        <span className="faint">{max === null ? `${used} · bez limitu` : `${used} z ${max}`}</span>
        {max !== null ? (
          <div className="bar" aria-hidden>
            <i style={{ transform: `scaleX(${part})`, background: max !== null && used > max ? "var(--red)" : undefined }} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function PlanTab({ me, onAuthError }: { me: Me | null; onAuthError: (e: unknown) => boolean }) {
  const [view, setView] = useState<BillingView | null>(null);
  const [err, setErr] = useState("");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const owner = me?.role === "owner";

  useEffect(() => {
    billingApi
      .get()
      .then(setView)
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);

  const choose = async (p: PlanInfo) => {
    setBusy(p.id);
    try {
      if (view?.online) {
        window.location.href = await billingApi.checkout(p.id, period);
        return;
      }
      const firm = await billingApi.request(p.id, period);
      setView((v) => (v ? { ...v, firm } : v));
      toast("Wysłano prośbę o plan", { desc: `${p.name} – odezwiemy się z fakturą.` });
    } catch (e) {
      if (!onAuthError(e)) toast("Nie udało się wysłać", { desc: errText(e), type: "err" });
    } finally {
      setBusy(null);
    }
  };

  if (err) return <p className="err">{err}</p>;
  if (!view) return <p className="lede">Wczytywanie…</p>;
  if (!view.firm || !view.plan) return <p className="lede">Konto administratora systemu nie ma planu ani limitów.</p>;

  const { firm, plan, usage } = view;
  const status = view.expired
    ? firm.status === "trial"
      ? `Okres próbny skończył się ${dateText(firm.trialEnds)}. Oferty i linki klientów działają, ale nowych nie dodasz.`
      : `Plan wygasł ${dateText(firm.paidUntil)}. Oferty i linki klientów działają, ale nowych nie dodasz.`
    : firm.status === "trial"
      ? `Okres próbny do ${dateText(firm.trialEnds)} (zostało ${view.daysLeft} ${view.daysLeft === 1 ? "dzień" : "dni"}).`
      : firm.paidUntil
        ? `Opłacone do ${dateText(firm.paidUntil)}.`
        : "Plan aktywny.";

  return (
    <div className="set-grid">
      <section className="set-card">
        <h2>Twój plan: {plan.name}</h2>
        <p className="lede" role="status">
          {status}
        </p>
        {firm.planRequest ? (
          <p className="lede">
            Prośba o plan <b>{view.plans[firm.planRequest.plan].name}</b> ({firm.planRequest.period === "year" ? "rocznie" : "miesięcznie"}) wysłana{" "}
            {dateText(firm.planRequest.at)}.
          </p>
        ) : null}
        {usage ? (
          <ul className="set-list">
            <Usage label="Oferty w toku" used={usage.activeOffers} max={plan.limits.activeOffers} />
            <Usage label="Modele 3D" used={usage.models} max={plan.limits.models} />
            <Usage label="Konta w zespole" used={usage.users} max={plan.limits.users} />
            <Usage label="Katalog materiałów" used={usage.katalog ?? 0} max={plan.limits.katalog} />
          </ul>
        ) : null}
      </section>

      <section className="set-card">
        <div className="set-card-head">
          <div>
            <h2>Zmiana planu</h2>
            <p className="lede">
              {view.online
                ? "Płatność online – po opłaceniu plan zmieni się od razu."
                : "Wybierz plan, a wystawimy fakturę. Plan zmieniamy po zaksięgowaniu wpłaty."}
            </p>
          </div>
          <Seg
            label="Okres rozliczenia"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "month", label: "Miesięcznie" },
              { value: "year", label: "Rocznie (2 mies. gratis)" },
            ]}
          />
        </div>
        <ul className="set-list">
          {PLAN_IDS.map((id) => {
            const p = view.plans[id];
            const price =
              period === "year" && p.yearly !== null
                ? `${formatZl(p.yearly)} / rok`
                : `${p.from ? "od " : ""}${formatZl(p.monthly)} / mies.`;
            const current = id === plan.id;
            return (
              <li key={id} className="set-row">
                <div className="set-row-main">
                  <b>
                    {p.name} · {price} netto
                  </b>
                  <span className="faint">{p.features.slice(0, 3).join(" · ")}</span>
                </div>
                <div className="set-row-actions">
                  {current && firm.status === "active" ? (
                    <span className="badge badge-ok">Obecny plan</span>
                  ) : owner ? (
                    <button type="button" className={current ? "btn btn-ink" : "btn btn-ghost"} disabled={busy !== null} onClick={() => void choose(p)}>
                      {busy === id ? "Wysyłanie…" : current ? (view.online ? "Opłać" : "Poproś o fakturę") : view.online ? "Wybierz i opłać" : "Wybierz"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {!owner ? <p className="faint" style={{ fontSize: 12.5 }}>Plan zmienia właściciel konta firmy.</p> : null}
      </section>
    </div>
  );
}
