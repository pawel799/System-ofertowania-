"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, forgetLogin, hasLogin, requestsApi, type Zgloszenie } from "./offerApi";
import { LoginDialog, LogoutButton, PanelBrand } from "./PanelGate";
import { HoldButton, Seg, Toaster, Tooltips, toast } from "./ui";

/*
 * Zgłoszenia (/panel/zgloszenia): prośby o wycenę i pomiar ze strony oferty
 * oraz wiadomości z /kontakt. Dane z /api/zapytania (KV, 180 dni), ten sam kod dostępu co panel.
 */

const TYP_LABEL: Record<Zgloszenie["typ"], string> = { wycena: "Wycena", pomiar: "Pomiar", kontakt: "Kontakt" };
type Filter = "nowe" | "wszystkie" | "obsluzone";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "nowe", label: "Nowe" },
  { value: "obsluzone", label: "Obsłużone" },
  { value: "wszystkie", label: "Wszystkie" },
];

const dateText = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");

export default function RequestsApp() {
  const [items, setItems] = useState<Zgloszenie[] | null>(null);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState<{ need: boolean; error: string }>({ need: false, error: "" });
  const [filter, setFilter] = useState<Filter>("nowe");

  const load = useCallback(async () => {
    if (!hasLogin()) return setAuth({ need: true, error: "" });
    setError("");
    try {
      setItems(await requestsApi.list());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        forgetLogin();
        return setAuth({ need: true, error: "Sesja wygasła. Zaloguj się ponownie." });
      }
      setError(errText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(
    () => (items ?? []).filter((z) => (filter === "wszystkie" ? true : filter === "nowe" ? !z.obsluzone : !!z.obsluzone)),
    [items, filter],
  );
  const fresh = (items ?? []).filter((z) => !z.obsluzone).length;

  const toggle = async (z: Zgloszenie) => {
    try {
      const updated = await requestsApi.setDone(z.id, !z.obsluzone);
      setItems((list) => (list ?? []).map((x) => (x.id === z.id ? updated : x)));
      toast(updated.obsluzone ? "Oznaczono jako obsłużone" : "Przywrócono do nowych", { desc: z.imie });
    } catch (e) {
      toast("Nie udało się zapisać", { desc: errText(e), type: "err" });
    }
  };

  const remove = async (z: Zgloszenie) => {
    try {
      await requestsApi.remove(z.id);
      setItems((list) => (list ?? []).filter((x) => x.id !== z.id));
      toast("Usunięto zgłoszenie", { desc: z.imie });
    } catch (e) {
      toast("Nie udało się usunąć", { desc: errText(e), type: "err" });
    }
  };

  return (
    <div className="pnl set">
      <header className="top">
        <a className="btn btn-plain" href="/panel" aria-label="Wróć do ofert">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <PanelBrand />
        <div className="crumb">
          <span>/</span>
          <b>Zgłoszenia</b>
        </div>
        <span className="grow" />
        {!auth.need ? <LogoutButton /> : null}
        <a className="btn btn-ghost" href="/panel">
          Oferty
        </a>
      </header>

      <main className="surface set-main">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Seg label="Filtr zgłoszeń" value={filter} onChange={setFilter} options={FILTERS} />
          <span className="faint" style={{ fontSize: 12.5 }}>
            {items ? `${fresh} nowych · zgłoszenia są przechowywane 180 dni` : ""}
          </span>
          <span className="grow" style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            Odśwież
          </button>
        </div>

        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : items === null ? (
          !auth.need ? <p className="faint">Wczytywanie zgłoszeń…</p> : null
        ) : shown.length === 0 ? (
          <p className="empty">
            {filter === "nowe"
              ? "Brak nowych zgłoszeń. Prośby o wycenę i pomiar ze strony oferty oraz wiadomości z formularza kontaktowego pojawią się tutaj."
              : "Nic tu nie ma."}
          </p>
        ) : (
          <ul className="zg-list">
            {shown.map((z) => (
              <li key={z.id} className="zg-item" data-done={z.obsluzone ? "" : undefined}>
                <div className="zg-head">
                  <span className={`badge ${z.obsluzone ? "badge-ok" : "badge-wait"}`}>{TYP_LABEL[z.typ] ?? z.typ}</span>
                  <b>{z.imie}</b>
                  {z.firma ? <span className="faint">· {z.firma}</span> : null}
                  <span className="grow" style={{ flex: 1 }} />
                  <span className="faint" style={{ fontSize: 12.5 }}>
                    {dateText(z.utworzono)}
                  </span>
                </div>
                <div className="zg-contact">
                  {z.telefon ? <a href={`tel:${z.telefon.replace(/[^\d+]/g, "")}`}>{z.telefon}</a> : null}
                  {z.email ? <a href={`mailto:${z.email}`}>{z.email}</a> : null}
                  {z.oferta ? <span className="faint">Oferta {z.oferta}</span> : null}
                </div>
                {z.uwagi ? <p className="zg-notes">{z.uwagi}</p> : null}
                {z.wybor ? <p className="faint zg-choice">Wybór klienta: {z.wybor}</p> : null}
                <div className="zg-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => void toggle(z)}>
                    {z.obsluzone ? "Przywróć do nowych" : "Oznacz jako obsłużone"}
                  </button>
                  <HoldButton onConfirm={() => void remove(z)} holdLabel="Przytrzymaj, aby usunąć" ariaLabel={`Usuń zgłoszenie: ${z.imie}`}>
                    Usuń
                  </HoldButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {auth.need ? (
        <LoginDialog
          error={auth.error}
          onLoggedIn={() => {
            setAuth({ need: false, error: "" });
            void load();
          }}
        />
      ) : null}
      <Toaster />
      <Tooltips />
    </div>
  );
}
