"use client";

/*
 * Produkcja: formatki do cięcia, okleina, okucia, blaty i rozkrój płyt.
 * Źródło: projekt z kreatora, lista wklejona z innego programu (KD Max, PRO100, Excel) albo model 3D (OBJ z PRO100, 3DS, GLB).
 * Wszystko liczy się w przeglądarce. Wydruk / PDF w nowym oknie, CSV dla hurtowni albo piły.
 */
import { useEffect, useMemo, useState } from "react";
import type { PlanKuchni } from "@/lib/kuchnia";
import { Seg, toast } from "../panel/ui";
import { oknoPdf, wpiszPdf } from "../panel/ofertaPdf";
import { blatyNaPlyty, formatkiProjektu, okleinaMb, podsumowanie, USTAWIENIA_DOMYSLNE, type UstawieniaFormatek, type ZrodloMaterialow } from "./formatki";
import { rozkroj, ROZKROJ_DOMYSLNY, type UstawieniaRozkroju, type WynikRozkroju } from "./rozkroj";
import { importujListe, type WynikImportu } from "./importListy";
import { csvFormatek, nazwaZGruboscia, numeruj, okleinaTekst, produkcjaDokument, svgArkusza, type DaneProdukcji, type MetaProdukcji } from "./dokument";

type Zrodlo = "projekt" | "lista" | "model";
type Ustawienia = UstawieniaFormatek & UstawieniaRozkroju;

const KLUCZ = "oprzut-produkcja-v1";
const DOMYSLNE: Ustawienia = { ...USTAWIENIA_DOMYSLNE, ...ROZKROJ_DOMYSLNY };

function wczytajUstawienia(): Ustawienia {
  try {
    const z = JSON.parse(localStorage.getItem(KLUCZ) ?? "null") as Partial<Ustawienia> | null;
    if (!z) return DOMYSLNE;
    const num = (v: unknown, d: number, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
    return {
      szczelina: num(z.szczelina, DOMYSLNE.szczelina, 0, 10),
      szuflady: z.szuflady === "systemowe" ? "systemowe" : "plyta",
      plecy: z.plecy === "brak" ? "brak" : "hdf",
      nawisBlatu: num(z.nawisBlatu, DOMYSLNE.nawisBlatu, 0, 100),
      arkusz: { dl: num(z.arkusz?.dl, 2800, 500, 6000), szer: num(z.arkusz?.szer, 2070, 300, 3000) },
      rzaz: num(z.rzaz, 4, 0, 10),
      obrzeze: num(z.obrzeze, 10, 0, 50),
    };
  } catch {
    return DOMYSLNE;
  }
}

const pl = (n: number, d = 1) => n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });

const PRZYKLAD = `Nazwa;Materiał;Długość;Szerokość;Ilość;Okleina
Bok;Biały 18 mm;720;560;2;D1
Wieniec;Biały 18 mm;564;560;2;D1
Front;Dąb Halifax 18 mm;717;597;1;dookoła`;

function Liczba({ id, label, value, onChange, min, max, jedn = "mm" }: { id: string; label: string; value: number; onChange: (v: number) => void; min: number; max: number; jedn?: string }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const zatwierdz = () => {
    const v = Number(txt.replace(",", "."));
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v))));
    else setTxt(String(value));
  };
  return (
    <label htmlFor={id} className="pr-pole">
      <span>{label}</span>
      <span className="pr-wej">
        <input id={id} className="input" inputMode="numeric" value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={zatwierdz} onKeyDown={(e) => e.key === "Enter" && zatwierdz()} />
        <i>{jedn}</i>
      </span>
    </label>
  );
}

