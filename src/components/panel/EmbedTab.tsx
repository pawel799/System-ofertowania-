"use client";

/*
 * Ustawienia → Na stronie: kuchnia 3D firmy do osadzenia na jej stronie internetowej.
 * Firma wybiera model, cenę bazową i materiały startowe, włącza widżet i kopiuje kod <iframe>.
 * Klient na stronie firmy obraca kuchnię, zmienia materiały i wysyła „Poproś o wycenę” –
 * zgłoszenie trafia do Zgłoszeń w panelu.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { opcjeMaterialu, type KatalogPozycja } from "../katalogFirmy";
import type { Palette } from "../palettes";
import { assetsApi, embedApi, type EmbedSettings, type EmbedView, type ModelMeta } from "./offerApi";
import { CopyButton, toast } from "./ui";

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");

export function EmbedTab({ onAuthError }: { onAuthError: (e: unknown) => boolean }) {
  const [view, setView] = useState<EmbedView | null>(null);
  const [draft, setDraft] = useState<EmbedSettings | null>(null);
  const [base, setBase] = useState("");
  const [models, setModels] = useState<ModelMeta[]>([]);
  const [katalog, setKatalog] = useState<KatalogPozycja[]>([]);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(0);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    Promise.all([
      embedApi.get(),
      assetsApi.models().catch(() => [] as ModelMeta[]),
      assetsApi.katalog().catch(() => [] as KatalogPozycja[]),
      assetsApi.palettes().catch(() => [] as Palette[]),
    ])
      .then(([v, m, k, p]) => {
        setKatalog(k);
        setPalettes(p);
        setView(v);
        setDraft(v.embed);
        setBase(String(v.embed.base));
        setModels(m);
      })
      .catch((e) => {
        if (!onAuthError(e)) setErr(errText(e));
      });
  }, [onAuthError]);

  const src = view ? `${origin}/osadz?f=${encodeURIComponent(view.firmId)}` : "";
  const code = useMemo(
    () =>
      src
        ? `<iframe src="${src}" title="Kuchnia 3D" style="width:100%;height:640px;border:0;border-radius:12px" loading="lazy" allow="fullscreen"></iframe>`
        : "",
    [src],
  );

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const n = Number(base.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return setErr("Cena bazowa musi być liczbą od 1 do 10 000 000 zł.");
    setBusy(true);
    setErr("");
    try {
      const v = await embedApi.save({ ...draft, base: Math.round(n) });
      setView(v);
      setDraft(v.embed);
      setPreview((x) => x + 1);
      toast(v.embed.enabled ? "Zapisano – kuchnia 3D działa na Twojej stronie" : "Zapisano – widżet wyłączony");
    } catch (e2) {
      if (!onAuthError(e2)) setErr(errText(e2));
    } finally {
      setBusy(false);
    }
  };

  if (err && !view) return <p className="err">{err}</p>;
  if (!view || !draft) return <p className="lede">Wczytywanie…</p>;
  const set = <K extends keyof EmbedSettings>(k: K, v: EmbedSettings[K]) => setDraft({ ...draft, [k]: v });

  return (
    <div className="set-grid">
      <section className="set-card">
        <h2>Meble 3D na Twojej stronie</h2>
        <p className="lede">
          Wstaw kuchnię do obracania na swoją stronę internetową. Klient zmienia fronty, blat i uchwyty, widzi cenę i prosi o wycenę – zgłoszenie
          trafia do Zgłoszeń w panelu.
        </p>
        {!view.allowed ? (
          <p className="lede" role="status">
            Ta funkcja jest w planie <b>Pracownia</b> i wyższym. <a href="/panel/ustawienia?tab=plan">Zmień plan</a>
          </p>
        ) : null}
        <form onSubmit={save} noValidate>
          <div className="toggles">
            <label className="tg" htmlFor="e-on">
              Widżet włączony
              <input id="e-on" type="checkbox" className="switch" checked={draft.enabled} disabled={!view.allowed} onChange={(e) => set("enabled", e.target.checked)} />
            </label>
            <label className="tg" htmlFor="e-price">
              Pokaż cenę
              <input id="e-price" type="checkbox" className="switch" checked={draft.showPrice} onChange={(e) => set("showPrice", e.target.checked)} />
            </label>
            <label className="tg" htmlFor="e-moduly" data-tip="Klient ustawia wymiary szafki, cena z Ustawienia → Cennik modułów">
              Szafka na wymiar
              <input id="e-moduly" type="checkbox" className="switch" checked={draft.moduly !== false} onChange={(e) => set("moduly", e.target.checked)} />
            </label>
          </div>
          <div className="field">
            <label htmlFor="e-title">Tytuł nad kuchnią</label>
            <input id="e-title" className="input" maxLength={120} value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="e-model">Model 3D</label>
            <select id="e-model" className="input" value={draft.modelId ?? ""} onChange={(e) => set("modelId", e.target.value || null)}>
              <option value="">Kuchnia demo</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="e-base">Cena bazowa zabudowy (zł netto)</label>
            <input id="e-base" className="input" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="e-front">Materiały na start</label>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
              <select id="e-front" className="input" aria-label="Fronty na start" value={draft.front} onChange={(e) => set("front", e.target.value)}>
                {opcjeMaterialu("front", { katalog, palettes }, draft.front).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="Blat na start" value={draft.countertop} onChange={(e) => set("countertop", e.target.value)}>
                {opcjeMaterialu("countertop", { katalog, palettes }, draft.countertop).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select className="input" aria-label="Okucia na start" value={draft.hardware} onChange={(e) => set("hardware", e.target.value)}>
                {opcjeMaterialu("hardware", { katalog, palettes }, draft.hardware).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {err ? (
            <p className="err" role="alert">
              {err}
            </p>
          ) : null}
          <button type="submit" className="btn btn-ink wide" disabled={busy}>
            {busy ? "Zapisywanie…" : "Zapisz"}
          </button>
        </form>
      </section>

      <section className="set-card">
        <h2>Kod do wklejenia</h2>
        <p className="lede">Wklej go na swojej stronie tam, gdzie ma być kuchnia (WordPress: blok „Własny HTML”, Wix: „Osadź kod”).</p>
        <div className="field">
          <textarea className="input mono-input" readOnly rows={4} style={{ height: "auto", fontSize: 12 }} value={code} aria-label="Kod osadzenia" onFocus={(e) => e.target.select()} />
        </div>
        <CopyButton text={code} label="Kopiuj kod" onFallback={() => toast("Zaznacz i skopiuj kod ręcznie", { type: "info" })} />
        {view.embed.enabled && view.allowed ? (
          <div className="field" style={{ marginTop: 16 }}>
            <span className="lab">Podgląd</span>
            <iframe
              key={preview}
              src={src}
              title="Podgląd kuchni 3D"
              style={{ width: "100%", height: 480, border: 0, borderRadius: 12, marginTop: 6, background: "#0c0b0a" }}
              loading="lazy"
            />
          </div>
        ) : (
          <p className="faint" style={{ fontSize: 12.5 }}>
            Widżet jest wyłączony – na Twojej stronie pokaże się napis „Ta kuchnia 3D nie jest teraz dostępna”.
          </p>
        )}
      </section>
    </div>
  );
}
