"use client";

/*
 * /panel/szybka – szybka oferta (jak planer w sklepie meblowym): opisujesz słowami, co klient chce
 * („kuchnia w L 3,6 × 2,8, zmywarka 45, lodówka wolnostojąca”), doklikujesz resztę, a obok od razu widać rzut,
 * wypisane elementy z cenami i sumę. „Dalej w kreatorze” przenosi projekt do kreatora (tam zapis, materiały, PDF, link).
 * Logika: src/lib/szybkaOferta.ts (parametry → propozycja.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { bazaKuchni, cenaElementu, opisPozaWycena, wycenianyElement, type TrybCen } from "@/lib/kuchnia";
import { TYP_PROJEKTU, parseTypProjektu, type TypProjektu } from "@/lib/projekt";
import { AGD_IDS, AGD_LABEL, MEBEL_LABEL, MEBLE_SALONU, POTRZEBA_LABEL, POTRZEBY, type Agd } from "@/lib/wywiad";
import {
  domyslneSzybkiej,
  gotoweDlaTypu,
  KLUCZ_SZYBKIEJ,
  LIMITY_POKOJU,
  LIMITY_WYSOKOSCI,
  planSzybkiej,
  poprawParametry,
  rozpoznaj,
  type ParametrySzybkiej,
  type SzybkaDoKreatora,
} from "@/lib/szybkaOferta";
import { useBrand } from "@/lib/brand";
import { formatPln } from "../pricing";
import PrzelacznikMotywu from "../motyw/PrzelacznikMotywu";
import RzutKuchni from "../kuchnia/RzutKuchni";
import { hasLogin } from "./offerApi";
import { LoginDialog, LogoutButton, PanelBrand } from "./PanelGate";
import { PoleCm } from "./KreatorWlasciwosci";
import { Seg, toast, Toaster, Tooltips } from "./ui";
import { useCennik } from "./useCennik";
import MiniRzut from "./MiniRzut";
import { PoleCeny, WyborCen } from "./KreatorCena";

/** Rodzaje do wyboru (bez „inne” – tam nie ma propozycji). */
const TYPY: TypProjektu[] = ["kuchnia", "szafa", "komoda", "lazienka"];
/** Jedna zmywarka, jeden piekarnik, jedna lodówka. */
const PARY: Agd[][] = [
  ["zmywarka-60", "zmywarka-45"],
  ["piekarnik-slupek", "piekarnik-dolny"],
  ["lodowka-zabudowa", "lodowka-wolnostojaca"],
];
const PRZYKLADY: Record<TypProjektu, string> = {
  kuchnia: "np. kuchnia w L 3,6 x 2,8, zmywarka 45, lodówka wolnostojąca, płyta gazowa",
  szafa: "np. szafa przesuwna 250 cm na płaszcze i koszule, do sufitu 270",
  komoda: "np. salon: szafka RTV, komoda i regał na ścianie 4 m",
  lazienka: "np. łazienka, umywalka 80 i słupek",
  inne: "np. kuchnia prosta 3 m",
};

function Chip({ wlaczony, onClick, children }: { wlaczony: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="so-chip" aria-pressed={wlaczony} onClick={onClick}>
      {children}
    </button>
  );
}