export default function Produkcja({ projekt, meta }: { projekt?: { plan: PlanKuchni; zrodlo: ZrodloMaterialow }; meta: MetaProdukcji }) {
  const [zrodlo, setZrodlo] = useState<Zrodlo>(projekt?.plan.elementy.length ? "projekt" : "lista");
  const [u, setU] = useState<Ustawienia>(DOMYSLNE);
  const [tekst, setTekst] = useState("");
  const [model, setModel] = useState<{ stan: "pusty" } | { stan: "wczytuje"; nazwa: string } | { stan: "gotowy"; nazwa: string; wynik: WynikImportu } | { stan: "blad"; tekst: string }>({ stan: "pusty" });
  const [sloje, setSloje] = useState<Record<string, boolean>>({});

  useEffect(() => setU(wczytajUstawienia()), []);
  const zmien = (z: Partial<Ustawienia>) =>
    setU((s) => {
      const n = { ...s, ...z };
      try {
        localStorage.setItem(KLUCZ, JSON.stringify(n));
      } catch {
        /* bez pamięci ustawień */
      }
      return n;
    });

  const zListy = useMemo(() => (tekst.trim() ? importujListe(tekst) : null), [tekst]);

  const dane: (DaneProdukcji & { uwagi?: string[] }) | null = useMemo(() => {
    if (zrodlo === "projekt") return projekt ? formatkiProjektu(projekt.plan, projekt.zrodlo, u) : null;
    if (zrodlo === "lista") return zListy;
    return model.stan === "gotowy" ? model.wynik : null;
  }, [zrodlo, projekt, u, zListy, model]);

  const materialy = useMemo(() => (dane?.materialy ?? []).map((m) => (m.klucz in sloje ? { ...m, sloje: sloje[m.klucz] } : m)), [dane, sloje]);
  const daneM = useMemo(() => (dane ? { ...dane, materialy } : null), [dane, materialy]);
  const nr = useMemo(() => (daneM ? numeruj(daneM) : new Map<string, number>()), [daneM]);

  const wyniki = useMemo(() => {
    const out = new Map<string, WynikRozkroju>();
    if (!daneM) return out;
    for (const m of daneM.materialy) {
      const f = daneM.formatki.filter((x) => x.material === m.klucz);
      out.set(
        m.klucz,
        rozkroj(
          f.map((x) => ({ ref: x.id, nr: nr.get(x.id) ?? 0, dl: x.dl, szer: x.szer, ilosc: x.ilosc })),
          m.sloje,
          { arkusz: u.arkusz, rzaz: u.rzaz, obrzeze: u.obrzeze },
        ),
      );
    }
    return out;
  }, [daneM, nr, u.arkusz, u.rzaz, u.obrzeze]);

  const wczytajModel = async (files: FileList | null) => {
    const lista = Array.from(files ?? []);
    if (!lista.length) return;
    const glowny = lista.find((f) => /\.(obj|3ds|glb)$/i.test(f.name)) ?? lista[0];
    setModel({ stan: "wczytuje", nazwa: glowny.name });
    try {
      const { formatkiZModelu } = await import("./importModelu");
      setModel({ stan: "gotowy", nazwa: glowny.name, wynik: await formatkiZModelu(lista) });
    } catch (e) {
      setModel({ stan: "blad", tekst: e instanceof Error ? e.message : "Nie udało się odczytać modelu." });
    }
  };

  const wczytajPlik = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      toast("Excel: zapisz jako CSV", { type: "err", desc: "W Excelu: Plik → Zapisz jako → CSV (rozdzielany średnikami). Albo zaznacz komórki i wklej je tutaj." });
      return;
    }
    const buf = await f.arrayBuffer();
    // UTF-8, a gdy pojawią się znaki zastępcze – Windows-1250 (stare programy).
    let t = new TextDecoder("utf-8").decode(buf);
    if (t.includes("�")) t = new TextDecoder("windows-1250").decode(buf);
    setTekst(t);
  };

  const wydruk = () => {
    if (!daneM) return;
    const w = oknoPdf();
    if (!w) {
      toast("Przeglądarka zablokowała okno", { type: "err", desc: "Zezwól na wyskakujące okna dla tej strony." });
      return;
    }
    wpiszPdf(w, produkcjaDokument(daneM, wyniki, { arkusz: u.arkusz, rzaz: u.rzaz, obrzeze: u.obrzeze }, meta));
  };

  const csv = () => {
    if (!daneM) return;
    const blob = new Blob([csvFormatek(daneM)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `formatki-${(meta.kod || "projekt").replace(/[^\w-]+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const pods = daneM ? podsumowanie(daneM) : [];
  const arkuszy = Array.from(wyniki.values()).reduce((s, w) => s + w.arkusze.length, 0);
  const sztuk = daneM ? daneM.formatki.reduce((s, f) => s + f.ilosc, 0) : 0;
  const opcje: { value: Zrodlo; label: string }[] = [
    ...(projekt ? [{ value: "projekt" as const, label: "Z projektu" }] : []),
    { value: "lista", label: "Wklej listę" },
    { value: "model", label: "Z modelu 3D" },
  ];

  return (
    <div className="pr">
      <div className="pr-top">
        <Seg label="Źródło formatek" value={zrodlo} onChange={setZrodlo} options={opcje} />
        <span className="grow" style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={csv} disabled={!daneM?.formatki.length}>
          Pobierz CSV
        </button>
        <button type="button" className="btn btn-ink" onClick={wydruk} disabled={!daneM?.formatki.length}>
          Drukuj / PDF
        </button>
      </div>

      {zrodlo === "lista" ? (
        <section className="pr-zrodlo">
          <p className="lede">
            Wklej komórki z Excela albo listę formatek z KD Max / PRO100 (eksport do CSV lub TXT). Kolumny rozpoznają się po nagłówkach: długość, szerokość, ilość,
            materiał, nazwa, okleina.
          </p>
          <textarea className="input pr-tekst" rows={6} value={tekst} placeholder={PRZYKLAD} onChange={(e) => setTekst(e.target.value)} aria-label="Lista formatek" spellCheck={false} />
          <div className="pr-akcje">
            <label className="btn btn-ghost">
              Wczytaj plik CSV / TXT
              <input type="file" accept=".csv,.txt,.tsv,.xls,.xlsx" hidden onChange={(e) => void wczytajPlik(e.target.files)} />
            </label>
            {!tekst ? (
              <button type="button" className="btn btn-plain" onClick={() => setTekst(PRZYKLAD)}>
                Wstaw przykład
              </button>
            ) : (
              <button type="button" className="btn btn-plain" onClick={() => setTekst("")}>
                Wyczyść
              </button>
            )}
          </div>
          {zListy?.uwagi.length ? <p className="faint pr-uwagi">{zListy.uwagi.join(" ")}</p> : null}
        </section>
      ) : null}

      {zrodlo === "model" ? (
        <section className="pr-zrodlo">
          <p className="lede">
            Projekt z PRO100: <b>Plik → Eksport → OBJ</b>, potem wybierz tu plik .obj (możesz dodać .mtl – wtedy materiały mają nazwy). Działa też .3ds i .glb z
            innych programów. Każda płyta z modelu to formatka; uchwyty i AGD są pomijane.
          </p>
          <div className="pr-akcje">
            <label className="btn btn-ghost">
              Wybierz model
              <input type="file" multiple accept=".obj,.mtl,.3ds,.glb" hidden onChange={(e) => void wczytajModel(e.target.files)} />
            </label>
            {model.stan === "wczytuje" ? (
              <span className="faint" role="status">
                <span className="spin" aria-hidden /> Czytam {model.nazwa}…
              </span>
            ) : model.stan === "gotowy" ? (
              <span className="faint">{model.nazwa}</span>
            ) : null}
          </div>
          {model.stan === "blad" ? <p className="err">{model.tekst}</p> : null}
          {model.stan === "gotowy" && model.wynik.uwagi.length ? <p className="faint pr-uwagi">{model.wynik.uwagi.join(" ")}</p> : null}
        </section>
      ) : null}

      <details className="pr-ust">
        <summary>Ustawienia cięcia</summary>
        <div className="pr-ust-siatka">
          <Liczba id="pr-ark-dl" label="Arkusz – długość" value={u.arkusz.dl} min={500} max={6000} onChange={(v) => zmien({ arkusz: { ...u.arkusz, dl: v } })} />
          <Liczba id="pr-ark-sz" label="Arkusz – szerokość" value={u.arkusz.szer} min={300} max={3000} onChange={(v) => zmien({ arkusz: { ...u.arkusz, szer: v } })} />
          <Liczba id="pr-rzaz" label="Rzaz piły" value={u.rzaz} min={0} max={10} onChange={(v) => zmien({ rzaz: v })} />
          <Liczba id="pr-obrz" label="Obrzeże arkusza" value={u.obrzeze} min={0} max={50} onChange={(v) => zmien({ obrzeze: v })} />
          {zrodlo === "projekt" ? (
            <>
              <Liczba id="pr-szcz" label="Szczelina frontów" value={u.szczelina} min={0} max={10} onChange={(v) => zmien({ szczelina: v })} />
              <Liczba id="pr-nawis" label="Nawis blatu" value={u.nawisBlatu} min={0} max={100} onChange={(v) => zmien({ nawisBlatu: v })} />
              <label htmlFor="pr-szuf" className="pr-pole">
                <span>Szuflady</span>
                <select id="pr-szuf" className="input" value={u.szuflady} onChange={(e) => zmien({ szuflady: e.target.value === "systemowe" ? "systemowe" : "plyta" })}>
                  <option value="plyta">Skrzynki z płyty</option>
                  <option value="systemowe">Systemowe (metalowe boki)</option>
                </select>
              </label>
              <label htmlFor="pr-plecy" className="pr-pole">
                <span>Plecy</span>
                <select id="pr-plecy" className="input" value={u.plecy} onChange={(e) => zmien({ plecy: e.target.value === "brak" ? "brak" : "hdf" })}>
                  <option value="hdf">HDF 3 mm nakładane</option>
                  <option value="brak">Bez pleców</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
      </details>

      {!daneM || !daneM.formatki.length ? (
        <p className="empty">
          {zrodlo === "projekt"
            ? "Projekt nie ma mebli z płyty. Dodaj szafki w kroku „Meble”."
            : zrodlo === "lista"
              ? "Wklej listę formatek albo wczytaj plik – tabela i rozkrój pojawią się tutaj."
              : "Wybierz plik modelu – formatki odczytają się z płyt w modelu."}
        </p>
      ) : (
        <>
          <p className="pr-suma" data-testid="pr-suma">
            <b>{sztuk}</b> formatek · <b>{arkuszy}</b> {arkuszy === 1 ? "arkusz" : arkuszy < 5 ? "arkusze" : "arkuszy"} · okleina <b>{pl(daneM.formatki.reduce((s, f) => s + okleinaMb(f), 0))}</b> mb
          </p>
          <div className="pr-tab-wrap">
            <table className="pr-tab">
              <thead>
                <tr>
                  <th>Materiał</th>
                  <th className="n">Formatek</th>
                  <th className="n">m²</th>
                  <th className="n">Arkusze</th>
                  <th className="n">Odpad</th>
                  <th className="n">Okleina</th>
                  <th>Słoje</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((p) => {
                  const w = wyniki.get(p.material.klucz);
                  return (
                    <tr key={p.material.klucz}>
                      <td>
                        {nazwaZGruboscia(p.material)}
                      </td>
                      <td className="n">{p.sztuk}</td>
                      <td className="n">{pl(p.m2, 2)}</td>
                      <td className="n">{w?.arkusze.length ?? "–"}</td>
                      <td className="n">{w ? `${pl(w.odpad * 100)}%` : "–"}</td>
                      <td className="n">{pl(p.okleinaMb)} mb</td>
                      <td>
                        <label className="pr-check">
                          <input type="checkbox" checked={p.material.sloje} onChange={(e) => setSloje((s) => ({ ...s, [p.material.klucz]: e.target.checked }))} />
                          <span>{p.material.sloje ? "wzdłuż" : "obrót"}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {daneM.materialy.map((m) => {
            const lista = daneM.formatki.filter((f) => f.material === m.klucz);
            const w = wyniki.get(m.klucz);
            if (!lista.length) return null;
            return (
              <details key={m.klucz} className="pr-mat" open>
                <summary>
                  {nazwaZGruboscia(m)} <span className="faint">· {lista.reduce((s, f) => s + f.ilosc, 0)} szt.</span>
                </summary>
                <div className="pr-tab-wrap">
                  <table className="pr-tab">
                    <thead>
                      <tr>
                        <th className="n">Nr</th>
                        <th>Mebel</th>
                        <th>Element</th>
                        <th className="n">Dł.</th>
                        <th className="n">Szer.</th>
                        <th className="n">Szt.</th>
                        <th>Okleina</th>
                        <th>Uwagi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((f) => (
                        <tr key={f.id}>
                          <td className="n">{nr.get(f.id)}</td>
                          <td>{f.mebel}</td>
                          <td>{f.element}</td>
                          <td className="n">{f.dl}</td>
                          <td className="n">{f.szer}</td>
                          <td className="n">{f.ilosc}</td>
                          <td className="mono">{okleinaTekst(f)}</td>
                          <td className="faint">{f.uwagi ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {w?.zaDuze.length ? <p className="err">Za duże na arkusz {u.arkusz.dl}×{u.arkusz.szer}: {w.zaDuze.map((z) => `nr ${z.nr}`).join(", ")}</p> : null}
                {w?.arkusze.length ? (
                  <div className="pr-arkusze">
                    {w.arkusze.map((a, i) => (
                      <figure key={i} className="pr-arkusz">
                        <figcaption>
                          Arkusz {i + 1} <span className="faint">· {a.kawalki.length} formatek</span>
                        </figcaption>
                        <div dangerouslySetInnerHTML={{ __html: svgArkusza(a, { arkusz: u.arkusz, rzaz: u.rzaz, obrzeze: u.obrzeze }) }} />
                      </figure>
                    ))}
                  </div>
                ) : null}
              </details>
            );
          })}

          {daneM.okucia?.length ? (
            <details className="pr-mat" open>
              <summary>Okucia</summary>
              <ul className="pr-lista">
                {daneM.okucia.map((o) => (
                  <li key={o.nazwa}>
                    <span>{o.nazwa}</span>
                    <b>
                      {o.ilosc} {o.jednostka}
                    </b>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {daneM.blaty?.length ? (
            <details className="pr-mat" open>
              <summary>Blaty · {daneM.blatNazwa}</summary>
              <ul className="pr-lista">
                {daneM.blaty.map((b, i) => (
                  <li key={i}>
                    <span>
                      {b.mebel}
                      {b.uwagi ? <span className="faint"> · {b.uwagi}</span> : null}
                    </span>
                    <b>
                      {b.dl} × {b.szer} mm
                    </b>
                  </li>
                ))}
              </ul>
              <p className="faint">Płyt blatowych 4100 mm: {blatyNaPlyty(daneM.blaty).plyty}</p>
            </details>
          ) : null}
          {daneM.pominiete?.length ? <p className="faint pr-uwagi">Bez formatek: {daneM.pominiete.map((p) => p.mebel).join(", ")}.</p> : null}
        </>
      )}
    </div>
  );
}
