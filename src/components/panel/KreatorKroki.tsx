"use client";

/*
 * Kreator krok po kroku: pasek kroków i pierwsze trzy kroki (pomieszczenie, okna i instalacje, wyposażenie).
 * Odpowiedzi trafiają do plan.wywiad (src/lib/wywiad.ts), a z nich „Ułóż propozycję” robi pierwszy układ
 * (src/lib/propozycja.ts). Kroki 4–6 (meble, materiały, oferta) są w KreatorApp.
 */
import { UKLAD_KUCHNI_LABEL, type PlanKuchni, type Sciana, type UkladKuchni } from "@/lib/kuchnia";
import { parseTypProjektu, TYP_PROJEKTU, TYPY_PROJEKTU, type TypProjektu } from "@/lib/projekt";
import { AGD_IDS, AGD_LABEL, MAX_PUNKTOW, MEBEL_LABEL, MEBLE_SALONU, POTRZEBA_LABEL, POTRZEBY, PUNKT_INFO, RODZAJE_PUNKTOW, type Otwor, type PunktInstalacji, type RodzajPunktu, type Wywiad } from "@/lib/wywiad";
import { propozycjaPunktow, sprawdzPunkt, uwagiPunktu, wolneMiejscePunktu } from "@/lib/punkty";
import { PoleCm } from "./KreatorWlasciwosci";
import { scianyPokoju, SCIANA_LABEL } from "@/lib/sciany";
import { sprawdzOtwor, wolneMiejsceOtworu } from "@/lib/otwory";
import { Seg } from "./ui";
import KreatorSciany from "./KreatorSciany";

export const KROKI = ["pomieszczenie", "otoczenie", "wyposazenie", "meble", "materialy", "oferta"] as const;
export type Krok = (typeof KROKI)[number];

export function etykietaKroku(k: Krok, typ: TypProjektu) {
  switch (k) {
    case "pomieszczenie":
      return typ === "szafa" ? "Wnęka" : "Pomiar";
    case "otoczenie":
      return "Okna i instalacje";
    case "wyposazenie":
      return typ === "kuchnia" ? "AGD i szafki" : typ === "szafa" ? "Potrzeby" : "Co ma być";
    case "meble":
      return "Meble";
    case "materialy":
      return "Materiały";
    case "oferta":
      return "Klient i oferta";
  }
}

