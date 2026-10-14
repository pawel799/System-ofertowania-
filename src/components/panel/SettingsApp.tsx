"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FINISH_LABEL, FINISHES, type Finish, type Palette } from "../palettes";
import { formatPln } from "../pricing";
import { RAL_CLASSIC, RAL_GROUP_LABEL, ralByCode, type RalGroup } from "../ral";
import { ApiError, assetsApi, getToken, setToken, type DomainView, type ModelMeta } from "./offerApi";
import { TokenDialog } from "./PanelGate";
import { HoldButton, Seg, Toaster, Tooltips, toast } from "./ui";

/*
 * Ustawienia panelu (/panel/ustawienia): modele 3D (wgrywanie + oznaczanie elementów),
 * pakiety kolorów RAL i własna domena linków. Ten sam wygląd co panel ofert (panel.css).
 */

const ModelTagger = dynamic(() => import("./ModelTagger"), {
  ssr: false,
  loading: () => <p className="lede">Wczytywanie edytora…</p>,
});

type Tab = "models" | "palettes" | "domain";
const TABS: { value: Tab; label: string }[] = [
  { value: "models", label: "Modele 3D" },
  { value: "palettes", label: "Kolory RAL" },
  { value: "domain", label: "Domena" },
];

const errText = (e: unknown) => (e instanceof Error ? e.message : "Coś poszło nie tak.");
const sizeText = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} kB`;
const dateText = (iso: string) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>("models");
  const [auth, setAuth] = useState<{ need: boolean; error: string }>({ need: false, error: "" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "palettes" || t === "domain" || t === "models") setTab(t);
    if (!getToken()) setAuth({ need: true, error: "" });
    setReady(true);
  }, []);

  const onAuthError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      setAuth({ need: true, error: "Zły token. Wpisz go jeszcze raz." });
      return true;
    }
    return false;
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="pnl set">
      <header className="top">
        <a className="btn btn-plain" href="/panel" aria-label="Wróć do ofert">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <div className="logo">
          <span className="logo-mark" aria-hidden>
            SK
          </span>
          Studio Kuchnie
        </div>
        <div className="crumb">
          <span>/</span>
          <b>Ustawienia</b>
        </div>
        <span className="grow" />
        {ready && !auth.need ? (
          <button
            type="button"
            className="btn btn-plain"
            data-tip="Usuwa token z tej przeglądarki (np. na cudzym komputerze)"
            onClick={() => {
              setToken("");
              setAuth({ need: true, error: "" });
              toast("Wylogowano", { desc: "Token panelu usunięty z tej przeglądarki." });
            }}
          >
            Wyloguj
          </button>
        ) : null}
        <a className="btn btn-ghost" href="/panel">
          Oferty
        </a>
      </header>

      <main className="surface set-main">
        <Seg label="Ustawienia" value={tab} onChange={pick} options={TABS} />
        {ready && !auth.need ? (
          tab === "models" ? (
            <ModelsTab onAuthError={onAuthError} />
          ) : tab === "palettes" ? (
            <PalettesTab onAuthError={onAuthError} />
          ) : (
            <DomainTab onAuthError={onAuthError} />
          )
        ) : null}
      </main>

      {auth.need ? (
        <TokenDialog
          error={auth.error}
          onSubmit={(t) => {
            setToken(t.trim());
            setAuth({ need: false, error: "" });
          }}
        />
      ) : null}
      <Tooltips />
      <Toaster />
    </div>
  );
}

/* ---------- Modele 3D ---------- */

type Upload =
  | { k: "idle" }
  | { k: "prepare"; step: string }
  | { k: "send"; part: number; before: number; after: number }
  | { k: "error"; message: string };

function ModelsTab({ onAuthError }: { onAuthError: (e: unknown) => boolean }) {
  const [models, setModels] = useState<ModelMeta[] | null>(null);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [upload, setUpload] = useState<Upload>({ k: "idle" });
  const [editing, setEditing] = useState<ModelMeta | null>(null);
  // Zmiana klucza czyści pole pliku po udanym wgraniu.
  const [fileKey, setFileKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setModels(await assetsApi.models());
      setError("");
    } catch (e) {
      if (!onAuthError(e)) setError(errText(e));
    }
  }, [onAuthError]);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = (list: FileList | null) => {
    const arr = list ? Array.from(list) : [];
    setFiles(arr);
    setUpload({ k: "idle" });
    const main = arr.find((f) => /\.(glb|obj)$/i.test(f.name));
    if (main && !name) setName(main.name.replace(/\.(glb|obj)$/i, "").replace(/[_-]+/g, " ").trim());
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!files.length) return setUpload({ k: "error", message: "Wybierz plik modelu (.glb albo .obj)." });
    if (!name.trim()) return setUpload({ k: "error", message: "Wpisz nazwę modelu." });
    try {
      setUpload({ k: "prepare", step: "Wczytywanie narzędzi…" });
      const { prepareModel, MAX_UPLOAD_BYTES, formatBytes } = await import("./modelOptimize");
      const prepared = await prepareModel(files, (step) => setUpload({ k: "prepare", step }));
      if (prepared.after > MAX_UPLOAD_BYTES) {
        throw new Error(`Po optymalizacji model ma ${formatBytes(prepared.after)}, a limit to ${formatBytes(MAX_UPLOAD_BYTES)}. Uprość model albo tekstury.`);
      }
      setUpload({ k: "send", part: 0, before: prepared.before, after: prepared.after });
      const model = await assetsApi.uploadModel(prepared.glb, name.trim(), (part) =>
        setUpload({ k: "send", part, before: prepared.before, after: prepared.after }),
      );
      setModels((list) => [model, ...(list ?? [])]);
      setFiles([]);
      setName("");
      setUpload({ k: "idle" });
      setFileKey((k) => k + 1);
      toast("Wgrano model", {
        desc: `${model.name} · ${formatBytes(prepared.before)} → ${formatBytes(prepared.after)}${prepared.notes.length ? ` · ${prepared.notes.join(" ")}` : ""}`,
      });
      setEditing(model);
    } catch (err) {
      if (!onAuthError(err)) setUpload({ k: "error", message: errText(err) });
    }
  };

  const remove = async (m: ModelMeta) => {
    try {
      await assetsApi.removeModel(m.id);
      setModels((list) => (list ?? []).filter((x) => x.id !== m.id));
      toast("Usunięto model", { desc: m.name });
    } catch (e) {
      if (!onAuthError(e)) toast("Nie udało się usunąć", { type: "err", desc: errText(e) });
    }
  };

  if (editing) {
    return (
      <ModelTagger
        key={editing.id}
        model={editing}
        onBack={() => setEditing(null)}
        onSaved={(m) => {
          setModels((list) => (list ?? []).map((x) => (x.id === m.id ? m : x)));
          setEditing(m);
        }}
      />
    );
  }

  const busy = upload.k === "prepare" || upload.k === "send";
  return (
    <div className="set-grid">
      <section className="set-card">
        <h2>Wgraj model</h2>
        <p className="lede">
          Plik <b>.glb</b> (np. eksport z Winner Flex) albo <b>.obj</b> z PRO100 (możesz dodać .mtl i tekstury). Przed wysłaniem
          model jest kompresowany w przeglądarce. Limit po kompresji: 40 MB.
        </p>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="m-file">Plik modelu</label>
            <input
              key={fileKey}
              id="m-file"
              className="input file-input"
              type="file"
              multiple
              accept=".glb,.obj,.mtl,.png,.jpg,.jpeg"
              disabled={busy}
              onChange={(e) => choose(e.target.files)}
            />
          </div>
          <div className="field">
            <label htmlFor="m-name">Nazwa modelu</label>
            <input id="m-name" className="input" autoComplete="off" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
          </div>
          {upload.k === "prepare" ? (
            <p className="nip-msg" role="status">
              <span className="spin" aria-hidden />
              {upload.step}
            </p>
          ) : upload.k === "send" ? (
            <div role="status">
              <p className="nip-msg">Wysyłanie… {Math.round(upload.part * 100)}%</p>
              <div className="bar">
                <i style={{ transform: `scaleX(${upload.part})` }} />
              </div>
            </div>
          ) : upload.k === "error" ? (
            <p className="err">{upload.message}</p>
          ) : null}
          <button type="submit" className="btn btn-ink wide" disabled={busy}>
            {busy ? "Przygotowywanie…" : "Wgraj model"}
          </button>
        </form>
      </section>

      <section className="set-card">
        <h2>Twoje modele</h2>
        <p className="lede">Po wgraniu oznacz, które elementy to fronty, blat i uchwyty – to one zmieniają kolor w ofercie.</p>
        {error ? <p className="err">{error}</p> : null}
        {models === null && !error ? <p className="lede">Wczytywanie…</p> : null}
        {models && !models.length ? <p className="empty">Nie ma jeszcze modeli. Wgraj pierwszy obok.</p> : null}
        <ul className="set-list">
          {(models ?? []).map((m) => {
            const tagged = Object.keys(m.tags).length;
            return (
              <li key={m.id} className="set-row">
                <div className="set-row-main">
                  <b>{m.name}</b>
                  <span className="faint">
                    {sizeText(m.size)} · {dateText(m.createdAt)} ·{" "}
                    {tagged ? `${tagged} elementów z rolą` : "bez oznaczeń"}
                  </span>
                </div>
                <div className="set-row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(m)}>
                    Oznacz elementy
                  </button>
                  <HoldButton holdLabel="Przytrzymaj…" ariaLabel={`Przytrzymaj, aby usunąć model ${m.name}`} onConfirm={() => void remove(m)}>
                    Usuń
                  </HoldButton>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Pakiety RAL ---------- */

type Draft = { id?: string; name: string; finish: Finish; delta: string; colors: string[] };
const EMPTY_DRAFT: Draft = { name: "", finish: "satyna", delta: "0", colors: [] };
const GROUPS = Object.keys(RAL_GROUP_LABEL) as RalGroup[];

function PalettesTab({ onAuthError }: { onAuthError: (e: unknown) => boolean }) {
  const [palettes, setPalettes] = useState<Palette[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    assetsApi
      .palettes()
      .then(setPalettes)
      .catch((e) => {
        if (!onAuthError(e)) setError(errText(e));
      });
  }, [onAuthError]);

  const remove = async (p: Palette) => {
    try {
      await assetsApi.removePalette(p.id);
      setPalettes((list) => (list ?? []).filter((x) => x.id !== p.id));
      toast("Usunięto pakiet", { desc: p.name });
    } catch (e) {
      if (!onAuthError(e)) toast("Nie udało się usunąć", { type: "err", desc: errText(e) });
    }
  };

  if (draft) {
    return (
      <PaletteEditor
        draft={draft}
        onCancel={() => setDraft(null)}
        onSaved={(p) => {
          setPalettes((list) => {
            const l = list ?? [];
            return l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p];
          });
          setDraft(null);
        }}
        onAuthError={onAuthError}
      />
    );
  }

  return (
    <section className="set-card set-card-wide">
      <div className="set-card-head">
        <div>
          <h2>Pakiety kolorów RAL</h2>
          <p className="lede">
            Pakiet to zestaw kolorów frontów z jednym wykończeniem i dopłatą. Klient wybiera kolor z pakietów na stronie oferty.
          </p>
        </div>
        <button type="button" className="btn btn-ink" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
          Nowy pakiet
        </button>
      </div>
      {error ? <p className="err">{error}</p> : null}
      {palettes === null && !error ? <p className="lede">Wczytywanie…</p> : null}
      {palettes && !palettes.length ? <p className="empty">Nie ma jeszcze pakietów. Dodaj pierwszy, np. „Lakier mat – biele i szarości”.</p> : null}
      <ul className="set-list">
        {(palettes ?? []).map((p) => (
          <li key={p.id} className="set-row">
            <div className="set-row-main">
              <b>{p.name}</b>
              <span className="faint">
                {FINISH_LABEL[p.finish]} · {p.colors.length} kolorów · {p.delta ? `dopłata ${formatPln(p.delta)}` : "w cenie"}
              </span>
              <span className="ral-dots" aria-hidden>
                {p.colors.slice(0, 18).map((c) => (
                  <i key={c} style={{ background: ralByCode(c)?.hex }} title={`RAL ${c}`} />
                ))}
                {p.colors.length > 18 ? <em className="faint">+{p.colors.length - 18}</em> : null}
              </span>
            </div>
            <div className="set-row-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDraft({ id: p.id, name: p.name, finish: p.finish, delta: String(p.delta), colors: p.colors })}
              >
                Edytuj
              </button>
              <HoldButton holdLabel="Przytrzymaj…" ariaLabel={`Przytrzymaj, aby usunąć pakiet ${p.name}`} onConfirm={() => void remove(p)}>
                Usuń
              </HoldButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaletteEditor({
  draft: initial,
  onCancel,
  onSaved,
  onAuthError,
}: {
  draft: Draft;
  onCancel: () => void;
  onSaved: (p: Palette) => void;
  onAuthError: (e: unknown) => boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<RalGroup | "all">("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^ral\s*/, "");
    return RAL_CLASSIC.filter(
      (c) => (group === "all" || c.group === group) && (!q || c.code.includes(q) || c.name.toLowerCase().includes(q)),
    );
  }, [query, group]);

  const toggle = (code: string) =>
    setDraft((d) => ({ ...d, colors: d.colors.includes(code) ? d.colors.filter((c) => c !== code) : [...d.colors, code] }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const delta = Number(draft.delta.replace(/\s/g, "").replace(",", "."));
    if (!draft.name.trim()) return setError("Wpisz nazwę pakietu.");
    if (!draft.colors.length) return setError("Wybierz co najmniej jeden kolor.");
    if (!Number.isInteger(delta)) return setError("Dopłata musi być liczbą całkowitą (zł).");
    setSaving(true);
    try {
      const body = { name: draft.name.trim(), finish: draft.finish, delta, colors: draft.colors };
      const saved = draft.id ? await assetsApi.updatePalette({ id: draft.id, ...body }) : await assetsApi.createPalette(body);
      toast(draft.id ? "Zapisano pakiet" : "Dodano pakiet", { desc: `${saved.name} · ${saved.colors.length} kolorów` });
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
        <h2>{draft.id ? "Edytuj pakiet" : "Nowy pakiet RAL"}</h2>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Anuluj
          </button>
          <button type="submit" className="btn btn-ink" disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz pakiet"}
          </button>
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="p-name">Nazwa pakietu</label>
          <input
            id="p-name"
            className="input"
            autoComplete="off"
            placeholder="Np. Lakier mat – biele i szarości"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="p-delta">Dopłata za front (zł netto)</label>
          <input id="p-delta" className="input" inputMode="numeric" value={draft.delta} onChange={(e) => setDraft({ ...draft, delta: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <span className="lab">Wykończenie</span>
        <Seg
          label="Wykończenie"
          value={draft.finish}
          onChange={(f) => setDraft({ ...draft, finish: f })}
          options={FINISHES.map((f) => ({ value: f, label: FINISH_LABEL[f] }))}
        />
      </div>

      <div className="field">
        <span className="lab">
          Wybrane kolory <span className="faint">({draft.colors.length})</span>
        </span>
        {draft.colors.length ? (
          <ul className="ral-chips">
            {draft.colors.map((code) => {
              const c = ralByCode(code);
              return (
                <li key={code}>
                  <button type="button" onClick={() => toggle(code)} aria-label={`Usuń RAL ${code}`}>
                    <i style={{ background: c?.hex }} />
                    RAL {code} {c?.name}
                    <span aria-hidden>×</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="lede">Kliknij kolory poniżej, żeby dodać je do pakietu.</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="p-search">Paleta RAL Classic</label>
        <label className="search">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input id="p-search" type="search" placeholder="Kod albo nazwa, np. 9010 albo antracyt" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <Seg
          label="Grupa kolorów"
          value={group}
          onChange={setGroup}
          options={[{ value: "all" as const, label: "Wszystkie" }, ...GROUPS.map((g) => ({ value: g, label: RAL_GROUP_LABEL[g] }))]}
        />
        <div className="ral-grid" role="group" aria-label="Kolory RAL">
          {visible.map((c) => {
            const on = draft.colors.includes(c.code);
            return (
              <button key={c.code} type="button" className="ral" aria-pressed={on} onClick={() => toggle(c.code)} data-tip={`RAL ${c.code} ${c.name}`}>
                <i style={{ background: c.hex }} />
                <span className="mono">{c.code}</span>
                <span className="ral-name">{c.name}</span>
              </button>
            );
          })}
          {!visible.length ? <p className="empty">Nie ma takiego koloru w RAL Classic.</p> : null}
        </div>
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          Kolory na ekranie są poglądowe – prawdziwy odcień sprawdza się na wzorniku RAL.
        </p>
      </div>
      {error ? <p className="err">{error}</p> : null}
    </form>
  );
}

/* ---------- Własna domena ---------- */

function DomainTab({ onAuthError }: { onAuthError: (e: unknown) => boolean }) {
  const [view, setView] = useState<DomainView | null>(null);
  const [host, setHost] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    assetsApi
      .domain()
      .then(setView)
      .catch((e) => {
        if (!onAuthError(e)) setError(errText(e));
      });
  }, [onAuthError]);

  const run = async (fn: () => Promise<DomainView | void>, done?: string) => {
    setBusy(true);
    setError("");
    try {
      const next = await fn();
      setView(next ?? (await assetsApi.domain()));
      if (done) toast(done);
    } catch (e) {
      if (!onAuthError(e)) setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const d = view?.domain ?? null;
  const statusText = !d
    ? ""
    : view?.active
      ? "Aktywna"
      : d.status === "active"
        ? "Nazwa potwierdzona, czekamy na certyfikat SSL"
        : "Czeka na rekord CNAME";

  return (
    <section className="set-card set-card-wide">
      <h2>Własna domena linków</h2>
      <p className="lede">
        Linki do ofert mogą mieć adres Twojej firmy, np. <span className="mono">oferty.twojafirma.pl/oferta/…</span> zamiast adresu systemu.
      </p>
      {error ? <p className="err">{error}</p> : null}
      {view === null && !error ? <p className="lede">Wczytywanie…</p> : null}

      {view && !view.configured ? (
        <div className="callout callout-info">
          <div className="callout-h">Jeszcze niewłączone na serwerze</div>
          <p>
            Administrator musi ustawić w Cloudflare zmienne CF_API_TOKEN, CF_ZONE_ID i CF_CNAME_TARGET (instrukcja w
            docs/modele-ral-domena.md). Potem dodasz tu domenę.
          </p>
        </div>
      ) : null}

      {view?.configured && !d ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => assetsApi.setDomain(host), "Dodano domenę");
          }}
          noValidate
        >
          <div className="field">
            <label htmlFor="d-host">Domena (subdomena)</label>
            <div className="nip-row">
              <input
                id="d-host"
                className="input mono-input"
                placeholder="oferty.twojafirma.pl"
                autoComplete="off"
                autoCapitalize="none"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
              <button type="submit" className="btn btn-ink" disabled={busy || !host.trim()}>
                {busy ? "Dodawanie…" : "Dodaj domenę"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {view?.configured && d ? (
        <>
          <dl className="specs">
            <div>
              <dt>Domena</dt>
              <dd className="mono">{d.hostname}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`badge ${view.active ? "badge-ok" : "badge-wait"}`}>{statusText}</span>
              </dd>
            </div>
            <div>
              <dt>Sprawdzono</dt>
              <dd>{new Date(d.checkedAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}</dd>
            </div>
          </dl>

          {!view.active ? (
            <div className="callout callout-info">
              <div className="callout-h">Ustaw rekord u dostawcy domeny</div>
              <p>Dodaj w DNS swojej domeny rekord CNAME (zwykle działa po kilku–kilkunastu minutach):</p>
              <table className="dns">
                <thead>
                  <tr>
                    <th>Typ</th>
                    <th>Nazwa</th>
                    <th>Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono">CNAME</td>
                    <td className="mono">{d.hostname}</td>
                    <td className="mono">{view.target}</td>
                  </tr>
                </tbody>
              </table>
              {d.errors.length ? (
                <p className="faint" style={{ fontSize: 12 }}>
                  Cloudflare: {d.errors.join(" · ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="lede">Nowe linki w panelu mają już adres https://{d.hostname}/oferta/…</p>
          )}

          <div className="actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run(() => assetsApi.refreshDomain())}>
              {busy ? "Sprawdzanie…" : "Sprawdź status"}
            </button>
            <HoldButton
              holdLabel="Przytrzymaj…"
              ariaLabel={`Przytrzymaj, aby usunąć domenę ${d.hostname}`}
              onConfirm={() => void run(() => assetsApi.removeDomain(), "Usunięto domenę")}
            >
              Usuń domenę
            </HoldButton>
          </div>
        </>
      ) : null}
    </section>
  );
}
