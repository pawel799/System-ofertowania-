"use client";

/*
 * Ustawienia → Baza płyt: własne płyty i blaty stolarni z pliku CSV (src/lib/plyty.ts).
 * Kolumny: producent;kod;nazwa;typ;grubosci;hex;cena_m2 (separator ; albo ,, UTF-8; cena opcjonalna).
 * Podgląd przed zapisem, błędne wiersze z numerem (reszta się importuje), zapis do KV firmy, eksport do CSV.
 * Kreator pokazuje te płyty obok wbudowanych (Egger, Kronospan) przy wyborze korpusu, frontów, blatu i obrzeża.
 */
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { csvZPlyt, nazwaProducenta, NOTA_PLYT, parseCsvPlyt, TYP_PLYTY_LABEL, type Board, type WynikCsv } from "@/lib/plyty";
import { plytyApi } from "./offerApi";
import { HoldButton, toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
const zl = (n: number) => `${String(n).replace(".", ",")} zł/m²`;
/** „1 płyta”, „3 płyty”, „5 płyt”. */
const ilePlyt = (n: number) => `${n} ${n === 1 ? "płyta" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "płyty" : "płyt"}`;
const mm = (b: Board) => `${b.thicknesses.map((t) => String(t).replace(".", ",")).join("/")} mm`;

/** Plik w UTF-8; gdy są „krzaczki” (Excel zapisał w Windows-1250) – druga próba w 1250. */
async function czytajPlik(f: File): Promise<string> {
  const buf = await f.arrayBuffer();
  const utf = new TextDecoder("utf-8").decode(buf);
  if (!utf.includes("�")) return utf;
  try {
    return new TextDecoder("windows-1250").decode(buf);
  } catch {
    return utf;
  }
}

function pobierz(nazwa: string, tresc: string) {
  const url = URL.createObjectURL(new Blob([tresc], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nazwa;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Lista({ plyty }: { plyty: readonly Board[] }) {
  const [ile, setIle] = useState(50);
  return (
    <>
      <ul className="set-list">
        {plyty.slice(0, ile).map((b) => (
          <li key={b.id} className="set-row">
            <span className="kat-probka" style={{ background: b.hex }} aria-hidden />
            <div className="set-row-main">
              <b>
                {nazwaProducenta(b)} {b.code}
                {b.structure ? ` ${b.structure}` : ""} · {b.name}
              </b>
              <span className="faint">
                {TYP_PLYTY_LABEL[b.type]} · {mm(b)}
                {typeof b.priceM2 === "number" ? ` · ${zl(b.priceM2)}` : " · bez ceny"}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {plyty.length > ile ? (
        <button type="button" className="btn btn-plain" onClick={() => setIle(ile + 200)}>
          Pokaż więcej ({plyty.length - ile})
        </button>
      ) : null}
    </>
  );
}

export function PlytyTab({ canEdit, onAuthError }: { canEdit: boolean; onAuthError: (e: unknown) => boolean }) {
  const [zapisane, setZapisane] = useState<Board[] | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [podglad, setPodglad] = useState<(WynikCsv & { plik: string }) | null>(null);
  const [zapis, setZapis] = useState(false);

  useEffect(() => {
    plytyApi
      .get()
      .then((r) => {
        setZapisane(r.plyty);
        setAt(r.at);
      })
      .catch((e) => {
        if (!onAuthError(e)) setError(errText(e));
      });
  }, [onAuthError]);

  const wybierz = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      toast("Pliki Excel zapisz jako „CSV UTF-8 (rozdzielany przecinkami)” i wczytaj ponownie.");
      return;
    }
    if (f.size > 2_000_000) {
      toast("Plik jest za duży (maks. 2 MB).");
      return;
    }
    setPodglad({ ...parseCsvPlyt(await czytajPlik(f)), plik: f.name });
  };

  const zapisz = async () => {
    if (!podglad?.plyty.length) return;
    setZapis(true);
    try {
      const r = await plytyApi.save(podglad.plyty);
      setZapisane(r.plyty);
      setAt(r.at);
      setPodglad(null);
      toast(`Zapisano ${ilePlyt(r.plyty.length)}.`);
    } catch (e) {
      if (!onAuthError(e)) toast(errText(e));
    } finally {
      setZapis(false);
    }
  };

  const usun = async () => {
    try {
      await plytyApi.save([]);
      setZapisane([]);
      setAt(null);
      toast("Własna baza płyt usunięta.");
    } catch (e) {
      if (!onAuthError(e)) toast(errText(e));
    }
  };

  const cen = useMemo(() => (zapisane ?? []).filter((b) => typeof b.priceM2 === "number").length, [zapisane]);

  return (
    <section className="set-card set-card-wide">
      <div className="set-card-head">
        <div>
          <h2>Baza płyt</h2>
          <p className="lede">
            Twoje płyty i blaty z pliku CSV – kreator pokazuje je obok wbudowanych dekorów przy wyborze korpusu, frontów, blatu i obrzeża.
            Kolumny: <code>producent;kod;nazwa;typ;grubosci;hex;cena_m2</code> (cena jest opcjonalna – bez niej oferta i rozkrój liczą się bez
            kwot za płytę).
          </p>
        </div>
        <div className="actions">
          <a className="btn btn-ghost" href="/wzor-plyty.csv" download>
            Pobierz wzór CSV
          </a>
          {zapisane?.length ? (
            <button type="button" className="btn btn-ghost" onClick={() => pobierz("baza-plyt.csv", csvZPlyt(zapisane))}>
              Eksportuj do CSV
            </button>
          ) : null}
          {canEdit ? (
            <label className="btn btn-ink">
              Wczytaj CSV
              <input type="file" accept=".csv,text/csv,.txt,.xlsx,.xls" hidden onChange={(e) => void wybierz(e)} />
            </label>
          ) : null}
        </div>
      </div>

      {podglad ? (
        <div className="set-card" data-podglad-csv style={{ marginTop: 12 }}>
          <h3>Podgląd: {podglad.plik}</h3>
          {podglad.blad ? (
            <p className="err">{podglad.blad}</p>
          ) : (
            <p className="lede">
              Do zapisu: <b>{ilePlyt(podglad.plyty.length)}</b>
              {podglad.bledy.length ? (
                <>
                  , pominięte wiersze: <b>{podglad.bledy.length}</b>
                </>
              ) : null}
              . Zapis zastąpi obecną bazę ({ilePlyt(zapisane?.length ?? 0)}).
            </p>
          )}
          {podglad.bledy.length ? (
            <ul className="err" data-bledy-csv>
              {podglad.bledy.slice(0, 100).map((b) => (
                <li key={b.wiersz}>
                  Wiersz {b.wiersz}: {b.powod}
                </li>
              ))}
              {podglad.bledy.length > 100 ? <li>… i {podglad.bledy.length - 100} więcej</li> : null}
            </ul>
          ) : null}
          {podglad.plyty.length ? <Lista plyty={podglad.plyty} /> : null}
          <div className="actions">
            <button type="button" className="btn btn-ink" disabled={zapis || !podglad.plyty.length} onClick={() => void zapisz()}>
              {zapis ? "Zapisywanie…" : `Zapisz ${ilePlyt(podglad.plyty.length)}`}
            </button>
            <button type="button" className="btn btn-plain" onClick={() => setPodglad(null)}>
              Anuluj
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="err">{error}</p> : null}
      {zapisane === null && !error ? <p className="lede">Wczytywanie…</p> : null}
      {zapisane && !zapisane.length && !podglad ? (
        <p className="empty">Brak własnej bazy – kreator pokazuje tylko wbudowane dekory Egger i Kronospan. Pobierz wzór, uzupełnij i wczytaj.</p>
      ) : null}
      {zapisane?.length && !podglad ? (
        <>
          <p className="faint">
            {ilePlyt(zapisane.length)}{cen ? `, z ceną: ${cen}` : ", bez cen"}
            {at ? ` · zapisano ${new Date(at).toLocaleString("pl-PL")}` : ""}
          </p>
          <Lista plyty={zapisane} />
          {canEdit ? (
            <HoldButton holdLabel="Przytrzymaj…" ariaLabel="Przytrzymaj, aby usunąć własną bazę płyt" onConfirm={() => void usun()}>
              Usuń bazę
            </HoldButton>
          ) : null}
        </>
      ) : null}
      {!canEdit ? <p className="faint">Bazę płyt wczytuje właściciel konta firmy.</p> : null}
      <p className="faint">{NOTA_PLYT}</p>
    </section>
  );
}