export function PasekKrokow({ krok, typ, onKrok, gotowe }: { krok: Krok; typ: TypProjektu; onKrok: (k: Krok) => void; gotowe: ReadonlySet<Krok> }) {
  return (
    <nav className="kr-kroki" aria-label="Kroki kreatora" data-tour="kroki">
      <ol>
        {KROKI.map((k, i) => (
          <li key={k}>
            <button type="button" aria-current={krok === k ? "step" : undefined} data-gotowy={gotowe.has(k) ? "" : undefined} onClick={() => onKrok(k)} title={etykietaKroku(k, typ)}>
              <span className="kr-krok-nr">{gotowe.has(k) && krok !== k ? "✓" : i + 1}</span>
              <span className="kr-krok-tekst">{etykietaKroku(k, typ)}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type Wspolne = {
  typ: TypProjektu;
  plan: PlanKuchni;
  wywiad: Wywiad;
  setWywiad: (fn: (w: Wywiad) => Wywiad) => void;
};

const SCIANA_A: Record<TypProjektu, string> = {
  kuchnia: "Ściana A – długość pod zabudowę",
  szafa: "Szerokość wnęki (ściany pod szafę)",
  komoda: "Długość ściany pod meble",
  lazienka: "Ściana z umywalką",
  inne: "Ściana A – długość pod meble",
};

export function KrokPomieszczenie({
  typ,
  setTyp,
  plan,
  setPlan,
  wywiad,
  setWywiad,
  onUklad,
}: Wspolne & { setTyp: (t: TypProjektu) => void; setPlan: (fn: (p: PlanKuchni) => PlanKuchni) => void; onUklad: (u: UkladKuchni) => void }) {
  const pom = plan.pomieszczenie ?? { szer: Math.min(2000, Math.max(120, plan.scianaA + 60)), dlug: Math.min(2000, Math.max(120, (plan.uklad === "L" ? plan.scianaB : 200) + 60)) };
  return (
    <div className="kr-krok" data-krok="pomieszczenie">
      <h2>Pomieszczenie</h2>
      <p className="lede">Zacznij od pomiaru. Wymiary podawaj w centymetrach, od narożnika, w którym zaczyna się zabudowa.</p>
      <div className="field">
        <label htmlFor="k-typ">Co projektujemy</label>
        <select id="k-typ" className="input" value={typ} onChange={(e) => setTyp(parseTypProjektu(e.target.value) ?? "kuchnia")}>
          {TYPY_PROJEKTU.map((t) => (
            <option key={t} value={t}>
              {TYP_PROJEKTU[t].label}
            </option>
          ))}
        </select>
      </div>
      <div className="kr-dims kr-dims-3">
        <PoleCm id="k-pom-szer" label="Szerokość pokoju" value={pom.szer} min={120} max={2000} onCommit={(n) => setPlan((p) => ({ ...p, pomieszczenie: { szer: n, dlug: p.pomieszczenie?.dlug ?? pom.dlug } }))} />
        <PoleCm id="k-pom-dlug" label="Długość pokoju" value={pom.dlug} min={120} max={2000} onCommit={(n) => setPlan((p) => ({ ...p, pomieszczenie: { szer: p.pomieszczenie?.szer ?? pom.szer, dlug: n } }))} />
        <PoleCm id="k-pom-wys" label="Wysokość do sufitu" value={wywiad.wysokosc} min={180} max={450} onCommit={(n) => setWywiad((w) => ({ ...w, wysokosc: n }))} />
      </div>
      {typ === "kuchnia" || typ === "inne" ? (
        <div className="field">
          <span className="lab">Układ zabudowy</span>
          <Seg label="Układ zabudowy" value={plan.uklad} onChange={onUklad} options={(Object.keys(UKLAD_KUCHNI_LABEL) as UkladKuchni[]).map((u) => ({ value: u, label: UKLAD_KUCHNI_LABEL[u] }))} />
        </div>
      ) : null}
      <div className="kr-dims">
        <PoleCm id="k-sciana-a" label={SCIANA_A[typ]} value={plan.scianaA} min={80} max={1200} onCommit={(n) => setPlan((p) => ({ ...p, scianaA: n }))} />
        {plan.uklad === "L" ? <PoleCm id="k-sciana-b" label="Ściana B – druga ściana (L)" value={plan.scianaB} min={80} max={1200} onCommit={(n) => setPlan((p) => ({ ...p, scianaB: n }))} /> : null}
      </div>
      <p className="kr-hint">
        {typ === "szafa"
          ? "Szafę zrobimy na całą wnękę i do sufitu (minus 2 cm luzu). Wysokość mierz w kilku miejscach – liczy się najniższa."
          : typ === "kuchnia"
            ? "Ściana A to ściana z oknem albo najdłuższa. W układzie L ściana B zaczyna się w tym samym narożniku."
            : "Obrys pokoju widać na rzucie jako przerywaną linię."}
      </p>
      <KreatorSciany plan={plan} setPlan={setPlan} />
    </div>
  );
}

export function KrokOtoczenie({ typ, plan, wywiad, setWywiad }: Wspolne) {
  const L = plan.uklad === "L";
  const ustawOtwor = (i: number, zmiana: Partial<Otwor>) => setWywiad((w) => ({ ...w, otwory: w.otwory.map((o, j) => (j === i ? { ...o, ...zmiana } : o)) }));
  const sciany = scianyPokoju(plan);
  // Nowy otwór od razu w wolnym miejscu (nie w meblach, nie na innym otworze) – drzwi najchętniej naprzeciw zabudowy.
  const dodajOtwor = (rodzaj: Otwor["rodzaj"]) =>
    setWywiad((w) => {
      const wzor: Otwor =
        rodzaj === "okno"
          ? { rodzaj, sciana: "A", od: Math.max(0, Math.round(plan.scianaA / 2 - 60)), szer: 120, parapet: 90 }
          : { rodzaj, sciana: sciany.some((s) => s.id === "C") ? "C" : L ? "B" : "A", od: 0, szer: 90 };
      return { ...w, otwory: [...w.otwory, wolneMiejsceOtworu({ ...plan, wywiad: w }, wzor)].slice(0, 12) };
    });
  // Gniazdka i punkty instalacji: nowy w wolnym miejscu na ścianie A na typowej wysokości.
  const punkty = wywiad.punkty ?? [];
  const ustawPunkt = (i: number, zmiana: Partial<PunktInstalacji>) => setWywiad((w) => ({ ...w, punkty: (w.punkty ?? []).map((p, j) => (j === i ? { ...p, ...zmiana } : p)) }));
  const dodajPunkt = (rodzaj: RodzajPunktu) =>
    setWywiad((w) => ({
      ...w,
      punkty: [...(w.punkty ?? []), wolneMiejscePunktu({ ...plan, wywiad: w }, { rodzaj, sciana: "A", od: 30, wys: PUNKT_INFO[rodzaj].wys })].slice(0, MAX_PUNKTOW),
    }));
  return (
    <div className="kr-krok" data-krok="otoczenie">
      <h2>Okna, drzwi i instalacje</h2>
      <p className="lede">Gdzie są okna i drzwi? Przeciągnij je na rzucie albo w 3D – także na ściany C i D, gdy podasz wymiary pokoju. Pod oknem nie będzie szafek górnych ani słupków, w drzwiach – niczego.</p>
      <div className="kr-otwory">
        {wywiad.otwory.length ? null : <p className="kr-hint">Brak okien i drzwi na tych ścianach.</p>}
        {wywiad.otwory.map((o, i) => (
          <fieldset key={i} className="kr-otwor">
            <legend>
              {o.rodzaj === "okno" ? "Okno" : "Drzwi"} {i + 1}
            </legend>
            {sciany.length > 1 ? (
              <Seg
                label={`${o.rodzaj === "okno" ? "Okno" : "Drzwi"} ${i + 1}: ściana`}
                value={o.sciana}
                onChange={(v: Otwor["sciana"]) => ustawOtwor(i, { sciana: v })}
                options={sciany.map((s) => ({ value: s.id as Otwor["sciana"], label: SCIANA_LABEL[s.id].replace(" (naprzeciw ", " · nap. ").replace(")", "") }))}
              />
            ) : null}
            <div className={o.rodzaj === "okno" ? "kr-dims kr-dims-3" : "kr-dims"}>
              <PoleCm id={`k-ot-od-${i}`} label="Od narożnika" value={o.od} min={0} max={2000} onCommit={(n) => ustawOtwor(i, { od: n })} />
              <PoleCm id={`k-ot-szer-${i}`} label="Szerokość" value={o.szer} min={30} max={600} onCommit={(n) => ustawOtwor(i, { szer: n })} />
              {o.rodzaj === "okno" ? <PoleCm id={`k-ot-par-${i}`} label="Parapet od podłogi" value={o.parapet ?? 90} min={0} max={250} onCommit={(n) => ustawOtwor(i, { parapet: n })} /> : null}
            </div>
            {(() => {
              const bledy = sprawdzOtwor({ ...plan, wywiad }, i, o);
              return bledy.length ? (
                <ul className="kr-wn-bledy" role="alert">
                  {bledy.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null;
            })()}
            <button type="button" className="btn btn-plain" onClick={() => setWywiad((w) => ({ ...w, otwory: w.otwory.filter((_, j) => j !== i) }))}>
              Usuń
            </button>
          </fieldset>
        ))}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={() => dodajOtwor("okno")} disabled={wywiad.otwory.length >= 12}>
            + Okno
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => dodajOtwor("drzwi")} disabled={wywiad.otwory.length >= 12}>
            + Drzwi
          </button>
        </div>
      </div>
      <div className="kr-otwory" data-punkty>
        <span className="lab">Gniazdka i instalacje</span>
        <p className="kr-hint">Przeciągnij na rzucie albo w 3D (w 3D także w górę i w dół). Wymiary do osi puszki: od narożnika ściany i nad podłogą.</p>
        {punkty.map((p, i) => {
          const info = PUNKT_INFO[p.rodzaj];
          const bledy = sprawdzPunkt({ ...plan, wywiad }, i, p);
          const uwagi = bledy.length ? [] : uwagiPunktu({ ...plan, wywiad }, p);
          return (
            <fieldset key={i} className="kr-otwor" data-punkt={p.rodzaj}>
              <legend>
                {info.nazwa} · {i + 1}
              </legend>
              {sciany.length > 1 ? (
                <Seg
                  label={`${info.krotka} ${i + 1}: ściana`}
                  value={p.sciana}
                  onChange={(v: PunktInstalacji["sciana"]) => ustawPunkt(i, { sciana: v })}
                  options={sciany.map((s) => ({ value: s.id as PunktInstalacji["sciana"], label: SCIANA_LABEL[s.id].replace(" (naprzeciw ", " · nap. ").replace(")", "") }))}
                />
              ) : null}
              <div className="kr-dims">
                <PoleCm id={`k-pk-od-${i}`} label="Oś od narożnika" value={p.od} min={0} max={2000} onCommit={(n) => ustawPunkt(i, { od: n })} />
                <PoleCm id={`k-pk-wys-${i}`} label="Wysokość osi" value={p.wys} min={0} max={450} onCommit={(n) => ustawPunkt(i, { wys: n })} />
              </div>
              {bledy.length ? (
                <ul className="kr-wn-bledy" role="alert">
                  {bledy.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {uwagi.length ? (
                <ul className="kr-wn-ostrz">
                  {uwagi.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              <button type="button" className="btn btn-plain" onClick={() => setWywiad((w) => ({ ...w, punkty: (w.punkty ?? []).filter((_, j) => j !== i) }))}>
                Usuń
              </button>
            </fieldset>
          );
        })}
        <div className="actions">
          {RODZAJE_PUNKTOW.map((r) => (
            <button key={r} type="button" className="btn btn-ghost" onClick={() => dodajPunkt(r)} disabled={punkty.length >= MAX_PUNKTOW} title={PUNKT_INFO[r].nazwa}>
              + {PUNKT_INFO[r].krotka}
            </button>
          ))}
        </div>
        {plan.elementy.length ? (
          <div className="actions">
            <button type="button" className="btn btn-plain" onClick={() => setWywiad((w) => ({ ...w, punkty: propozycjaPunktow({ ...plan, wywiad: w }) }))}>
              Zaproponuj gniazdka do mebli i AGD
            </button>
          </div>
        ) : null}
      </div>
      {typ === "kuchnia" || typ === "lazienka" || typ === "inne" ? (
        <div className="kr-card">
          <label className="kr-check">
            <input
              type="checkbox"
              checked={!!wywiad.woda}
              onChange={(e) => setWywiad((w) => ({ ...w, woda: e.target.checked ? { sciana: "A", od: Math.round(plan.scianaA / 3) } : null }))}
            />
            Przyłącze wody i odpływ
          </label>
          {wywiad.woda ? (
            <>
              {L ? (
                <Seg
                  label="Woda: ściana"
                  value={wywiad.woda.sciana}
                  onChange={(v: Sciana) => setWywiad((w) => ({ ...w, woda: { sciana: v, od: w.woda?.od ?? 100 } }))}
                  options={[
                    { value: "A", label: "Ściana A" },
                    { value: "B", label: "Ściana B" },
                  ]}
                />
              ) : null}
              <PoleCm id="k-woda-od" label="Woda od narożnika" value={wywiad.woda.od} min={0} max={2000} onCommit={(n) => setWywiad((w) => ({ ...w, woda: { sciana: w.woda?.sciana ?? "A", od: n } }))} />
              <p className="kr-hint">{typ === "lazienka" ? "Umywalka stanie nad przyłączem." : "Zlew i zmywarka staną przy przyłączu – przesunięcie odpływu to dodatkowy koszt hydraulika."}</p>
            </>
          ) : null}
        </div>
      ) : null}
      {typ === "kuchnia" ? (
        <div className="field">
          <span className="lab">Płyta grzewcza</span>
          <Seg
            label="Płyta grzewcza"
            value={wywiad.gaz ? "gaz" : "indukcja"}
            onChange={(v) => setWywiad((w) => ({ ...w, gaz: v === "gaz" }))}
            options={[
              { value: "indukcja", label: "Indukcja (prąd 400 V)" },
              { value: "gaz", label: "Gaz" },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

function Lista<T extends string>({
  label,
  wartosci,
  opcje,
  etykiety,
  onChange,
}: {
  label: string;
  wartosci: readonly T[];
  opcje: readonly T[];
  etykiety: Record<T, string>;
  onChange: (v: T[], zmieniony: T, wlaczony: boolean) => void;
}) {
  return (
    <fieldset className="kr-lista">
      <legend>{label}</legend>
      {opcje.map((o) => (
        <label key={o} className="kr-check">
          <input type="checkbox" checked={wartosci.includes(o)} onChange={(e) => onChange(e.target.checked ? [...wartosci, o] : wartosci.filter((x) => x !== o), o, e.target.checked)} />
          {etykiety[o]}
        </label>
      ))}
    </fieldset>
  );
}

const PARY_AGD: readonly (readonly string[])[] = [
  ["zmywarka-60", "zmywarka-45"],
  ["piekarnik-slupek", "piekarnik-dolny"],
  ["lodowka-zabudowa", "lodowka-wolnostojaca"],
];

export function KrokWyposazenie({ typ, plan, wywiad, setWywiad, onPropozycja, onPrzyklad }: Wspolne & { onPropozycja: () => void; onPrzyklad: () => void }) {
  return (
    <div className="kr-krok" data-krok="wyposazenie">
      <h2>{etykietaKroku("wyposazenie", typ)}</h2>
      {typ === "kuchnia" ? (
        <>
          <Lista
            label="Urządzenia do zabudowy"
            wartosci={wywiad.agd}
            opcje={AGD_IDS}
            etykiety={AGD_LABEL}
            onChange={(agd, zmieniony, wlaczony) =>
              setWywiad((w) => {
                // Jedna zmywarka, jeden piekarnik, jedna lodówka – włączenie jednej wyłącza drugą z pary.
                const para = PARY_AGD.find((p) => p.includes(zmieniony));
                return { ...w, agd: wlaczony && para ? agd.filter((a) => a === zmieniony || !para.includes(a)) : agd };
              })
            }
          />
          <div className="field">
            <span className="lab">Szafki górne</span>
            <Seg
              label="Wysokość szafek górnych"
              value={wywiad.gorne}
              onChange={(v) => setWywiad((w) => ({ ...w, gorne: v }))}
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
            <span className="lab">Drzwi szafy</span>
            <Seg
              label="Drzwi szafy"
              value={wywiad.drzwiSzafy}
              onChange={(v) => setWywiad((w) => ({ ...w, drzwiSzafy: v }))}
              options={[
                { value: "przesuwne", label: "Przesuwne" },
                { value: "uchylne", label: "Uchylne" },
              ]}
            />
            <p className="kr-hint">Przesuwne nie zabierają miejsca przed szafą (od 100 cm szerokości, głębokość 65 cm). Uchylne – skrzydła do 60 cm.</p>
          </div>
          <Lista label="Co ma się zmieścić" wartosci={wywiad.potrzeby} opcje={POTRZEBY} etykiety={POTRZEBA_LABEL} onChange={(potrzeby) => setWywiad((w) => ({ ...w, potrzeby }))} />
        </>
      ) : typ === "komoda" ? (
        <Lista label="Meble na tej ścianie" wartosci={wywiad.meble} opcje={MEBLE_SALONU} etykiety={MEBEL_LABEL} onChange={(meble) => setWywiad((w) => ({ ...w, meble }))} />
      ) : typ === "lazienka" ? (
        <>
          <div className="field">
            <span className="lab">Szafka pod umywalkę</span>
            <Seg
              label="Szerokość szafki pod umywalkę"
              value={String(wywiad.umywalka)}
              onChange={(v) => setWywiad((w) => ({ ...w, umywalka: Number(v) }))}
              options={["60", "80", "100", "120"].map((v) => ({ value: v, label: `${v} cm` }))}
            />
          </div>
          <label className="kr-check">
            <input type="checkbox" checked={wywiad.slupek} onChange={(e) => setWywiad((w) => ({ ...w, slupek: e.target.checked }))} />
            Słupek łazienkowy 40 cm (ręczniki, kosmetyki)
          </label>
        </>
      ) : (
        <p className="lede">Dodaj elementy z katalogu po lewej – każdy otworzy okno z wymiarami i wnętrzem.</p>
      )}
      {typ !== "inne" ? (
        <div className="kr-card">
          <p className="lede">
            {plan.elementy.length
              ? "Propozycja zastąpi obecne elementy. Potem wszystko poprawisz na rzucie i w oknie elementu."
              : "Z odpowiedzi ułożymy pierwszy układ – potem dopracujesz go na rzucie."}
          </p>
          <div className="actions">
            <button type="button" className="btn btn-ink" onClick={onPropozycja}>
              Ułóż propozycję
            </button>
            {typ === "kuchnia" ? (
              <button type="button" className="btn btn-ghost" onClick={onPrzyklad}>
                Wstaw przykład
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
