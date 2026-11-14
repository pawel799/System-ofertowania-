"use client";

/*
 * Ustawienia → Błędy (tylko administrator): błędy JavaScript z przeglądarek i błędy funkcji serwera
 * z produkcji (functions/_lib/bledy.ts), pogrupowane, od ostatnio występującego.
 */
import { useCallback, useEffect, useState } from "react";
import { adminApi, type BladProdukcji } from "./offerApi";
import { toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
const kiedy = (iso: string) => new Date(iso).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });

export function BledyTab({ onAuthError }: { onAuthError: (e: unknown) => boolean }) {
  const [bledy, setBledy] = useState<BladProdukcji[] | null>(null);
  const [err, setErr] = useState("");
  const wczytaj = useCallback(() => {
    adminApi
      .bledy()
      .then((b) => {
        setBledy(b);
        setErr("");
      })
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);
  useEffect(() => wczytaj(), [wczytaj]);

  const usun = async (id?: string) => {
    try {
      await adminApi.usunBledy(id);
      setBledy((l) => (id ? (l ?? []).filter((b) => b.id !== id) : []));
      toast(id ? "Usunięto błąd" : "Wyczyszczono listę błędów");
    } catch (e) {
      if (!onAuthError(e)) toast("Nie udało się usunąć", { type: "err", desc: errText(e) });
    }
  };

  return (
    <section className="set-card set-card-wide">
      <div className="set-card-head">
        <div>
          <h2>Błędy z produkcji</h2>
          <p className="lede">Błędy JavaScript u użytkowników i błędy serwera z ostatnich 30 dni – pogrupowane, z licznikiem. Bez danych osobowych (tylko ścieżka strony).</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={wczytaj}>
            Odśwież
          </button>
          {bledy?.length ? (
            <button type="button" className="btn btn-plain kr-usun" onClick={() => void usun()}>
              Wyczyść wszystkie
            </button>
          ) : null}
        </div>
      </div>
      {err ? <p className="err">{err}</p> : null}
      {bledy === null && !err ? <p className="lede">Wczytywanie…</p> : null}
      {bledy && !bledy.length ? <p className="lede">Brak błędów. Tak trzymać.</p> : null}
      {bledy?.length ? (
        <ul className="bledy-lista">
          {bledy.map((b) => (
            <li key={b.id}>
              <div className="bledy-gora">
                <span className={`badge ${b.zrodlo === "serwer" ? "badge-wait" : ""}`}>{b.zrodlo === "serwer" ? "serwer" : "przeglądarka"}</span>
                <b className="bledy-msg">{b.msg}</b>
                <span className="mono bledy-ile" title="Ile razy">
                  ×{b.ile}
                </span>
              </div>
              <p className="faint bledy-meta">
                ostatnio {kiedy(b.ostatnio)} · pierwszy raz {kiedy(b.pierwszy)}
                {b.sciezki.length ? ` · ${b.sciezki.join(", ")}` : ""}
              </p>
              {b.stack || b.ua ? (
                <details>
                  <summary>Szczegóły</summary>
                  {b.stack ? <pre className="bledy-stack">{b.stack}</pre> : null}
                  {b.ua ? <p className="faint bledy-meta">{b.ua}</p> : null}
                </details>
              ) : null}
              <button type="button" className="btn btn-plain bledy-usun" onClick={() => void usun(b.id)} aria-label={`Usuń błąd: ${b.msg}`}>
                Rozwiązane
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
