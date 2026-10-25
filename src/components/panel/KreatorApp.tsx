"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COUNTERTOPS } from "../catalog";
import { FRONTS } from "../frontStore";
import { HARDWARE } from "../hardwareStore";
import { setCountertop } from "../countertopStore";
import { setFront } from "../frontStore";
import { setHardware } from "../hardwareStore";
import { setPalettes as setPaletteStore } from "../paletteStore";
import { paletteFronts, type Palette } from "../palettes";
import { formatPln, totalPrice } from "../pricing";
import {
  MAX_MODULY,
  MODUL_LIMITS,
  modulCena,
} from "@/lib/modul";
import {
  bazaKuchni,
  dodajElement,
  opiszKolizje,
  parseKuchnia,
  PRESETY,
  pustyPlan,
  STREFA_LABEL,
  UKLAD_KUCHNI_LABEL,
  wstawPrzyklad,
  wystajePozaSciany,
  type ElementKuchni,
  type Obrot,
  type PlanKuchni,
  type Sciana,
  type Strefa,
  type UkladKuchni,
} from "@/lib/kuchnia";
import KuchniaTlo, { type KuchniaUjecie } from "../kuchnia/KuchniaTlo";
import RzutKuchni from "../kuchnia/RzutKuchni";
import { LoginDialog, LogoutButton, PanelBrand } from "./PanelGate";
import { OfertaPdfPrzyciski } from "./OfertaPdfPrzyciski";
import { Seg, Toaster, Tooltips, toast } from "./ui";
import { useCennik } from "./useCennik";
import {
  ApiError,
  assetsApi,
  forgetLogin,
  hasLogin,
  offerKey,
  panelApi,
  toPublicModel,
  type DomainView,
  type ModelMeta,
} from "./offerApi";
import {
  dayPlus,
  daysFromNowIso,
  loadOffers,
  newSlug,
  nextOfferId,
  offerMessage,
  saveOffers,
  sendHref,
  stamp,
  type Channel,
  type Offer,
  type OfferEvent,
} from "./offers";

const GRUPY: { strefa: Strefa; label: string }[] = [
  { strefa: "dolna", label: "Szafki dolne" },
  { strefa: "gorna", label: "Szafki górne" },
  { strefa: "wysoka", label: "Słupki" },
];

