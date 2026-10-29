"use client";

/*
 * Ustawienia → Cennik modułów: ceny szafek na wymiar (moduł parametryczny).
 * Cena modułu = baza + płyta [m²] × cena płyty + front [m²] × cena frontu + szerokość [m] × cena za mb.
 * Ten sam wzór liczy serwer dla oferty i widżetu na stronie (src/lib/modul.ts).
 */
import { useEffect, useState, type FormEvent } from "react";
import { DEFAULT_CENNIK, modulCena, modulPowierzchnie, type ModulCennik } from "@/lib/modul";
import { formatPln } from "../pricing";
import { cennikApi } from "./offerApi";
import { toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
const FIELDS: { k: keyof ModulCennik; label: string }[] = [
  { k: "baza", label: "Cena bazowa za moduł (zł)" },
  { k: "plytaM2", label: "Płyta korpusu 18 mm (zł/m²)" },
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

export function CennikTab({ canEdit, onAuthError }: { canEdit: boolean; onAuthError: (e: unknown) => boolean }) {
  const [form, setForm] = useState<Record<keyof ModulCennik, string> | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cennikApi
      .get()
      .then((c) =>
        setForm({
          baza: String(c.baza),
          plytaM2: String(c.plytaM2),
          frontM2: String(c.frontM2),
          mb: String(c.mb),
          szuflada: String(c.szuflada ?? DEFAULT_CENNIK.szuflada),
          drazek: String(c.drazek ?? DEFAULT_CENNIK.drazek),
        }),
      )
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);

  if (err && !form) return <p className="err">{err}</p>;
  if (!form) return <p className="lede">Wczytywanie…</p>;

  const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));
  const parsed: ModulCennik = {
    baza: num(form.baza),
    plytaM2: num(form.plytaM2),
    frontM2: num(form.frontM2),
    mb: num(form.mb),
    szuflada: num(form.szuflada),
    drazek: num(form.drazek),
  };
  const valid = Object.values(parsed).every((n) => Number.isFinite(n) && n >= 0 && n <= 1_000_000);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return setErr("Wpisz kwoty od 0 do 1 000 000 zł.");
    setBusy(true);
    setErr("");
    try {
      await cennikApi.save(parsed);
      toast("Zapisano cennik modułów", { desc: "Nowe ceny widać w ofertach i na Twojej stronie." });
    } catch (e2) {
      if (!onAuthError(e2)) setErr(errText(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="set-grid">
      <section className="set-card">
        <h2>Cennik szafek na wymiar</h2>
        <p className="lede">
          Cena modułu liczy się z wymiarów: baza + płyta korpusu (m²) + front (m²) + metr bieżący szerokości. Ceny netto. Ten sam
          cennik działa w ofertach dla klientów i w podglądzie 3D na Twojej stronie. Gdy w kreatorze ustawisz wnętrze modułu,
          dochodzi płyta dodatkowych półek i przegród oraz szuflady i drążki z cen poniżej.
        </p>
        <form onSubmit={save} noValidate>
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
                    baza: String(DEFAULT_CENNIK.baza),
                    plytaM2: String(DEFAULT_CENNIK.plytaM2),
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
      <section className="set-card">
        <h2>Przykładowe ceny</h2>
        <p className="lede">Szafki z płyty 18 mm (boki, wieniec, półka, listwy) z jednym frontem.</p>
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
                  <td style={{ textAlign: "right" }}>{valid ? formatPln(modulCena(s, parsed)) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
