"use client";

/*
 * Panel → oferta: akceptacja klienta i wersje oferty (src/lib/wersje.ts). Wersja powstaje przy zapisie,
 * gdy klient ma link, a oferta się zmieniła; przy każdej – co się zmieniło względem poprzedniej.
 */
import { dataPl, roznice } from "@/lib/wersje";
import { formatPln } from "../pricing";
import type { Offer } from "./offers";

export function WersjeOferty({ offer }: { offer: Offer }) {
  const wersje = offer.wersje ?? [];
  const a = offer.akceptacja;
  if (!wersje.length && !a) return null;
  const ostatnia = wersje[wersje.length - 1]?.nr ?? 0;
  return (
    <section className="sec" data-wersje>
      <h2>Wersje i akceptacja</h2>
      {a ? (
        <div className="wersja-akcept" data-aktualna={a.wersja === ostatnia ? "" : undefined} role="status">
          <b>
            {a.wersja === ostatnia ? "Zaakceptowana przez klienta" : `Klient zaakceptował wersję ${a.wersja} – oferta zmieniona później`}
          </b>
          <span>
            {a.imie} · {dataPl(a.data)} · wersja {a.wersja}
            {a.kwota !== null ? ` · ${formatPln(a.kwota)} netto` : ""}
          </span>
          {a.wybor ? <span className="faint">Wybór klienta w podglądzie: {a.wybor}</span> : null}
          {a.wersja !== ostatnia ? <span className="faint">Klient zobaczy nową wersję {ostatnia} i może ją zaakceptować ponownie.</span> : null}
        </div>
      ) : (
        <p className="lede">Klient jeszcze nie zaakceptował oferty. Na stronie z linku ma przycisk „Akceptuję ofertę”.</p>
      )}
      {wersje.length ? (
        <ol className="wersje">
          {[...wersje].reverse().map((w, i, all) => {
            const poprz = all[i + 1];
            const zm = poprz ? roznice(poprz.skrot, w.skrot) : [];
            return (
              <li key={w.nr}>
                <span className="wersja-nag">
                  <b>Wersja {w.nr}</b>
                  <span className="mono faint">{dataPl(w.data)}</span>
                  {a?.wersja === w.nr ? <span className="wersja-ok">zaakceptowana</span> : null}
                </span>
                {poprz ? (
                  zm.length ? (
                    <ul>
                      {zm.map((z) => (
                        <li key={z}>{z}</li>
                      ))}
                    </ul>
                  ) : null
                ) : (
                  <span className="faint">Pierwsza wersja wysłana klientowi · {formatPln(w.skrot.cena)} netto</span>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
