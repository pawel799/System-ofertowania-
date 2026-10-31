"use client";

/*
 * Ustawienia → Cennik modułów: ceny szafek na wymiar (moduł parametryczny).
 * Cena modułu = baza + płyta [m²] × cena płyty + front [m²] × cena frontu + szerokość [m] × cena za mb.
 * Ten sam wzór liczy serwer dla oferty i widżetu na stronie (src/lib/modul.ts).
 *
 * Płyty korpusów: grubość, format arkusza i cena za arkusz → cena za m² (z odpadem). Oferta wybiera płytę
 * w kreatorze (krok „Materiały”), domyślna liczy się w ofertach bez wyboru i w widżecie.
 * Własne pozycje: transport, montaż za mb, LED, rabat w % – oferta dolicza je do ceny końcowej (src/lib/dodatki.ts).
 */
import { useEffect, useState, type FormEvent } from "react";
import {
  cenaPlytyM2,
  DEFAULT_CENNIK,
  FORMAT_STANDARD,
  JEDNOSTKA_LABEL,
  JEDNOSTKI,
  MAX_PLYT,
  MAX_POZYCJI,
  modulCena,
  modulPowierzchnie,
  plytyCennika,
  powierzchniaArkusza,
  type JednostkaPozycji,
  type ModulCennik,
} from "@/lib/modul";
import { formatPln } from "../pricing";
import { cennikApi } from "./offerApi";
import { toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
type Pole = "baza" | "frontM2" | "mb" | "szuflada" | "drazek";
const FIELDS: { k: Pole; label: string }[] = [
  { k: "baza", label: "Cena bazowa za moduł (zł)" },
  { k: "frontM2", label: "Front (zł/m²)" },
  { k: "mb", label: "Za metr bieżący szerokości (zł/mb)" },
  { k: "szuflada", label: "Szuflada we wnętrzu – prowadnice (zł/szt.)" },
  { k: "drazek", label: "Drążek w szafie (zł/szt.)" },
];
const SAMPLES = [
  { w: 40, h: 72, d: 56 },
  { w: 60, h: 72, d: 56 },
  { w: 80, h: 72, d: 56 },
  { w: 60, h: 210, d: 56 },
];
const m2 = (n: number) => `${n.toFixed(2).replace(".", ",")} m²`;
const zl = (n: number) => `${String(Math.round(n * 100) / 100).replace(".", ",")} zł`;

type PlytaForm = { id: string; nazwa: string; grubosc: string; dl: string; szer: string; cenaArkusza: string };
type PozycjaForm = { id: string; nazwa: string; cena: string; jednostka: JednostkaPozycji; domyslna: boolean };
type Form = Record<Pole, string> & { odpad: string; plytaDomyslna: string; plyty: PlytaForm[]; pozycje: PozycjaForm[] };

const noweId = (p: string) => `${p}${Math.random().toString(36).slice(2, 9)}`;

function doFormularza(c: ModulCennik): Form {
  const plyty = plytyCennika(c);
  return {
    baza: String(c.baza),
    frontM2: String(c.frontM2),
    mb: String(c.mb),
    szuflada: String(c.szuflada ?? DEFAULT_CENNIK.szuflada),
    drazek: String(c.drazek ?? DEFAULT_CENNIK.drazek),
    odpad: String(c.odpadPlyty ?? 0),
    plytaDomyslna: c.plytaDomyslna && plyty.some((p) => p.id === c.plytaDomyslna) ? c.plytaDomyslna : plyty[0].id,
    plyty: plyty.map((p) => ({ id: p.id, nazwa: p.nazwa, grubosc: String(p.grubosc), dl: String(p.dl), szer: String(p.szer), cenaArkusza: String(p.cenaArkusza) })),
    pozycje: (c.pozycje ?? []).map((p) => ({ id: p.id, nazwa: p.nazwa, cena: String(p.cena), jednostka: p.jednostka, domyslna: !!p.domyslna })),
  };
}

const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

/** Formularz → cennik; null + komunikat, gdy coś jest nie tak. */
function zFormularza(f: Form): { cennik: ModulCennik | null; blad: string } {
  const kw = (v: string, min = 0, max = 1_000_000) => {
    const n = num(v);
    return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
  };
  const skalary = { baza: kw(f.baza), frontM2: kw(f.frontM2), mb: kw(f.mb), szuflada: kw(f.szuflada), drazek: kw(f.drazek) };
  if (Object.values(skalary).some((n) => Number.isNaN(n))) return { cennik: null, blad: "Wpisz kwoty od 0 do 1 000 000 zł." };
  const odpad = kw(f.odpad, 0, 50);
  if (Number.isNaN(odpad)) return { cennik: null, blad: "Odpad płyty: od 0 do 50%." };
  if (!f.plyty.length) return { cennik: null, blad: "Dodaj choć jedną płytę korpusu." };
  const plyty = [];
  for (const p of f.plyty) {
    const nazwa = p.nazwa.trim();
    const o = { id: p.id, nazwa, grubosc: kw(p.grubosc, 8, 40), dl: kw(p.dl, 500, 5600), szer: kw(p.szer, 300, 2800), cenaArkusza: kw(p.cenaArkusza, 0, 100_000) };
    if (!nazwa) return { cennik: null, blad: "Każda płyta potrzebuje nazwy." };
    if ([o.grubosc, o.dl, o.szer, o.cenaArkusza].some(Number.isNaN))
      return { cennik: null, blad: `„${nazwa}”: grubość 8–40 mm, arkusz 500–5600 × 300–2800 mm, cena 0–100 000 zł.` };
    plyty.push(o);
  }
  const pozycje = [];
  for (const p of f.pozycje) {
    const nazwa = p.nazwa.trim();
    const cena = p.jednostka === "proc" ? kw(p.cena, -50, 100) : kw(p.cena, -1_000_000, 1_000_000);
    if (!nazwa) return { cennik: null, blad: "Każda własna pozycja potrzebuje nazwy." };
    if (Number.isNaN(cena)) return { cennik: null, blad: `„${nazwa}”: ${p.jednostka === "proc" ? "procent od −50 do 100" : "kwota od −1 000 000 do 1 000 000 zł"}.` };
    pozycje.push({ id: p.id, nazwa, cena, jednostka: p.jednostka, ...(p.domyslna ? { domyslna: true } : {}) });
  }
  const domyslna = plyty.find((p) => p.id === f.plytaDomyslna) ?? plyty[0];
  return {
    cennik: { ...skalary, plytaM2: cenaPlytyM2(domyslna, odpad), plyty, plytaDomyslna: domyslna.id, odpadPlyty: odpad, pozycje },
    blad: "",
  };
}

export function CennikTab({ canEdit, onAuthError }: { canEdit: boolean; onAuthError: (e: unknown) => boolean }) {
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cennikApi
      .get()
      .then((c) => setForm(doFormularza(c)))
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);

  if (err && !form) return <p className="err">{err}</p>;
  if (!form) return <p className="lede">Wczytywanie…</p>;

  const { cennik: parsed, blad } = zFormularza(form);
  const odpad = Number.isFinite(num(form.odpad)) ? num(form.odpad) : 0;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed) return setErr(blad);
    setBusy(true);
    setErr("");
    try {
      const c = await cennikApi.save(parsed);
      setForm(doFormularza(c));
      toast("Zapisano cennik modułów", { desc: "Nowe ceny widać w ofertach i na Twojej stronie." });
    } catch (e2) {
      if (!onAuthError(e2)) setErr(errText(e2));
    } finally {
      setBusy(false);
    }
  };

  const zmienPlyte = (i: number, k: keyof PlytaForm, v: string) => setForm({ ...form, plyty: form.plyty.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const zmienPozycje = (i: number, zmiana: Partial<PozycjaForm>) => setForm({ ...form, pozycje: form.pozycje.map((p, j) => (j === i ? { ...p, ...zmiana } : p)) });

  return (
    <div className="set-grid">
      <section className="set-card">
        <h2>Cennik szafek na wymiar</h2>
        <p className="lede">
          Cena modułu liczy się z wymiarów: baza + płyta korpusu (m²) + front (m²) + metr bieżący szerokości. Ceny netto. Ten sam
          cennik działa w ofertach dla klientów i w podglądzie 3D na Twojej stronie. Gdy w kreatorze ustawisz wnętrze modułu,
          dochodzi płyta dodatkowych półek i przegród oraz szuflady i drążki z cen poniżej.
        </p>
        <form id="cennik-form" onSubmit={save} noValidate>
          {FIELDS.map((f) => (
            <div className="field" key={f.k}>
              <label htmlFor={`c-${f.k}`}>{f.label}</label>
              <input
                id={`c-${f.k}`}
                className="input"
                inputMode="decimal"
                disabled={!canEdit}
                value={form[f.k]}
                onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
              />
            </div>
          ))}
          {!canEdit ? <p className="faint">Cennik zmienia właściciel konta firmy.</p> : null}
          {err ? (
            <p className="err" role="alert">
              {err}
            </p>
          ) : null}
          {canEdit ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-ink wide" disabled={busy}>
                {busy ? "Zapisywanie…" : "Zapisz"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setForm({
                    ...form,
                    baza: String(DEFAULT_CENNIK.baza),
                    frontM2: String(DEFAULT_CENNIK.frontM2),
                    mb: String(DEFAULT_CENNIK.mb),
                    szuflada: String(DEFAULT_CENNIK.szuflada),
                    drazek: String(DEFAULT_CENNIK.drazek),
                  })
                }
              >
                Domyślne
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
        <section className="set-card" aria-labelledby="c-plyty-h">
          <h2 id="c-plyty-h">Płyty korpusów</h2>
          <p className="lede">
            Grubość, format arkusza i cena za arkusz – cena za m² liczy się sama (z odpadem przy rozkroju). W kreatorze wybierzesz płytę dla
            oferty (krok „Materiały”), domyślna liczy się w pozostałych ofertach i na Twojej stronie.
          </p>
          <div className="cn-tabela" aria-label="Płyty korpusów">
            <div className="cn-wiersz cn-naglowek" aria-hidden>
              <span>Domyślna</span>
              <span>Nazwa</span>
              <span>Grubość (mm)</span>
              <span>Arkusz (mm)</span>
              <span>Cena arkusza (zł)</span>
              <span>Za m²</span>
              <span className="sr-only">
                Usuń
              </span>
            </div>
            {form.plyty.map((p, i) => {
              const dl = num(p.dl);
              const sz = num(p.szer);
              const cena = num(p.cenaArkusza);
              const ok = [dl, sz, cena].every(Number.isFinite) && dl > 0 && sz > 0;
              return (
                <div className="cn-wiersz" key={p.id}>
                  <span>
                    <input
                      type="radio"
                      name="plyta-domyslna"
                      aria-label={`Domyślna: ${p.nazwa || `płyta ${i + 1}`}`}
                      checked={form.plytaDomyslna === p.id}
                      disabled={!canEdit}
                      onChange={() => setForm({ ...form, plytaDomyslna: p.id })}
                    />
                  </span>
                  <input className="input" aria-label={`Płyta ${i + 1}: nazwa`} value={p.nazwa} disabled={!canEdit} maxLength={80} onChange={(e) => zmienPlyte(i, "nazwa", e.target.value)} />
                  <input className="input" aria-label={`Płyta ${i + 1}: grubość mm`} inputMode="decimal" value={p.grubosc} disabled={!canEdit} onChange={(e) => zmienPlyte(i, "grubosc", e.target.value)} />
                  <span className="cn-format">
                    <input className="input" aria-label={`Płyta ${i + 1}: długość arkusza mm`} inputMode="numeric" value={p.dl} disabled={!canEdit} onChange={(e) => zmienPlyte(i, "dl", e.target.value)} />
                    ×
                    <input className="input" aria-label={`Płyta ${i + 1}: szerokość arkusza mm`} inputMode="numeric" value={p.szer} disabled={!canEdit} onChange={(e) => zmienPlyte(i, "szer", e.target.value)} />
                  </span>
                  <input className="input" aria-label={`Płyta ${i + 1}: cena za arkusz`} inputMode="decimal" value={p.cenaArkusza} disabled={!canEdit} onChange={(e) => zmienPlyte(i, "cenaArkusza", e.target.value)} />
                  <span className="mono cn-m2" title={ok ? `${m2(powierzchniaArkusza({ dl, szer: sz }))} w arkuszu` : undefined}>
                    {ok ? zl(cenaPlytyM2({ dl, szer: sz, cenaArkusza: cena }, odpad)) : "—"}
                  </span>
                  <span>
                    {canEdit && form.plyty.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-plain"
                        aria-label={`Usuń płytę ${p.nazwa || i + 1}`}
                        onClick={() => {
                          const plyty = form.plyty.filter((_, j) => j !== i);
                          setForm({ ...form, plyty, plytaDomyslna: form.plytaDomyslna === p.id ? plyty[0].id : form.plytaDomyslna });
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="cn-stopka">
            {canEdit ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={form.plyty.length >= MAX_PLYT}
                onClick={() =>
                  setForm({
                    ...form,
                    plyty: [...form.plyty, { id: noweId("p"), nazwa: "Płyta 25 mm", grubosc: "25", dl: String(FORMAT_STANDARD.dl), szer: String(FORMAT_STANDARD.szer), cenaArkusza: "" }],
                  })
                }
              >
                + Płyta
              </button>
            ) : null}
            <label className="cn-odpad">
              Odpad przy rozkroju (%)
              <input className="input" inputMode="decimal" value={form.odpad} disabled={!canEdit} onChange={(e) => setForm({ ...form, odpad: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="set-card" aria-labelledby="c-poz-h">
          <h2 id="c-poz-h">Własne pozycje w cenie</h2>
          <p className="lede">
            Transport, montaż za metr bieżący zabudowy, oświetlenie LED, rabat… W kreatorze dodasz je do oferty (krok „Materiały”) – doliczą się
            do ceny końcowej u Ciebie, w PDF i u klienta. „Zawsze” – pozycja wchodzi sama do każdej nowej oferty. Ujemna kwota albo procent to rabat.
          </p>
          {form.pozycje.length ? (
            <div className="cn-tabela cn-pozycje" aria-label="Własne pozycje">
              <div className="cn-wiersz cn-naglowek" aria-hidden>
                <span>Nazwa</span>
                <span>Kwota</span>
                <span>Za</span>
                <span>Zawsze</span>
                <span className="sr-only">
                  Usuń
                </span>
              </div>
              {form.pozycje.map((p, i) => (
                <div className="cn-wiersz" key={p.id}>
                  <input className="input" aria-label={`Pozycja ${i + 1}: nazwa`} value={p.nazwa} maxLength={80} disabled={!canEdit} onChange={(e) => zmienPozycje(i, { nazwa: e.target.value })} />
                  <input className="input" aria-label={`Pozycja ${i + 1}: kwota`} inputMode="decimal" value={p.cena} disabled={!canEdit} onChange={(e) => zmienPozycje(i, { cena: e.target.value })} />
                  <select className="input" aria-label={`Pozycja ${i + 1}: jednostka`} value={p.jednostka} disabled={!canEdit} onChange={(e) => zmienPozycje(i, { jednostka: e.target.value as JednostkaPozycji })}>
                    {JEDNOSTKI.map((j) => (
                      <option key={j} value={j}>
                        {j === "kpl" ? "ryczałt (kpl.)" : j === "szt" ? "sztukę" : j === "mb" ? "metr bieżący" : "% ceny mebli"}
                      </option>
                    ))}
                  </select>
                  <span>
                    <input type="checkbox" aria-label={`Pozycja ${i + 1}: dodawaj do każdej oferty`} checked={p.domyslna} disabled={!canEdit} onChange={(e) => zmienPozycje(i, { domyslna: e.target.checked })} />
                  </span>
                  <span>
                    {canEdit ? (
                      <button type="button" className="btn btn-plain" aria-label={`Usuń pozycję ${p.nazwa || i + 1}`} onClick={() => setForm({ ...form, pozycje: form.pozycje.filter((_, j) => j !== i) })}>
                        ×
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="faint">Brak własnych pozycji.</p>
          )}
          {canEdit ? (
            <div className="cn-stopka">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={form.pozycje.length >= MAX_POZYCJI}
                onClick={() => setForm({ ...form, pozycje: [...form.pozycje, { id: noweId("c"), nazwa: "", cena: "", jednostka: "kpl", domyslna: false }] })}
              >
                + Własna pozycja
              </button>
              <button type="submit" form="cennik-form" className="btn btn-ink" disabled={busy}>
                {busy ? "Zapisywanie…" : "Zapisz cennik"}
              </button>
            </div>
          ) : null}
          {err ? (
            <p className="err" role="alert">
              {err}
            </p>
          ) : null}
        </section>

        <section className="set-card">
          <h2>Przykładowe ceny</h2>
          <p className="lede">
            Szafki z płyty domyślnej{parsed?.plyty?.length ? ` (${parsed.plyty.find((p) => p.id === parsed.plytaDomyslna)?.nazwa})` : ""} – boki, wieniec, półka, listwy – z jednym frontem.
          </p>
          <table className="cennik-tab" style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Wymiar (cm)</th>
                <th>Płyta</th>
                <th>Front</th>
                <th style={{ textAlign: "right" }}>Cena</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLES.map((s) => {
                const p = modulPowierzchnie(s);
                return (
                  <tr key={`${s.w}-${s.h}`} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                    <td style={{ padding: "6px 0" }}>
                      {s.w} × {s.h} × {s.d}
                    </td>
                    <td>{m2(p.plyta)}</td>
                    <td>{m2(p.front)}</td>
                    <td style={{ textAlign: "right" }}>{parsed ? formatPln(modulCena(s, parsed)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {parsed?.pozycje?.length ? (
            <p className="faint" style={{ marginTop: 8 }}>
              Własne pozycje: {parsed.pozycje.map((p) => `${p.nazwa} ${p.jednostka === "proc" ? `${String(p.cena).replace(".", ",")}%` : `${formatPln(p.cena)}/${JEDNOSTKA_LABEL[p.jednostka]}`}`).join(" · ")}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
