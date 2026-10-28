"use client";

/*
 * Ustawienia → Katalog materiałów: własne płyty frontów, korpusów, blatów, obrzeża, uchwyty i okucia firmy.
 * Pozycje frontów, blatów i uchwytów od razu pojawiają się w ofercie, kreatorze, 3D, PDF i mailu (id "cat:<id>").
 * Korpus, obrzeże i okucia niewidoczne (zawiasy, prowadnice, nogi) są w katalogu na przyszłe wersje oferty.
 * To nie jest rozkrój – bez formatek i list cięcia.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  KATALOG_JEDNOSTKI,
  KATALOG_RODZAJE,
  KATALOG_WYKONCZENIA,
  RODZAJ_KATALOGU_LABEL,
  WYKONCZENIE_LABEL,
  zestawStartowy,
  type KatalogJednostka,
  type KatalogPozycja,
  type KatalogRodzaj,
  type KatalogWykonczenie,
} from "../katalogFirmy";
import { formatPln } from "../pricing";
import { assetsApi } from "./offerApi";
import { HoldButton, toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
const W_OFERCIE: ReadonlySet<KatalogRodzaj> = new Set<KatalogRodzaj>(["plyta_front", "plyta_blat", "uchwyt"]);
const JEDNOSTKA_LABEL: Record<KatalogJednostka, string> = { szt: "szt.", m2: "m²", mb: "mb" };

type Draft = {
  id?: string;
  kind: KatalogRodzaj;
  name: string;
  producer: string;
  collection: string;
  thicknessMm: string;
  finish: KatalogWykonczenie | "";
  color: string;
  ral: string;
  delta: string;
  unit: KatalogJednostka | "";
  active: boolean;
  bezUchwytu: boolean;
};

const nowy = (kind: KatalogRodzaj): Draft => ({
  kind,
  name: "",
  producer: "",
  collection: "",
  thicknessMm: kind === "plyta_blat" ? "38" : kind.startsWith("plyta") ? "18" : "",
  finish: kind.startsWith("plyta") ? "mat" : "",
  color: "#d8d1c4",
  ral: "",
  delta: "0",
  unit: "",
  active: true,
  bezUchwytu: false,
});

const zPozycji = (p: KatalogPozycja): Draft => ({
  id: p.id,
  kind: p.kind,
  name: p.name,
  producer: p.producer ?? "",
  collection: p.collection ?? "",
  thicknessMm: p.thicknessMm != null ? String(p.thicknessMm) : "",
  finish: p.finish ?? "",
  color: p.color,
  ral: p.ral ?? "",
  delta: String(p.delta),
  unit: p.unit ?? "",
  active: p.active,
  bezUchwytu: !!p.bezUchwytu,
});

export function KatalogTab({ canEdit, onAuthError }: { canEdit: boolean; onAuthError: (e: unknown) => boolean }) {
  const [lista, setLista] = useState<KatalogPozycja[] | null>(null);
  const [error, setError] = useState("");
  const [rodzaj, setRodzaj] = useState<KatalogRodzaj | "wszystkie">("wszystkie");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [wczytuje, setWczytuje] = useState(false);

  useEffect(() => {
    assetsApi
      .katalog()
      .then(setLista)
      .catch((e) => {
        if (!onAuthError(e)) setError(errText(e));
      });
  }, [onAuthError]);

  const widoczne = useMemo(() => (lista ?? []).filter((p) => rodzaj === "wszystkie" || p.kind === rodzaj), [lista, rodzaj]);
  const liczba = (k: KatalogRodzaj) => (lista ?? []).filter((p) => p.kind === k).length;

  const zapisany = (p: KatalogPozycja) =>
    setLista((l) => {
      const list = l ?? [];
      return list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p];
    });

  const usun = async (p: KatalogPozycja) => {
    try {
      await assetsApi.removeKatalog(p.id);
      setLista((l) => (l ?? []).filter((x) => x.id !== p.id));
      toast("Usunięto z katalogu", { desc: p.name });
    } catch (e) {
      if (!onAuthError(e)) toast("Nie udało się usunąć", { type: "err", desc: errText(e) });
    }
  };

  const przelacz = async (p: KatalogPozycja) => {
    try {
      zapisany(await assetsApi.updateKatalog({ ...p, active: !p.active }));
      toast(p.active ? "Pozycja wyłączona" : "Pozycja włączona", { desc: p.name });
    } catch (e) {
      if (!onAuthError(e)) toast("Nie udało się zmienić", { type: "err", desc: errText(e) });
    }
  };

  const startowy = async () => {
    setWczytuje(true);
    let n = 0;
    try {
      for (const p of zestawStartowy()) {
        zapisany(await assetsApi.createKatalog(p));
        n++;
      }
      toast("Wczytano zestaw startowy", { desc: `${n} pozycji – zmień nazwy, kolory i dopłaty na swoje.` });
    } catch (e) {
      if (!onAuthError(e)) toast(n ? `Wczytano ${n} pozycji` : "Nie wczytano zestawu", { type: "err", desc: errText(e) });
    } finally {
      setWczytuje(false);
    }
  };

  if (draft) {
    return <KatalogEditor draft={draft} onCancel={() => setDraft(null)} onSaved={(p) => (zapisany(p), setDraft(null))} onAuthError={onAuthError} />;
  }

  return (
    <section className="set-card set-card-wide">
      <div className="set-card-head">
        <div>
          <h2>Katalog materiałów</h2>
          <p className="lede">
            Twoje płyty, blaty, obrzeża i uchwyty z nazwą, kolorem, wykończeniem i dopłatą. Fronty, blaty i uchwyty z katalogu klient
            wybiera w ofercie i w kuchni 3D – zamiast zestawu startowego. Wysłane linki trzymają dopłaty z chwili zapisu oferty.
          </p>
        </div>
        {canEdit ? (
          <div className="actions">
            {lista && !lista.length ? (
              <button type="button" className="btn btn-ghost" disabled={wczytuje} onClick={() => void startowy()}>
                {wczytuje ? "Wczytywanie…" : "Wczytaj zestaw startowy"}
              </button>
            ) : null}
            <button type="button" className="btn btn-ink" onClick={() => setDraft(nowy(rodzaj === "wszystkie" ? "plyta_front" : rodzaj))}>
              Nowa pozycja
            </button>
          </div>
        ) : null}
      </div>
      <div className="kr-choice" role="radiogroup" aria-label="Rodzaj" style={{ marginTop: 12 }}>
        <button type="button" role="radio" aria-checked={rodzaj === "wszystkie"} className="btn btn-ghost" onClick={() => setRodzaj("wszystkie")}>
          Wszystkie {lista ? `(${lista.length})` : ""}
        </button>
        {KATALOG_RODZAJE.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={rodzaj === k} className="btn btn-ghost" onClick={() => setRodzaj(k)}>
            {RODZAJ_KATALOGU_LABEL[k]} {liczba(k) ? `(${liczba(k)})` : ""}
          </button>
        ))}
      </div>
      {error ? <p className="err">{error}</p> : null}
      {lista === null && !error ? <p className="lede">Wczytywanie…</p> : null}
      {lista && !widoczne.length ? (
        <p className="empty">
          {lista.length
            ? "Brak pozycji tego rodzaju."
            : "Katalog jest pusty – oferty używają zestawu startowego (5 frontów, 3 blaty, 3 uchwyty). Wczytaj go jako punkt wyjścia albo dodaj pierwszą płytę, np. „Egger H1180 Dąb Halifax”."}
        </p>
      ) : null}
      <ul className="set-list">
        {widoczne.map((p) => (
          <li key={p.id} className="set-row" data-off={p.active ? undefined : ""}>
            <span className="kat-probka" style={{ background: p.color }} aria-hidden />
            <div className="set-row-main">
              <b>
                {p.name}
                {!p.active ? <span className="faint"> · wyłączona</span> : null}
              </b>
              <span className="faint">
                {RODZAJ_KATALOGU_LABEL[p.kind]}
                {p.producer ? ` · ${p.producer}` : ""}
                {p.collection ? ` ${p.collection}` : ""}
                {p.thicknessMm ? ` · ${String(p.thicknessMm).replace(".", ",")} mm` : ""}
                {p.finish ? ` · ${WYKONCZENIE_LABEL[p.finish].toLowerCase()}` : ""}
                {p.bezUchwytu ? " · bez uchwytów (push-to-open)" : ""}
                {` · ${p.delta ? `dopłata ${formatPln(p.delta)}${p.unit ? ` / ${JEDNOSTKA_LABEL[p.unit]}` : ""}` : "w cenie"}`}
                {W_OFERCIE.has(p.kind) ? "" : " · w ofercie: wkrótce"}
              </span>
            </div>
            {canEdit ? (
              <div className="set-row-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setDraft(zPozycji(p))}>
                  Edytuj
                </button>
                <button type="button" className="btn btn-plain" onClick={() => void przelacz(p)}>
                  {p.active ? "Wyłącz" : "Włącz"}
                </button>
                <HoldButton holdLabel="Przytrzymaj…" ariaLabel={`Przytrzymaj, aby usunąć ${p.name}`} onConfirm={() => void usun(p)}>
                  Usuń
                </HoldButton>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {!canEdit ? <p className="faint">Katalog zmienia właściciel konta firmy.</p> : null}
    </section>
  );
}

function KatalogEditor({
  draft: initial,
  onCancel,
  onSaved,
  onAuthError,
}: {
  draft: Draft;
  onCancel: () => void;
  onSaved: (p: KatalogPozycja) => void;
  onAuthError: (e: unknown) => boolean;
}) {
  const [d, setD] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const delta = Number(d.delta.replace(/\s/g, "").replace(",", "."));
    const grubosc = d.thicknessMm.trim() ? Number(d.thicknessMm.replace(",", ".")) : undefined;
    if (!d.name.trim()) return setError("Wpisz nazwę, np. „Egger H1180 Dąb Halifax”.");
    if (!/^#[0-9a-fA-F]{6}$/.test(d.color)) return setError("Kolor podaj jako #rrggbb.");
    if (!Number.isInteger(delta)) return setError("Dopłata musi być liczbą całkowitą (zł).");
    if (grubosc !== undefined && (!Number.isFinite(grubosc) || grubosc <= 0 || grubosc > 200)) return setError("Grubość podaj w mm, np. 18.");
    if (d.ral && !/^\d{4}$/.test(d.ral)) return setError("Kod RAL to cztery cyfry, np. 9010.");
    setSaving(true);
    setError("");
    const body = {
      kind: d.kind,
      name: d.name.trim(),
      producer: d.producer.trim() || undefined,
      collection: d.collection.trim() || undefined,
      thicknessMm: grubosc,
      finish: d.finish || undefined,
      color: d.color.toLowerCase(),
      ral: d.ral || undefined,
      delta,
      unit: d.unit || undefined,
      active: d.active,
      bezUchwytu: d.kind === "uchwyt" ? d.bezUchwytu : undefined,
    };
    try {
      const saved = d.id ? await assetsApi.updateKatalog({ id: d.id, ...body }) : await assetsApi.createKatalog(body);
      toast(d.id ? "Zapisano pozycję" : "Dodano do katalogu", { desc: saved.name });
      onSaved(saved);
    } catch (err) {
      if (!onAuthError(err)) setError(errText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="set-card set-card-wide" onSubmit={save} noValidate>
      <div className="set-card-head">
        <h2>{d.id ? "Edytuj pozycję katalogu" : "Nowa pozycja katalogu"}</h2>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Anuluj
          </button>
          <button type="submit" className="btn btn-ink" disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz"}
          </button>
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="kat-kind">Rodzaj</label>
          <select id="kat-kind" className="input" value={d.kind} onChange={(e) => set("kind", e.target.value as KatalogRodzaj)}>
            {KATALOG_RODZAJE.map((k) => (
              <option key={k} value={k}>
                {RODZAJ_KATALOGU_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="kat-name">Nazwa</label>
          <input id="kat-name" className="input" maxLength={120} value={d.name} placeholder="np. Egger H1180 Dąb Halifax" onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="kat-producer">Producent</label>
          <input id="kat-producer" className="input" maxLength={80} value={d.producer} placeholder="Egger, Kronospan, Blum…" onChange={(e) => set("producer", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="kat-collection">Kolekcja / kod</label>
          <input id="kat-collection" className="input" maxLength={80} value={d.collection} placeholder="np. ST37" onChange={(e) => set("collection", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="kat-color">Kolor w 3D i na próbce</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="kat-color-pick"
              type="color"
              aria-label="Wybierz kolor"
              value={/^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : "#d8d1c4"}
              onChange={(e) => set("color", e.target.value)}
              style={{ width: 44, height: 36, padding: 2, border: 0, background: "transparent" }}
            />
            <input id="kat-color" className="input mono-input" value={d.color} maxLength={7} onChange={(e) => set("color", e.target.value.trim())} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="kat-finish">Wykończenie</label>
          <select id="kat-finish" className="input" value={d.finish} onChange={(e) => set("finish", e.target.value as KatalogWykonczenie | "")}>
            <option value="">—</option>
            {KATALOG_WYKONCZENIA.map((f) => (
              <option key={f} value={f}>
                {WYKONCZENIE_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="kat-thick">Grubość (mm)</label>
          <input id="kat-thick" className="input" inputMode="decimal" value={d.thicknessMm} placeholder="18" onChange={(e) => set("thicknessMm", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="kat-ral">Kod RAL (opcjonalnie)</label>
          <input id="kat-ral" className="input" inputMode="numeric" maxLength={4} value={d.ral} placeholder="9010" onChange={(e) => set("ral", e.target.value.trim())} />
        </div>
        <div className="field">
          <label htmlFor="kat-delta">Dopłata do oferty (zł netto)</label>
          <input id="kat-delta" className="input" inputMode="numeric" value={d.delta} onChange={(e) => set("delta", e.target.value)} />
          <span className="faint" style={{ fontSize: 12 }}>
            0 = w cenie. Ujemna = opust (np. tańszy laminat).
          </span>
        </div>
        <div className="field">
          <label htmlFor="kat-unit">Jednostka dopłaty</label>
          <select id="kat-unit" className="input" value={d.unit} onChange={(e) => set("unit", e.target.value as KatalogJednostka | "")}>
            <option value="">ryczałt za ofertę</option>
            {KATALOG_JEDNOSTKI.map((u) => (
              <option key={u} value={u}>
                {JEDNOSTKA_LABEL[u]} (informacyjnie w ofercie)
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="toggles" style={{ marginTop: 12 }}>
        <label className="tg" htmlFor="kat-active">
          Aktywna (widać w nowych ofertach)
          <input id="kat-active" type="checkbox" className="switch" checked={d.active} onChange={(e) => set("active", e.target.checked)} />
        </label>
        {d.kind === "uchwyt" ? (
          <label className="tg" htmlFor="kat-bez">
            Bez uchwytów (push-to-open, Gola) – w 3D uchwyty znikają
            <input id="kat-bez" type="checkbox" className="switch" checked={d.bezUchwytu} onChange={(e) => set("bezUchwytu", e.target.checked)} />
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
