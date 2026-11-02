"use client";

/*
 * Ustawienia → Powiadomienia: które e-maile wysyła system (functions/_lib/powiadomienia.ts).
 * Do firmy: pierwsze otwarcie linku, akceptacja oferty, uwagi klienta, klient zmienia kolory w podglądzie.
 * Do klienta: przypomnienie 3 dni przed wygaśnięciem linku (gdy kontakt to e-mail).
 */
import { useEffect, useState } from "react";
import { powiadomieniaApi, type PowiadomieniaView, type UstawieniaPowiadomien } from "./offerApi";
import { toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");

const OPCJE: { k: keyof UstawieniaPowiadomien; label: string; opis: string }[] = [
  { k: "otwarcie", label: "Klient otworzył ofertę", opis: "Pierwsze otwarcie linku." },
  { k: "akceptacja", label: "Klient zaakceptował ofertę", opis: "Z imieniem, wersją i kwotą." },
  { k: "uwagi", label: "Uwagi klienta", opis: "Treść uwag z linku." },
  { k: "wybor", label: "Klient zmienia kolory", opis: "Najwyżej raz na 6 godzin na ofertę." },
  { k: "przypomnienia", label: "Przypomnienie dla klienta", opis: "E-mail do klienta 3 dni przed wygaśnięciem linku (gdy w kontakcie jest e-mail)." },
];

export function PowiadomieniaTab({ canEdit, onAuthError }: { canEdit: boolean; onAuthError: (e: unknown) => boolean }) {
  const [view, setView] = useState<PowiadomieniaView | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    powiadomieniaApi
      .get()
      .then(setView)
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);

  const zmien = async (k: keyof UstawieniaPowiadomien, v: boolean) => {
    if (!view) return;
    const nowe = { ...view.powiadomienia, [k]: v };
    setView({ ...view, powiadomienia: nowe });
    try {
      setView(await powiadomieniaApi.put(nowe));
      toast(v ? "Powiadomienie włączone" : "Powiadomienie wyłączone");
    } catch (e) {
      setView(view);
      if (!onAuthError(e)) toast("Nie zapisano", { type: "err", desc: errText(e) });
    }
  };

  if (err && !view) return <p className="err">{err}</p>;
  if (!view) return <p className="lede">Wczytywanie…</p>;
  return (
    <div className="set-grid">
      <section className="set-card">
        <h2>Powiadomienia e-mail</h2>
        <p className="lede">
          {view.adresy.length ? `Powiadomienia dla firmy idą na: ${view.adresy.join(", ")}.` : "Brak adresu do powiadomień – dodaj właściciela konta w zakładce Zespół."}
        </p>
        {!view.poczta ? (
          <p className="lede" role="status">
            Wysyłka e-maili nie jest jeszcze skonfigurowana na serwerze (RESEND_API_KEY) – ustawienia zapiszą się, maile zaczną wychodzić po konfiguracji.
          </p>
        ) : null}
        <div className="toggles">
          {OPCJE.map((o) => (
            <label key={o.k} className="tg" htmlFor={`pw-${o.k}`} data-tip={o.opis}>
              {o.label}
              <input
                id={`pw-${o.k}`}
                type="checkbox"
                className="switch"
                checked={view.powiadomienia[o.k]}
                disabled={!canEdit}
                onChange={(e) => void zmien(o.k, e.target.checked)}
              />
            </label>
          ))}
        </div>
        {!canEdit ? <p className="faint">Zmienia właściciel konta firmy.</p> : null}
      </section>
    </div>
  );
}
