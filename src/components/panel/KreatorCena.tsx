"use client";

/*
 * Kreator → krok „Materiały”: płyta korpusów, dodatki do ceny (pozycje z cennika i własne) i rozbicie ceny końcowej.
 * Kwoty liczy cenaKoncowa (src/lib/cenaKoncowa.ts) przez useCenaKoncowa – te same na serwerze, w PDF i u klienta.
 */
import { useEffect, useState } from "react";
import type { CenaKoncowa } from "@/lib/cenaKoncowa";
import { bladIlosciDodatku, bledyWlasnegoDodatku, MAX_NAZWA_DODATKU, wlasnyDodatek, type DodatekOferty } from "@/lib/dodatki";
import { cenaPlytyM2, JEDNOSTKA_LABEL, JEDNOSTKI, MAX_POZYCJI, plytaOferty, plytyCennika, type JednostkaPozycji, type ModulCennik } from "@/lib/modul";
import { formatPln } from "../pricing";

const liczba = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
const OPIS_JEDNOSTKI: Record<JednostkaPozycji, string> = { kpl: "ryczałt", szt: "za sztukę", mb: "za metr bieżący", proc: "% ceny mebli" };

/** Ilość dodatku: sprawdzana przy wpisywaniu – zła wartość pokazuje błąd i nie trafia do oferty (zostaje ostatnia dobra). */
function IloscDodatku({ nazwa, jednostka, wartosc, onZmiana }: { nazwa: string; jednostka: string; wartosc: number; onZmiana: (n: number | undefined) => void }) {
  const [txt, setTxt] = useState(liczba(wartosc));
  const [blad, setBlad] = useState<string | null>(null);
  useEffect(() => {
    if (!blad) setTxt(liczba(wartosc));
    // Tylko gdy wartość zmieniła się z zewnątrz (np. metry z projektu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wartosc]);
  const id = `dod-il-${nazwa.replace(/\W+/g, "-")}`;
  return (
    <label className="kr-dodatki-ilosc">
      <span className="sr-only">
        {nazwa}: ilość ({jednostka})
      </span>
      <input
        className="input"
        inputMode="decimal"
        aria-label={`${nazwa}: ilość`}
        aria-invalid={blad ? true : undefined}
        aria-describedby={blad ? id : undefined}
        value={txt}
        onChange={(e) => {
          const v = e.target.value;
          setTxt(v);
          if (v.trim() === "") {
            setBlad(null);
            return onZmiana(undefined);
          }
          const b = bladIlosciDodatku(num(v));
          setBlad(b);
          if (!b) onZmiana(num(v));
        }}
        onBlur={() => {
          if (blad) {
            setBlad(null);
            setTxt(liczba(wartosc));
          }
        }}
      />
      <span className="kr-hint">{jednostka}</span>
      {blad ? (
        <span id={id} className="err kr-dodatki-blad" role="alert">
          {blad}
        </span>
      ) : null}
    </label>
  );
}

export function KreatorCena({
  cennik,
  plytaId,
  setPlytaId,
  dodatki,
  setDodatki,
  cena,
}: {
  cennik: ModulCennik;
  plytaId: string | undefined;
  setPlytaId: (id: string | undefined) => void;
  dodatki: DodatekOferty[];
  setDodatki: (d: DodatekOferty[]) => void;
  cena: CenaKoncowa;
}) {
  const plyty = cennik.plyty?.length ? cennik.plyty : plytyCennika(cennik);
  const wybrana = plytaOferty(cennik, plytaId).plyta;
  const zCennika = (cennik.pozycje ?? []).filter((p) => !dodatki.some((d) => d.id === p.id));
  const [doDodania, setDoDodania] = useState("");
  const [wlasna, setWlasna] = useState<{ nazwa: string; cena: string; jednostka: JednostkaPozycji; ruszone: { nazwa?: boolean; cena?: boolean } } | null>(null);
  const pelne = dodatki.length >= MAX_POZYCJI;
  // Własna pozycja sprawdzana przy wpisywaniu (te same reguły co przy zapisie oferty na serwerze).
  const bledyWlasnej = wlasna ? bledyWlasnegoDodatku({ nazwa: wlasna.nazwa, cena: wlasna.cena.trim() === "" ? NaN : num(wlasna.cena), jednostka: wlasna.jednostka }) : [];
  const bladPola = (pole: "nazwa" | "cena") => (wlasna?.ruszone[pole] ? (bledyWlasnej.find((b) => b.pole === pole)?.tekst ?? null) : null);
  const dodajWlasna = () => {
    if (!wlasna) return;
    if (bledyWlasnej.length) return setWlasna({ ...wlasna, ruszone: { nazwa: true, cena: true } });
    setDodatki([...dodatki, { id: `w${Math.random().toString(36).slice(2, 9)}`, nazwa: wlasna.nazwa.replace(/\s+/g, " ").trim(), cena: Math.round(num(wlasna.cena) * 100) / 100, jednostka: wlasna.jednostka }]);
    setWlasna(null);
  };

  const zmien = (id: string, zmiana: Partial<DodatekOferty>) => setDodatki(dodatki.map((d) => (d.id === id ? { ...d, ...zmiana } : d)));

  return (
    <>
      <div className="field">
        <label className="lab" htmlFor="k-plyta">
          Płyta korpusów
        </label>
        {cennik.plyty && cennik.plyty.length > 1 ? (
          <select id="k-plyta" className="input" value={wybrana?.id ?? ""} onChange={(e) => setPlytaId(e.target.value === cennik.plytaDomyslna ? undefined : e.target.value)}>
            {plyty.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nazwa} · {liczba(p.grubosc)} mm · {formatPln(cenaPlytyM2(p, cennik.odpadPlyty))}/m²{p.id === cennik.plytaDomyslna ? " (domyślna)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <p className="kr-hint">
            {plyty[0].nazwa}. Inne płyty (grubość, format arkusza, cena) dodasz w Ustawienia → Cennik modułów.
          </p>
        )}
        {cena.plyta ? (
          <p className="kr-hint" data-plyta-info>
            Ok. {liczba(cena.plyta.m2)} m² płyty ≈ {cena.plyta.arkusze} {cena.plyta.arkusze === 1 ? "arkusz" : cena.plyta.arkusze < 5 ? "arkusze" : "arkuszy"} {cena.plyta.format}
            {cennik.odpadPlyty ? ` (z odpadem ${liczba(cennik.odpadPlyty)}%)` : ""} – orientacyjnie, bez rozkroju.
          </p>
        ) : null}
      </div>

      <div className="field kr-dodatki">
        <span className="lab">Dodatki do ceny</span>
        {cena.dodatkiWycenione.length ? (
          <ul className="kr-dodatki-lista" aria-label="Dodatki do ceny">
            {cena.dodatkiWycenione.map((d) => {
              const zapis = dodatki.find((x) => x.id === d.id);
              return (
                <li key={d.id} data-brak={d.brak ? "" : undefined}>
                  <span className="kr-dodatki-nazwa">
                    <b>{d.nazwa}</b>
                    <span className="kr-hint">
                      {d.brak
                        ? "pozycji nie ma już w cenniku – nie liczy się"
                        : d.jednostka === "proc"
                          ? `${liczba(d.cena)}% ceny mebli`
                          : `${formatPln(d.cena)} ${d.jednostka === "kpl" ? "ryczałt" : `/ ${JEDNOSTKA_LABEL[d.jednostka]}`}${wlasnyDodatek(d.id) ? " · tylko w tej ofercie" : ""}`}
                    </span>
                  </span>
                  {!d.brak && (d.jednostka === "szt" || d.jednostka === "mb") ? (
                    <IloscDodatku nazwa={d.nazwa} jednostka={JEDNOSTKA_LABEL[d.jednostka]} wartosc={zapis?.ilosc ?? d.ilosc} onZmiana={(n) => zmien(d.id, { ilosc: n })} />
                  ) : (
                    <span />
                  )}
                  <span className="mono kr-dodatki-kwota">{d.brak ? "—" : formatPln(d.kwota)}</span>
                  <button type="button" className="btn btn-plain" aria-label={`Usuń: ${d.nazwa}`} onClick={() => setDodatki(dodatki.filter((x) => x.id !== d.id))}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kr-hint">Brak – transport, montaż czy rabat dodasz z cennika albo jako własną pozycję.</p>
        )}
        {cena.dodatkiWycenione.some((d) => d.jednostka === "mb") ? <p className="kr-hint">Metr bieżący zabudowy z projektu: {liczba(cena.mb)} mb (możesz poprawić ilość).</p> : null}
        <div className="kr-dodatki-dodaj">
          {zCennika.length ? (
            <>
              <select className="input" aria-label="Pozycja z cennika" value={doDodania} onChange={(e) => setDoDodania(e.target.value)}>
                <option value="">Z cennika…</option>
                {zCennika.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nazwa} ({p.jednostka === "proc" ? `${liczba(p.cena)}%` : `${formatPln(p.cena)} / ${JEDNOSTKA_LABEL[p.jednostka]}`})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!doDodania || pelne}
                onClick={() => {
                  setDodatki([...dodatki, { id: doDodania }]);
                  setDoDodania("");
                }}
              >
                Dodaj
              </button>
            </>
          ) : null}
          {!wlasna ? (
            <button type="button" className="btn btn-ghost" disabled={pelne} onClick={() => setWlasna({ nazwa: "", cena: "", jednostka: "kpl", ruszone: {} })}>
              + Własna pozycja
            </button>
          ) : null}
        </div>
        {pelne ? <p className="kr-hint">Limit {MAX_POZYCJI} pozycji – usuń którąś, żeby dodać nową.</p> : null}
        {wlasna ? (
          <form
            className="kr-dodatki-wlasna"
            aria-label="Własna pozycja"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              dodajWlasna();
            }}
          >
            <input
              className="input"
              aria-label="Nazwa pozycji"
              placeholder="Np. demontaż starej zabudowy"
              maxLength={MAX_NAZWA_DODATKU}
              value={wlasna.nazwa}
              aria-invalid={bladPola("nazwa") ? true : undefined}
              aria-describedby={bladPola("nazwa") ? "dod-blad-nazwa" : undefined}
              onChange={(e) => setWlasna({ ...wlasna, nazwa: e.target.value })}
              onBlur={() => setWlasna({ ...wlasna, ruszone: { ...wlasna.ruszone, nazwa: true } })}
            />
            <input
              className="input"
              aria-label="Kwota"
              inputMode="decimal"
              placeholder={wlasna.jednostka === "proc" ? "%" : "zł"}
              value={wlasna.cena}
              aria-invalid={bladPola("cena") ? true : undefined}
              aria-describedby={bladPola("cena") ? "dod-blad-cena" : undefined}
              onChange={(e) => setWlasna({ ...wlasna, cena: e.target.value, ruszone: { ...wlasna.ruszone, cena: true } })}
            />
            <select className="input" aria-label="Jednostka" value={wlasna.jednostka} onChange={(e) => setWlasna({ ...wlasna, jednostka: e.target.value as JednostkaPozycji })}>
              {JEDNOSTKI.map((j) => (
                <option key={j} value={j}>
                  {OPIS_JEDNOSTKI[j]}
                </option>
              ))}
            </select>
            {bladPola("nazwa") || bladPola("cena") ? (
              <ul className="err kr-dodatki-bledy" role="alert">
                {bladPola("nazwa") ? <li id="dod-blad-nazwa">{bladPola("nazwa")}</li> : null}
                {bladPola("cena") ? <li id="dod-blad-cena">{bladPola("cena")}</li> : null}
              </ul>
            ) : null}
            <div className="actions">
              <button type="button" className="btn btn-plain" onClick={() => setWlasna(null)}>
                Anuluj
              </button>
              <button type="submit" className="btn btn-ink" aria-disabled={bledyWlasnej.length > 0 ? true : undefined}>
                Dodaj pozycję
              </button>
            </div>
            <p className="kr-hint">Ujemna kwota albo procent to rabat.</p>
          </form>
        ) : null}
      </div>

      {cena.skladniki.length ? (
        <div className="field">
          <span className="lab">Cena końcowa</span>
          <table className="kr-rozbicie" aria-label="Rozbicie ceny końcowej">
            <tbody>
              {cena.skladniki.map((s) => (
                <tr key={s.klucz} data-rodzaj={s.rodzaj}>
                  <td>
                    {s.nazwa}
                    {s.opis ? <span className="kr-hint"> · {s.opis}</span> : null}
                  </td>
                  <td className="mono">{formatPln(s.kwota)}</td>
                </tr>
              ))}
              <tr className="kr-rozbicie-razem">
                <td>Razem netto</td>
                <td className="mono">{formatPln(cena.razem)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