function useWaski() {
  const [waski, setWaski] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const on = () => setWaski(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return waski;
}

export default function KreatorApp() {
  const [auth, setAuth] = useState(false);
  const [gotowe, setGotowe] = useState(false);
  const [lokalnie, setLokalnie] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [istniejace, setIstniejace] = useState<Offer[]>([]);
  const [plan, setPlan] = useState<PlanKuchni>(() => pustyPlan("ciag"));
  const [client, setClient] = useState("");
  const [contact, setContact] = useState("");
  const [title, setTitle] = useState("");
  const [front, setFrontId] = useState(FRONTS[0].id);
  const [countertop, setCountertopId] = useState(COUNTERTOPS[0].id);
  const [hardware, setHardwareId] = useState(HARDWARE[0].id);
  const [sciana, setSciana] = useState<Sciana>("A");
  const [zaznaczony, setZaznaczony] = useState<string | null>(null);
  const [models, setModels] = useState<ModelMeta[]>([]);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [domain, setDomain] = useState<DomainView | null>(null);
  const [origin, setOrigin] = useState("");
  const [zapisuje, setZapisuje] = useState(false);
  const [zakladka, setZakladka] = useState<"rzut" | "3d">("rzut");
  const waski = useWaski();
  const { cennik, blad: cennikBlad } = useCennik();
  const ujecie = useRef<KuchniaUjecie | null>(null);
  const ustawUjecie = useCallback((u: KuchniaUjecie | null) => {
    ujecie.current = u;
  }, []);

  const wczytajOferte = useCallback((o: Offer) => {
    setOffer(o);
    setPlan(o.kuchnia ?? pustyPlan(o.layout === "L" ? "L" : "ciag"));
    setClient(o.client);
    setContact(o.contact);
    setTitle(o.title);
    setFrontId(o.front);
    setCountertopId(o.countertop);
    setHardwareId(o.hardware);
  }, []);

  const wczytaj = useCallback(async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!hasLogin() && process.env.NODE_ENV !== "development") {
      setAuth(true);
      setGotowe(true);
      return;
    }
    try {
      const [list, modele, pakiety, domena] = await Promise.all([
        panelApi.list(),
        assetsApi.models().catch(() => [] as ModelMeta[]),
        assetsApi.palettes().catch(() => [] as Palette[]),
        assetsApi.domain().catch(() => null),
      ]);
      setIstniejace(list);
      setModels(modele);
      setPalettes(pakiety);
      setDomain(domena);
      setLokalnie(false);
      if (id) {
        const found = list.find((o) => offerKey(o.id) === id || o.id === id);
        if (found) wczytajOferte(found);
        else toast("Nie ma takiej oferty", { type: "err", desc: "Zaczynam nową kuchnię." });
      }
      setAuth(false);
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      if (err?.status === 401) {
        forgetLogin();
        setAuth(true);
      } else if (err?.code === "no_api" && process.env.NODE_ENV === "development") {
        const list = loadOffers() ?? [];
        setIstniejace(list);
        setLokalnie(true);
        if (id) {
          const found = list.find((o) => offerKey(o.id) === id || o.id === id);
          if (found) wczytajOferte(found);
        }
      } else {
        toast("Nie wczytano kreatora", { type: "err", desc: err?.message ?? "Sprawdź połączenie." });
      }
    } finally {
      setGotowe(true);
    }
  }, [wczytajOferte]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void wczytaj();
  }, [wczytaj]);

  useEffect(() => {
    setFront(front);
    setCountertop(countertop);
    setHardware(hardware);
    setPaletteStore(palettes);
  }, [front, countertop, hardware, palettes]);

  const element = plan.elementy.find((e) => e.id === zaznaczony) ?? null;
  const suma = bazaKuchni(plan, cennik);
  const razem = totalPrice({ front, countertop, hardware }, suma || 0, palettes);
  const modeleSceny = useMemo(
    () => models.filter((m) => plan.elementy.some((e) => e.modelId === m.id)).map(toPublicModel),
    [models, plan.elementy],
  );
  const linkOrigin = domain?.active && domain.domain ? `https://${domain.domain.hostname}` : origin;
  const linkUrl = offer?.link ? `${linkOrigin}/oferta/${offer.link.slug}` : null;
  const ral = paletteFronts(palettes);

  const zmien = (fn: (p: PlanKuchni) => PlanKuchni) => setPlan((p) => fn(p));

  const dodaj = (bazowy: Parameters<typeof dodajElement>[1]) => {
    if (plan.elementy.length >= MAX_MODULY) {
      toast("Limit szafek", { type: "err", desc: `W jednej kuchni zmieści się ${MAX_MODULY} elementów.` });
      return;
    }
    const next = dodajElement(plan, bazowy, sciana);
    setPlan(next);
    setZaznaczony(next.elementy[next.elementy.length - 1]?.id ?? null);
  };

  const aktualizujElement = (id: string, fn: (e: ElementKuchni) => ElementKuchni) => {
    const el = plan.elementy.find((e) => e.id === id);
    if (!el) return;
    const nextEl = fn(el);
    const next = {
      ...plan,
      elementy: plan.elementy.map((e) => (e.id === id ? { ...nextEl, nazwa: nextEl.nazwa.trim() || "Szafka" } : { ...e, nazwa: e.nazwa.trim() || "Szafka" })),
    };
    const opis = opiszKolizje(next);
    if (opis) {
      toast("Szafki nachodzą na siebie", { type: "err", desc: opis });
      return;
    }
    try {
      setPlan(parseKuchnia(next));
    } catch (e) {
      toast("Nie da się tak ustawić", { type: "err", desc: e instanceof Error ? e.message : "" });
    }
  };

  const wyslijNaSerwer = async (o: Offer, nowa: boolean) => {
    try {
      return nowa ? await panelApi.create(o) : await panelApi.update(o);
    } catch (e) {
      if (e instanceof ApiError && e.code === "no_api" && process.env.NODE_ENV === "development") {
        const saved: Offer = { ...o, updatedAt: new Date().toISOString(), createdAt: o.createdAt ?? new Date().toISOString() };
        const list = loadOffers() ?? [];
        const i = list.findIndex((x) => x.id === saved.id);
        if (i >= 0) list[i] = saved;
        else list.unshift(saved);
        saveOffers(list);
        setIstniejace(list);
        setLokalnie(true);
        return saved;
      }
      throw e;
    }
  };

  const zloz = (parsed: PlanKuchni): Offer => {
    const base = bazaKuchni(parsed, cennik);
    const wspolne = {
      title: title.trim(),
      client: client.trim(),
      contact: contact.trim(),
      layout: parsed.uklad === "L" ? ("L" as const) : ("I" as const),
      base,
      front,
      countertop,
      hardware,
      kuchnia: parsed,
      moduly: parsed.elementy.map((e) => ({ nazwa: e.nazwa, w: e.w, h: e.h, d: e.d })),
    };
    if (offer) {
      const reszta: Offer = { ...offer };
      delete reszta.modelId;
      const zdarzenie: OfferEvent = { t: stamp(), k: "edit", x: "Zapis z kreatora kuchni" };
      return {
        ...reszta,
        ...wspolne,
        events: [...offer.events, zdarzenie].slice(-400),
      };
    }
    const imie = client.trim().split(/\s+/)[0] || "";
    return {
      id: nextOfferId(istniejace),
      ...wspolne,
      greet: imie || null,
      status: "szkic",
      link: null,
      events: [{ t: stamp(), k: "create", x: "Oferta z kreatora kuchni" }],
    };
  };

  const zapisz = async () => {
    if (!client.trim() || !title.trim()) {
      toast("Uzupełnij klienta i nazwę", { type: "err" });
      return null;
    }
    if (!plan.elementy.length) {
      toast("Dodaj choć jedną szafkę", { type: "err" });
      return null;
    }
    let parsed: PlanKuchni;
    try {
      parsed = parseKuchnia({
        ...plan,
        elementy: plan.elementy.map((e) => ({ ...e, nazwa: e.nazwa.trim() || "Szafka" })),
      });
    } catch (e) {
      toast("Układ do poprawy", { type: "err", desc: e instanceof Error ? e.message : "" });
      return null;
    }
    setZapisuje(true);
    try {
      const saved = await wyslijNaSerwer(zloz(parsed), !offer);
      setOffer(saved);
      setIstniejace((list) => {
        const i = list.findIndex((o) => o.id === saved.id);
        if (i >= 0) return list.map((o) => (o.id === saved.id ? saved : o));
        return [saved, ...list];
      });
      const url = new URL(window.location.href);
      url.searchParams.set("id", offerKey(saved.id));
      window.history.replaceState(null, "", url);
      toast("Oferta zapisana", {
        desc: lokalnie ? `${saved.id} · tylko w tej przeglądarce` : `${saved.id} · szafki ${formatPln(saved.base)} netto`,
      });
      return saved;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        forgetLogin();
        setAuth(true);
      }
      toast("Nie zapisano oferty", { type: "err", desc: e instanceof Error ? e.message : "" });
      return null;
    } finally {
      setZapisuje(false);
    }
  };

  const utworzLink = async () => {
    const saved = offer?.link ? offer : await zapisz();
    if (!saved) return;
    if (saved.link) return;
    if (!saved.contact.trim()) {
      toast("Brakuje kontaktu", { type: "err", desc: "Wpisz e-mail albo telefon, żeby wysłać podgląd 3D." });
      return;
    }
    const channel: Channel = saved.contact.includes("@") ? "email" : "sms";
    const link = {
      slug: newSlug(),
      days: 14,
      expires: dayPlus(14),
      expiresAt: daysFromNowIso(14),
      pin: null,
      comments: true,
      showPrice: true,
      channel,
      views: 0 as const,
    };
    const next: Offer = {
      ...saved,
      link,
      status: saved.status === "zaakceptowany" ? saved.status : "wyslany",
      events: [...saved.events, { t: stamp(), k: "send", x: "Link 3D z kreatora · 14 dni" }],
    };
    setZapisuje(true);
    try {
      const out = await wyslijNaSerwer(next, false);
      setOffer(out);
      toast("Link 3D gotowy", { desc: "Wyślij go osobno od PDF. PIN i ważność zmienisz w panelu oferty." });
    } catch (e) {
      toast("Nie utworzono linku", { type: "err", desc: e instanceof Error ? e.message : "" });
    } finally {
      setZapisuje(false);
    }
  };

  const wyslij3d = () => {
    if (!offer?.link) return;
    const tekst = offerMessage(offer, linkOrigin, offer.link.channel);
    const href = sendHref(offer, offer.link.channel, tekst);
    if (href) window.location.href = href;
    else void navigator.clipboard.writeText(tekst).then(() => toast("Wiadomość 3D skopiowana"));
  };

  const przyklad = () => {
    if (plan.elementy.length && !window.confirm("Zastąpić obecne szafki układem przykładowym?")) return;
    setPlan(wstawPrzyklad(plan.uklad));
    setZaznaczony(null);
  };

  return (
    <div className="pnl kreator">
      <header className="top">
        <a className="btn btn-plain" href="/panel" aria-label="Wróć do ofert">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <PanelBrand />
        <div className="crumb">
          <span>/</span>
          <b>Kreator kuchni</b>
        </div>
        <span className="grow" />
        {lokalnie ? <span className="sample">Dane demo</span> : null}
        <button type="button" className="btn btn-ink" disabled={zapisuje || auth} onClick={() => void zapisz()}>
          Zapisz ofertę
        </button>
        <LogoutButton />
      </header>

      {!gotowe ? <p className="lede kr-wait">Wczytywanie kreatora…</p> : null}

      {gotowe && !auth ? (
        <div className="kr-body">
          <aside className="kr-col kr-catalog" aria-label="Katalog elementów">
            <div className="kr-pad">
              <h2>Katalog</h2>
              <p className="lede">Klik dodaje szafkę na końcu ściany {sciana === "B" && plan.uklad === "L" ? "B" : "A"}.</p>
              <Seg
                label="Ściana"
                value={plan.uklad === "L" ? sciana : "A"}
                onChange={(v) => setSciana(v)}
                options={
                  plan.uklad === "L"
                    ? [
                        { value: "A", label: "Ściana A" },
                        { value: "B", label: "Ściana B" },
                      ]
                    : [{ value: "A", label: "Ściana A" }]
                }
              />
              {GRUPY.map((g) => (
                <div key={g.strefa} className="kr-group">
                  <h3>{g.label}</h3>
                  {PRESETY.filter((p) => p.strefa === g.strefa).map((p) => (
                    <button key={p.id} type="button" className="kr-item" onClick={() => dodaj({ ...p, zrodlo: "modul" })}>
                      <b>{p.nazwa}</b>
                      <span className="mono">
                        {p.w}×{p.h}×{p.d}
                        {cennik ? ` · ${formatPln(modulCena(p, cennik))}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              <div className="kr-group">
                <h3>Modele firmy</h3>
                {models.length ? (
                  models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="kr-item"
                      onClick={() =>
                        dodaj({
                          nazwa: m.name.slice(0, 80) || "Model",
                          strefa: "dolna",
                          w: 60,
                          h: 72,
                          d: 56,
                          zrodlo: "model",
                          modelId: m.id,
                        })
                      }
                    >
                      <b>{m.name}</b>
                      <span className="mono">GLB · 60×72×56, skalowane</span>
                    </button>
                  ))
                ) : (
                  <p className="lede">
                    Brak wgranych modeli. Szafki powyżej wystarczą do oferty. Własne GLB dodasz w{" "}
                    <a href="/panel/ustawienia?tab=models">Ustawieniach → Modele 3D</a>.
                  </p>
                )}
              </div>
            </div>
          </aside>

          <section className="kr-col kr-stage" aria-label="Rzut i podgląd 3D">
            {waski ? (
              <div className="kr-tabs">
                <button type="button" className="btn btn-ghost" aria-pressed={zakladka === "rzut"} onClick={() => setZakladka("rzut")}>
                  Rzut
                </button>
                <button type="button" className="btn btn-ghost" aria-pressed={zakladka === "3d"} onClick={() => setZakladka("3d")}>
                  Podgląd 3D
                </button>
              </div>
            ) : null}
            {(!waski || zakladka === "rzut") && (
              <div className="kr-plan">
                <RzutKuchni
                  plan={plan}
                  zaznaczony={zaznaczony}
                  onWybierz={setZaznaczony}
                  onPrzesun={(id, x, z) => zmien((p) => ({ ...p, elementy: p.elementy.map((e) => (e.id === id ? { ...e, x, z } : e)) }))}
                  onKolizja={() => toast("Szafki nachodzą na siebie", { type: "err", desc: "Zostawiam poprzednie miejsce." })}
                />
                <p className="kr-legend">
                  <i data-zone="dolna" /> dolna <i data-zone="gorna" /> górna <i data-zone="wysoka" /> słupek <i data-zone="front" /> front
                </p>
              </div>
            )}
            {(!waski || zakladka === "3d") && (
              <div className="kr-view3d">
                <KuchniaTlo
                  plan={plan}
                  modele={modeleSceny}
                  zaznaczony={zaznaczony}
                  onWybierz={setZaznaczony}
                  zdjecie
                  onUjecie={ustawUjecie}
                />
              </div>
            )}
          </section>

          <aside className="kr-col kr-side" aria-label="Dane oferty i cena">
            <div className="kr-pad">
              <h2>Oferta</h2>
              <div className="field">
                <label htmlFor="k-client">Klient</label>
                <input id="k-client" className="input" value={client} onChange={(e) => setClient(e.target.value)} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="k-contact">E-mail lub telefon</label>
                <input id="k-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="k-title">Nazwa oferty</label>
                <input id="k-title" className="input" value={title} placeholder="Np. Kuchnia w ciągu, dąb" onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <span className="lab">Układ</span>
                <Seg
                  label="Układ zabudowy"
                  value={plan.uklad}
                  onChange={(v) => {
                    setPlan((p) => ({ ...p, uklad: v }));
                    if (v === "ciag") setSciana("A");
                  }}
                  options={(Object.keys(UKLAD_KUCHNI_LABEL) as UkladKuchni[]).map((u) => ({ value: u, label: UKLAD_KUCHNI_LABEL[u] }))}
                />
              </div>
              <div className="kr-dims">
                <label>
                  Ściana A (cm)
                  <input className="input" inputMode="numeric" min={80} max={1200} value={plan.scianaA} onChange={(e) => setPlan((p) => ({ ...p, scianaA: Number(e.target.value) || p.scianaA }))} />
                </label>
                {plan.uklad === "L" ? (
                  <label>
                    Ściana B (cm)
                    <input className="input" inputMode="numeric" min={80} max={1200} value={plan.scianaB} onChange={(e) => setPlan((p) => ({ ...p, scianaB: Number(e.target.value) || p.scianaB }))} />
                  </label>
                ) : null}
              </div>
              <label className="kr-check">
                <input
                  type="checkbox"
                  checked={!!plan.pomieszczenie}
                  onChange={(e) =>
                    setPlan((p) => ({
                      ...p,
                      pomieszczenie: e.target.checked
                        ? { szer: Math.min(2000, Math.max(120, p.scianaA + 80)), dlug: Math.min(2000, Math.max(120, p.scianaB + 80)) }
                        : null,
                    }))
                  }
                />
                Pokaż pomieszczenie
              </label>
              {plan.pomieszczenie ? (
                <div className="kr-dims">
                  <label>
                    Szer. (cm)
                    <input
                      className="input"
                      inputMode="numeric"
                      value={plan.pomieszczenie.szer}
                      onChange={(e) =>
                        setPlan((p) => ({ ...p, pomieszczenie: { szer: Number(e.target.value) || 120, dlug: p.pomieszczenie?.dlug ?? 200 } }))
                      }
                    />
                  </label>
                  <label>
                    Dł. (cm)
                    <input
                      className="input"
                      inputMode="numeric"
                      value={plan.pomieszczenie.dlug}
                      onChange={(e) =>
                        setPlan((p) => ({ ...p, pomieszczenie: { szer: p.pomieszczenie?.szer ?? 200, dlug: Number(e.target.value) || 120 } }))
                      }
                    />
                  </label>
                </div>
              ) : null}
              <button type="button" className="btn btn-ghost" onClick={przyklad}>
                Wstaw przykład
              </button>
              {wystajePozaSciany(plan) ? <p className="kr-warn">Część szafek wystaje poza długość ścian. Wydłuż ścianę albo przysuń je.</p> : null}

              {element ? (
                <div className="kr-card">
                  <h3>Zaznaczona szafka</h3>
                  <label>
                    Nazwa
                    <input
                    className="input"
                    value={element.nazwa}
                    maxLength={80}
                    onChange={(e) => {
                      const nazwa = e.target.value.slice(0, 80);
                      setPlan((p) => ({ ...p, elementy: p.elementy.map((el) => (el.id === element.id ? { ...el, nazwa } : el)) }));
                    }}
                  />
                  </label>
                  <div className="kr-dims">
                    {(["w", "h", "d"] as const).map((k) => (
                      <label key={k}>
                        {k === "w" ? "Szer." : k === "h" ? "Wys." : "Gł."}
                        <input
                          className="input"
                          inputMode="numeric"
                          min={MODUL_LIMITS[k].min}
                          max={MODUL_LIMITS[k].max}
                          value={element[k]}
                          onChange={(e) => {
                            const n = Math.round(Number(e.target.value));
                            if (!Number.isFinite(n)) return;
                            const v = Math.min(MODUL_LIMITS[k].max, Math.max(MODUL_LIMITS[k].min, n));
                            aktualizujElement(element.id, (el) => ({ ...el, [k]: v }));
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => aktualizujElement(element.id, (el) => ({ ...el, rot: (((el.rot + 90) % 360) as Obrot) }))}
                    >
                      Obróć 90°
                    </button>
                    <button
                      type="button"
                      className="btn btn-plain"
                      onClick={() => {
                        setPlan((p) => ({ ...p, elementy: p.elementy.filter((e) => e.id !== element.id) }));
                        setZaznaczony(null);
                      }}
                    >
                      Usuń
                    </button>
                  </div>
                  <p className="lede">
                    {STREFA_LABEL[element.strefa]}
                    {element.zrodlo === "model" ? " · model 3D" : " · moduł"} · {formatPln(modulCena(element, cennik))}
                  </p>
                </div>
              ) : (
                <p className="lede">Kliknij szafkę na rzucie, żeby zmienić wymiary albo ją obrócić. Strzałki przesuwają o 5 cm.</p>
              )}

              <div className="field">
                <span className="lab">Fronty</span>
                <div className="swatches" role="radiogroup" aria-label="Fronty">
                  {[...FRONTS, ...ral].map((f) => (
                    <button key={f.id} type="button" className="sw" role="radio" aria-checked={front === f.id} aria-label={f.name} data-tip={f.name} onClick={() => setFrontId(f.id)}>
                      <span style={{ background: f.color }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="lab">Blat</span>
                <Seg label="Blat" value={countertop} onChange={setCountertopId} options={COUNTERTOPS.map((c) => ({ value: c.id, label: c.name }))} />
              </div>
              <div className="field">
                <span className="lab">Okucia</span>
                <Seg label="Okucia" value={hardware} onChange={setHardwareId} options={HARDWARE.map((h) => ({ value: h.id, label: h.name }))} />
              </div>

              <div className="kr-sum">
                <p>
                  Szafki netto <b>{plan.elementy.length ? formatPln(suma) : "—"}</b>
                </p>
                <p>
                  Z dopłatami za materiały <b>{plan.elementy.length ? formatPln(razem) : "—"}</b>
                </p>
                <p className="lede">
                  {cennikBlad
                    ? "Cennik firmy się nie wczytał — kwota jest orientacyjna (cennik domyślny). Zapis na serwerze i tak policzy cenę sam."
                    : "Cenę pozycji liczy serwer z cennika modułów. Tu jest ten sam wzór, żeby było widać sumę przed zapisem."}
                </p>
              </div>

              <section className="kr-card">
                <h3>Oferta PDF</h3>
                <p className="lede">Handlowa: pozycje, wymiary i ceny. Osobno od linku 3D. W oknie drukowania wybierz „Zapisz jako PDF”.</p>
                <OfertaPdfPrzyciski
                  id={offer?.id ?? "SZKIC"}
                  title={title}
                  client={client}
                  contact={contact}
                  plan={plan}
                  front={front}
                  countertop={countertop}
                  hardware={hardware}
                  palettes={palettes}
                  linkUrl={linkUrl}
                  ujecie={ujecie}
                />
              </section>

              <section className="kr-card">
                <h3>Podgląd 3D</h3>
                <p className="lede">Link jak przy zwykłej ofercie. Klient obraca kuchnię i zmienia front, blat i okucia.</p>
                {linkUrl ? (
                  <>
                    <input className="input" readOnly value={linkUrl} aria-label="Link podglądu 3D" />
                    <div className="actions">
                      <button type="button" className="btn btn-ink" onClick={wyslij3d}>
                        Wyślij podgląd 3D
                      </button>
                      <a className="btn btn-ghost" href={`/panel`}>
                        Otwórz w panelu
                      </a>
                    </div>
                  </>
                ) : (
                  <button type="button" className="btn btn-ink" disabled={zapisuje} onClick={() => void utworzLink()}>
                    Utwórz link 3D
                  </button>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      {auth ? <LoginDialog error="" onLoggedIn={() => void wczytaj()} /> : null}
      <Tooltips />
      <Toaster />
    </div>
  );
}