export default function SzybkaOfertaApp() {
  const brand = useBrand();
  const [auth, setAuth] = useState(false);
  const [p, setP] = useState<ParametrySzybkiej>(() => domyslneSzybkiej("kuchnia"));
  const [opis, setOpis] = useState("");
  const [rozpoznane, setRozpoznane] = useState<string[]>([]);
  const [klient, setKlient] = useState({ client: "", contact: "", title: "" });
  /** Ceny: wpisywane ręcznie w kreatorze (domyślnie) albo gotowe z cennika. */
  const [ceny, setCeny] = useState<TrybCen>("reczne");
  const zCennika = ceny === "cennik";
  /** Ceny ręczne: kwota całej zabudowy (puste = suma cen pozycji wpisanych w kreatorze). */
  const [cenaOgolna, setCenaOgolna] = useState<number | undefined>(undefined);
  const [bladKlienta, setBladKlienta] = useState(false);
  const klientRef = useRef<HTMLInputElement>(null);
  const { cennik, gotowy, blad } = useCennik(!auth);
  const bazowe = useRef<ParametrySzybkiej>(p);

  useEffect(() => {
    if (!hasLogin() && process.env.NODE_ENV !== "development") setAuth(true);
    const q = new URLSearchParams(window.location.search);
    if (q.get("ceny") === "cennik") setCeny("cennik");
    const typ = parseTypProjektu(q.get("typ"));
    if (typ && typ !== "inne") {
      const d = domyslneSzybkiej(typ);
      setP(d);
      bazowe.current = d;
    }
  }, []);

  // Opis czytany na bieżąco (z małym opóźnieniem): to, co rozpoznane, ustawia formularz – resztę doklikasz.
  useEffect(() => {
    if (!opis.trim()) {
      setRozpoznane([]);
      return;
    }
    const t = window.setTimeout(() => {
      const r = rozpoznaj(opis, bazowe.current);
      setP(r.p);
      setRozpoznane(r.rozpoznane);
    }, 350);
    return () => window.clearTimeout(t);
  }, [opis]);

  /** Zmiana w formularzu – też baza dla kolejnych słów w opisie. */
  const zmien = (fn: (s: ParametrySzybkiej) => ParametrySzybkiej) =>
    setP((s) => {
      const n = poprawParametry(fn(s));
      bazowe.current = n;
      return n;
    });

  const plan = useMemo(() => planSzybkiej(p), [p]);
  const razem = useMemo(() => bazaKuchni(plan, cennik), [plan, cennik]);
  const pozycje = plan.elementy;
  const wycenione = pozycje.filter(wycenianyElement).length;

  const typ = p.typ;
  const dalej = () => {
    // Opis czyta się z opóźnieniem – przy „Dalej” stosujemy go od razu (inaczej „łazienka” wpisana tuż przed
    // kliknięciem przechodziła jako poprzedni rodzaj, np. kuchnia).
    const r = opis.trim() ? rozpoznaj(opis, bazowe.current) : null;
    const pTeraz = r ? r.p : p;
    const planTeraz = r ? planSzybkiej(pTeraz) : plan;
    if (r) {
      setP(r.p);
      setRozpoznane(r.rozpoznane);
    }
    if (!klient.client.trim()) {
      setBladKlienta(true);
      klientRef.current?.focus();
      return void toast("Wpisz klienta", { type: "err", desc: "Imię i nazwisko albo nazwa firmy – pod tym zapiszesz ofertę." });
    }
    if (!planTeraz.elementy.length) return void toast("Nic się nie zmieściło", { type: "err", desc: "Wydłuż zabudowę albo zmień wyposażenie." });
    const dane: SzybkaDoKreatora = {
      typ: pTeraz.typ,
      plan: ceny === "reczne" && cenaOgolna !== undefined ? { ...planTeraz, cenaOgolna } : planTeraz,
      title: klient.title.trim() || `${TYP_PROJEKTU[pTeraz.typ].label}${pTeraz.uklad === "L" && pTeraz.typ === "kuchnia" ? " w L" : ""} ${pTeraz.scianaA} cm`,
      client: klient.client.trim(),
      contact: klient.contact.trim(),
      ceny,
    };
    try {
      sessionStorage.setItem(KLUCZ_SZYBKIEJ, JSON.stringify(dane));
    } catch {
      return void toast("Nie przeniesiono projektu", { type: "err", desc: "Przeglądarka nie pozwala zapisać danych strony (tryb prywatny?)." });
    }
    window.location.href = `/panel/kreator?typ=${pTeraz.typ}&z=szybka`;
  };

  return (
    <div className="pnl set">
      <header className="top">
        <a className="btn btn-plain" href="/panel" aria-label="Wróć do ofert">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <PanelBrand />
        <div className="crumb">
          <span>/</span>
          <b>Szybka oferta</b>
        </div>
        <span className="grow" />
        {!auth ? <LogoutButton /> : null}
        <a className="btn btn-ghost" href="/panel">
          Oferty
        </a>
        <PrzelacznikMotywu className="btn btn-plain" domyslny="system" />
      </header>
      <main className="surface so-main">
        <section className="so-lewa" aria-label="Czego potrzebuje klient">
          <div>
            <h1 className="so-h1">Szybka oferta</h1>
            <p className="lede">Napisz, czego potrzebuje klient, albo przeklikaj opcje. Elementy i cena układają się same – szczegóły poprawisz potem w kreatorze.</p>
          </div>
          <div className="field">
            <label className="lab" htmlFor="so-opis">
              Opis
            </label>
            <textarea id="so-opis" className="input so-opis" rows={2} value={opis} placeholder={PRZYKLADY[typ]} onChange={(e) => setOpis(e.target.value)} spellCheck={false} />
            {rozpoznane.length ? (
              <p className="so-rozpoznane" role="status">
                Rozpoznano: {rozpoznane.map((r) => <span key={r}>{r}</span>)}
              </p>
            ) : null}
          </div>

          <div className="field">
            <span className="lab">Co projektujemy</span>
            <div className="so-chipy">
              {TYPY.map((t) => (
                <Chip
                  key={t}
                  wlaczony={typ === t}
                  onClick={() =>
                    zmien((s) => (s.typ === t ? s : { ...domyslneSzybkiej(t), wysokosc: s.wysokosc }))
                  }
                >
                  {TYP_PROJEKTU[t].label}
                </Chip>
              ))}
            </div>
          </div>

          {typ === "kuchnia" ? (
            <div className="field">
              <span className="lab">Układ</span>
              <Seg
                label="Układ zabudowy"
                value={p.uklad}
                onChange={(uklad) => zmien((s) => ({ ...s, uklad }))}
                options={[
                  { value: "ciag", label: "Prosta" },
                  { value: "L", label: "W kształcie L" },
                ]}
              />
            </div>
          ) : null}

          <div className="field">
            <span className="lab">Pomieszczenie</span>
            <div className="kr-dims kr-dims-3">
              <PoleCm id="so-szer" label="Szerokość (ściana A)" value={p.pokoj.szer} min={LIMITY_POKOJU.min} max={LIMITY_POKOJU.max} onCommit={(n) => zmien((s) => ({ ...s, pokoj: { ...s.pokoj, szer: n }, scianaA: s.scianaA >= s.pokoj.szer ? n : s.scianaA }))} />
              <PoleCm id="so-dlug" label="Długość (ściana B)" value={p.pokoj.dlug} min={LIMITY_POKOJU.min} max={LIMITY_POKOJU.max} onCommit={(n) => zmien((s) => ({ ...s, pokoj: { ...s.pokoj, dlug: n }, scianaB: s.scianaB >= s.pokoj.dlug ? n : s.scianaB }))} />
              <PoleCm id="so-wys" label="Wysokość do sufitu" value={p.wysokosc} min={LIMITY_WYSOKOSCI.min} max={LIMITY_WYSOKOSCI.max} onCommit={(n) => zmien((s) => ({ ...s, wysokosc: n }))} />
            </div>
            <div className="kr-dims">
              <PoleCm id="so-a" label="Zabudowa na ścianie A" value={p.scianaA} min={80} max={p.pokoj.szer} onCommit={(n) => zmien((s) => ({ ...s, scianaA: n }))} />
              {typ === "kuchnia" && p.uklad === "L" ? <PoleCm id="so-b" label="Zabudowa na ścianie B" value={p.scianaB} min={80} max={p.pokoj.dlug} onCommit={(n) => zmien((s) => ({ ...s, scianaB: n }))} /> : null}
            </div>
          </div>

          {typ === "kuchnia" ? (
            <>
              <div className="field">
                <span className="lab">Urządzenia do zabudowy</span>
                <div className="so-chipy">
                  {AGD_IDS.map((a) => (
                    <Chip
                      key={a}
                      wlaczony={p.agd.includes(a)}
                      onClick={() =>
                        zmien((s) => {
                          if (s.agd.includes(a)) return { ...s, agd: s.agd.filter((x) => x !== a) };
                          const para = PARY.find((x) => x.includes(a)) ?? [];
                          return { ...s, agd: [...s.agd.filter((x) => !para.includes(x)), a] };
                        })
                      }
                    >
                      {AGD_LABEL[a]}
                    </Chip>
                  ))}
                  <Chip wlaczony={p.gaz} onClick={() => zmien((s) => ({ ...s, gaz: !s.gaz, agd: !s.gaz && !s.agd.includes("plyta") ? [...s.agd, "plyta"] : s.agd }))}>
                    Płyta gazowa
                  </Chip>
                </div>
              </div>
              <div className="field">
                <span className="lab">Szafki górne</span>
                <Seg
                  label="Wysokość szafek górnych"
                  value={p.gorne}
                  onChange={(gorne) => zmien((s) => ({ ...s, gorne }))}
                  options={[
                    { value: "72", label: "72 cm" },
                    { value: "90", label: "90 cm" },
                    { value: "sufit", label: "Do sufitu" },
                  ]}
                />
              </div>
            </>
          ) : typ === "szafa" ? (
            <>
              <div className="field">
                <span className="lab">Drzwi</span>
                <Seg
                  label="Drzwi szafy"
                  value={p.drzwiSzafy}
                  onChange={(drzwiSzafy) => zmien((s) => ({ ...s, drzwiSzafy }))}
                  options={[
                    { value: "przesuwne", label: "Przesuwne" },
                    { value: "uchylne", label: "Uchylne" },
                  ]}
                />
              </div>
              <div className="field">
                <span className="lab">Co ma się zmieścić</span>
                <div className="so-chipy">
                  {POTRZEBY.map((x) => (
                    <Chip key={x} wlaczony={p.potrzeby.includes(x)} onClick={() => zmien((s) => ({ ...s, potrzeby: s.potrzeby.includes(x) ? s.potrzeby.filter((y) => y !== x) : [...s.potrzeby, x] }))}>
                      {POTRZEBA_LABEL[x]}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          ) : typ === "komoda" ? (
            <div className="field">
              <span className="lab">Meble</span>
              <div className="so-chipy">
                {MEBLE_SALONU.map((x) => (
                  <Chip key={x} wlaczony={p.meble.includes(x)} onClick={() => zmien((s) => ({ ...s, meble: s.meble.includes(x) ? s.meble.filter((y) => y !== x) : [...s.meble, x] }))}>
                    {MEBEL_LABEL[x]}
                  </Chip>
                ))}
              </div>
            </div>
          ) : typ === "lazienka" ? (
            <div className="field">
              <span className="lab">Szafka pod umywalkę</span>
              <Seg label="Szerokość szafki pod umywalkę" value={String(p.umywalka)} onChange={(v) => zmien((s) => ({ ...s, umywalka: Number(v) }))} options={["60", "80", "100", "120"].map((v) => ({ value: v, label: `${v} cm` }))} />
              <label className="kr-check">
                <input type="checkbox" checked={p.slupek} onChange={(e) => zmien((s) => ({ ...s, slupek: e.target.checked }))} />
                Słupek łazienkowy 40 cm
              </label>
            </div>
          ) : null}

          <div className="field">
            <span className="lab">Albo zacznij od gotowego projektu</span>
            <div className="so-gotowe">
              {gotoweDlaTypu(typ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="so-gotowy"
                  onClick={() => {
                    setOpis("");
                    zmien(() => g.parametry);
                    toast(`Wczytano: ${g.nazwa}`, { desc: "Zmień wymiary i wyposażenie – elementy ułożą się od nowa." });
                  }}
                >
                  <MiniRzut plan={planSzybkiej(g.parametry)} etykieta={`Rzut: ${g.nazwa}`} />
                  <b>{g.nazwa}</b>
                  <span>{g.opis}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="so-prawa" aria-label="Projekt i cena">
          <div className="so-rzut">
            <RzutKuchni plan={plan} zaznaczony={null} wymiary onWybierz={() => {}} onPrzesun={() => {}} onKolizja={() => {}} />
          </div>
          <div className="so-lista-wrap">
            <h2>
              Elementy <span className="faint">· {pozycje.length}</span>
            </h2>
            {pozycje.length ? (
              <ol className="so-lista">
                {pozycje.map((e) => (
                  <li key={e.id}>
                    <span>
                      <b>{e.nazwa}</b>
                      <span className="faint mono">
                        {e.w}×{e.h}×{e.d}
                      </span>
                    </span>
                    <span className="mono">
                      {!wycenianyElement(e) ? <span className="faint">{opisPozaWycena(e)}</span> : !zCennika ? <span className="faint">cena w kreatorze</span> : !gotowy ? "…" : formatPln(cenaElementu(e, cennik) ?? 0)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="lede">Nic się nie zmieściło – wydłuż zabudowę albo zmień wyposażenie.</p>
            )}
            {zCennika ? (
              <>
                <div className="so-suma">
                  <span>
                    Razem netto <span className="faint">· {wycenione} {wycenione === 1 ? "pozycja" : wycenione % 10 >= 2 && wycenione % 10 <= 4 && (wycenione % 100 < 10 || wycenione % 100 >= 20) ? "pozycje" : "pozycji"}</span>
                  </span>
                  <b className="mono">{gotowy ? formatPln(razem) : "…"}</b>
                </div>
                {blad ? <p className="kr-hint">Nie pobrano cennika firmy – ceny z cennika domyślnego.</p> : <p className="kr-hint">Ceny z cennika modułów {brand.name}. Materiały i dodatki wybierzesz w kreatorze.</p>}
              </>
            ) : (
              <p className="kr-hint so-suma-info">
                {wycenione} {wycenione === 1 ? "pozycja" : wycenione % 10 >= 2 && wycenione % 10 <= 4 && (wycenione % 100 < 10 || wycenione % 100 >= 20) ? "pozycje" : "pozycji"} do wyceny – swoje kwoty wpiszesz w kreatorze (krok „Materiały”, lista „Ceny pozycji”).
              </p>
            )}
          </div>
          <div className="so-klient">
            <WyborCen tryb={ceny} onTryb={setCeny} />
            {!zCennika ? (
              <PoleCeny id="so-cena-ogolna" label="Cena całej zabudowy netto (opcjonalnie – puste = suma cen pozycji)" wartosc={cenaOgolna} onZmiana={setCenaOgolna} />
            ) : null}
            <div className="grid2">
              <div className="field">
                <label htmlFor="so-klient">Klient (wymagany)</label>
                <input
                  id="so-klient"
                  ref={klientRef}
                  className="input"
                  autoComplete="off"
                  required
                  value={klient.client}
                  aria-invalid={bladKlienta && !klient.client.trim() ? true : undefined}
                  aria-describedby={bladKlienta && !klient.client.trim() ? "so-klient-blad" : undefined}
                  onChange={(e) => setKlient((k) => ({ ...k, client: e.target.value }))}
                  onBlur={() => setBladKlienta(true)}
                  placeholder="Imię i nazwisko albo firma"
                />
                {bladKlienta && !klient.client.trim() ? (
                  <p id="so-klient-blad" className="err" role="alert">
                    Wpisz klienta – bez tego nie przejdziesz dalej.
                  </p>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="so-kontakt">E-mail lub telefon</label>
                <input id="so-kontakt" className="input" autoComplete="off" value={klient.contact} onChange={(e) => setKlient((k) => ({ ...k, contact: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="so-tytul">Tytuł oferty</label>
              <input id="so-tytul" className="input" autoComplete="off" value={klient.title} onChange={(e) => setKlient((k) => ({ ...k, title: e.target.value }))} placeholder="puste = np. „Kuchnia w L 360 cm”" />
            </div>
            <button type="button" className="btn btn-ink wide" onClick={dalej} disabled={!pozycje.length}>
              Dalej w kreatorze – materiały, zapis i PDF
            </button>
          </div>
        </section>
      </main>
      {auth ? <LoginDialog error="" onLoggedIn={() => setAuth(false)} /> : null}
      <Toaster />
      <Tooltips />
    </div>
  );
}
