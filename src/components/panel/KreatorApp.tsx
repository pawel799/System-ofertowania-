"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COUNTERTOPS } from "../catalog";
import { FRONTS } from "../frontStore";
import { HARDWARE } from "../hardwareStore";
import { setCountertop } from "../countertopStore";
import { setFront } from "../frontStore";
import { setHardware } from "../hardwareStore";
import { setPalettes as setPaletteStore } from "../paletteStore";
import { setKatalog as setKatalogStore, useKatalog } from "../katalogStore";
import { opcjeMaterialu, type KatalogPozycja } from "../katalogFirmy";
import type { Palette } from "../palettes";
import { formatPln, totalPrice } from "../pricing";
import { GRUPY_BIBLIOTEKI, podzielModele, type GrupaBiblioteki } from "@/lib/bibliotekaModeli";
import { GRUPY_TYPU, parseTypProjektu, TYP_PROJEKTU, type TypProjektu } from "@/lib/projekt";
import { MAX_MODULY, modulCena, type ModulCennik } from "@/lib/modul";
import {
  bazaKuchni,
  cenaElementu,
  dociagnijRzad,
  dodajElement,
  GRUPY_PRESETOW,
  opiszKolizje,
  parseKuchnia,
  pozycjeKuchni,
  PRESETY,
  pustyPlan,
  type NowyElement,
  wstawPrzyklad,
  wstawPrzykladMebli,
  wystajePozaSciany,
  wycenianyElement,
  zmienWymiar,
  type ElementKuchni,
  type Obrot,
  type PlanKuchni,
  type Sciana,
} from "@/lib/kuchnia";
import KuchniaTlo, { type KuchniaUjecie } from "../kuchnia/KuchniaTlo";
import RzutKuchni from "../kuchnia/RzutKuchni";
import PrzyciskOtwarcia from "../kuchnia/PrzyciskOtwarcia";
import { LoginDialog, LogoutButton, PanelBrand } from "./PanelGate";
import { linkWygasl, OfertaPdfPrzyciski, waznyDo, type LinkDoPdf } from "./OfertaPdfPrzyciski";
import { Seg, Toaster, Tooltips, toast } from "./ui";
import { KreatorWlasciwosci } from "./KreatorWlasciwosci";
import { useCennik } from "./useCennik";
import { KreatorBiblioteka } from "./KreatorBiblioteka";
import { KreatorWnetrze, type ElementOkna } from "./KreatorWnetrze";
import { etykietaKroku, KROKI, KrokOtoczenie, KrokPomieszczenie, KrokWyposazenie, PasekKrokow, type Krok } from "./KreatorKroki";
import { KreatorSamouczek, samouczekWidziany } from "./KreatorSamouczek";
import { AGD_LABEL, wywiadDomyslny, type Wywiad } from "@/lib/wywiad";
import { ulozPropozycje } from "@/lib/propozycja";
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
  const [zaznaczony, ustawZaznaczony] = useState<string | null>(null);
  /** Krok kreatora: pomieszczenie → okna i instalacje → wyposażenie → meble → materiały → oferta. */
  const [krok, setKrok] = useState<Krok>("pomieszczenie");
  const [samouczek, setSamouczek] = useState(false);
  // Zaznaczenie mebla (rzut, 3D, lista) przenosi do kroku „Meble”, gdzie są jego właściwości.
  const setZaznaczony = useCallback((id: string | null) => {
    ustawZaznaczony(id);
    if (id) setKrok("meble");
  }, []);
  const [models, setModels] = useState<ModelMeta[]>([]);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [domain, setDomain] = useState<DomainView | null>(null);
  const [origin, setOrigin] = useState("");
  const [zapisuje, setZapisuje] = useState(false);
  const [zakladka, setZakladka] = useState<"rzut" | "3d">("rzut");
  const [wymiary, setWymiary] = useState(true);
  const [szukaj, setSzukaj] = useState("");
  /** Co projektujemy – od tego zależą grupy katalogu (reszta po „Pokaż wszystkie”). */
  const [typ, setTyp] = useState<TypProjektu>("kuchnia");
  const [wszystkieGrupy, setWszystkieGrupy] = useState(false);
  const [biblioteka, setBiblioteka] = useState(false);
  /** Okno elementu: przed dodaniem z katalogu (nowy) albo zmiana zaznaczonego (edycja). */
  const [okno, setOkno] = useState<{ tryb: "nowy"; el: ElementOkna } | { tryb: "edycja"; id: string } | null>(null);
  const otworzNowy = useCallback((el: ElementOkna) => setOkno({ tryb: "nowy", el }), []);
  const zamknijBiblioteke = useCallback(() => setBiblioteka(false), []);
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
    setTyp(o.projekt ?? "kuchnia");
    // Zapisana oferta: projekt już jest – zaczynamy od mebli.
    setKrok("meble");
  }, []);

  const wczytaj = useCallback(async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!hasLogin() && process.env.NODE_ENV !== "development") {
      setAuth(true);
      setGotowe(true);
      return;
    }
    try {
      const [list, modele, pakiety, domena, katalogFirmy] = await Promise.all([
        panelApi.list(),
        assetsApi.models().catch(() => [] as ModelMeta[]),
        assetsApi.palettes().catch(() => [] as Palette[]),
        assetsApi.domain().catch(() => null),
        assetsApi.katalog().catch(() => [] as KatalogPozycja[]),
      ]).then((r) => {
        setKatalogStore(r[4]);
        return [r[0], r[1], r[2], r[3], r[4]] as const;
      });
      setIstniejace(list);
      setModels(modele);
      setPalettes(pakiety);
      setDomain(domena);
      setLokalnie(false);
      const found = id ? list.find((o) => offerKey(o.id) === id || o.id === id) : undefined;
      if (found) wczytajOferte(found);
      else {
        // Nowa oferta z panelu: /panel/kreator?typ=szafa. Pierwszy raz – samouczek.
        setTyp(parseTypProjektu(new URLSearchParams(window.location.search).get("typ")) ?? "kuchnia");
        if (!samouczekWidziany()) setSamouczek(true);
        if (id) toast("Nie ma takiej oferty", { type: "err", desc: "Zaczynam nową kuchnię." });
        // Nowa kuchnia: materiały startowe z katalogu firmy (gdy go ma), inaczej zestaw wbudowany.
        const kat = { palettes: pakiety, katalog: katalogFirmy };
        setFrontId(opcjeMaterialu("front", kat)[0]?.id ?? FRONTS[0].id);
        setCountertopId(opcjeMaterialu("countertop", kat)[0]?.id ?? COUNTERTOPS[0].id);
        setHardwareId(opcjeMaterialu("hardware", kat)[0]?.id ?? HARDWARE[0].id);
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
  const wywiad: Wywiad = plan.wywiad ?? wywiadDomyslny(typ);
  const setWywiad = (fn: (w: Wywiad) => Wywiad) => setPlan((p) => ({ ...p, wywiad: fn(p.wywiad ?? wywiadDomyslny(typ)) }));
  const indeksKroku = KROKI.indexOf(krok);
  const gotoweKroki = new Set<Krok>([
    ...(plan.wywiad ? (["pomieszczenie", "otoczenie"] as Krok[]) : []),
    ...(plan.elementy.length ? (["wyposazenie", "meble"] as Krok[]) : []),
    ...(offer ? (["materialy", "oferta"] as Krok[]) : []),
  ]);
  const suma = bazaKuchni(plan, cennik);
  const katalog = useKatalog();
  const razem = totalPrice({ front, countertop, hardware }, suma || 0, palettes, { katalog });
  const kCtx = { palettes, katalog };
  const modeleSceny = useMemo(
    () => models.filter((m) => plan.elementy.some((e) => e.modelId === m.id)).map(toPublicModel),
    [models, plan.elementy],
  );
  const linkOrigin = domain?.active && domain.domain ? `https://${domain.domain.hostname}` : origin;
  const linkUrl = offer?.link ? `${linkOrigin}/oferta/${offer.link.slug}` : null;

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

  /** Zapis z okna elementu: zamiana modelu na moduł, wymiary (rząd dosuwa się jak przy edycji), na końcu wnętrze. */
  const zapiszElement = (id: string, nowy: ElementOkna) => {
    const el = plan.elementy.find((e) => e.id === id);
    if (!el) return false;
    let p: PlanKuchni = plan;
    if (nowy.zrodlo !== el.zrodlo || nowy.rodzaj !== el.rodzaj || nowy.strefa !== el.strefa) {
      p = {
        ...p,
        elementy: p.elementy.map((e) => {
          if (e.id !== id) return e;
          const out: ElementKuchni = { ...e, zrodlo: nowy.zrodlo, rodzaj: nowy.rodzaj, strefa: nowy.strefa };
          if (nowy.zrodlo === "modul") delete out.modelId;
          return out;
        }),
      };
    }
    for (const key of ["w", "h", "d"] as const) {
      const teraz = p.elementy.find((e) => e.id === id);
      if (!teraz || teraz[key] === nowy[key]) continue;
      const n = zmienWymiar(p, id, key, nowy[key]);
      if (!n) {
        toast("Nie da się tak zmienić wymiaru", { type: "err", desc: "Sąsiad wszedłby na inny element. Odsuń go albo zmniejsz wymiar." });
        return false;
      }
      p = n;
    }
    p = {
      ...p,
      elementy: p.elementy.map((e) => {
        if (e.id !== id) return e;
        const out: ElementKuchni = { ...e, nazwa: nowy.nazwa.trim() || e.nazwa };
        if (nowy.wnetrze && nowy.zrodlo === "modul") out.wnetrze = nowy.wnetrze;
        else delete out.wnetrze;
        return out;
      }),
    };
    try {
      setPlan(parseKuchnia(p));
      return true;
    } catch (e) {
      toast("Nie da się tak ustawić", { type: "err", desc: e instanceof Error ? e.message : "" });
      return false;
    }
  };

  const ustawWymiar = (id: string, key: "w" | "h" | "d", value: number) => {
    const next = zmienWymiar(plan, id, key, value);
    if (!next) {
      toast("Nie da się tak zmienić wymiaru", { type: "err", desc: "Sąsiad wszedłby na inny element. Odsuń go albo skróć wymiar." });
      return false;
    }
    setPlan(next);
    return true;
  };

  const dociagnij = (id: string) => {
    const next = dociagnijRzad(plan, id);
    if (!next) {
      toast("Nie zsunięto rzędu", { type: "err", desc: "Po zsunięciu elementy nachodzą na siebie." });
      return;
    }
    if (next === plan) {
      toast("Rząd już jest dosunięty");
      return;
    }
    setPlan(next);
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
      moduly: pozycjeKuchni(parsed),
      projekt: typ,
    };
    if (offer) {
      const reszta: Offer = { ...offer };
      delete reszta.modelId;
      const zdarzenie: OfferEvent = { t: stamp(), k: "edit", x: `Zapis z kreatora (${TYP_PROJEKTU[typ].label.toLowerCase()})` };
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
      events: [{ t: stamp(), k: "create", x: `Oferta z kreatora (${TYP_PROJEKTU[typ].label.toLowerCase()})` }],
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

  /** Nowy link 3D na 14 dni (PIN i ważność zmienisz w panelu oferty). */
  const zNowymLinkiem = (saved: Offer, opis: string): Offer => {
    const link = {
      slug: newSlug(),
      days: 14,
      expires: dayPlus(14),
      expiresAt: daysFromNowIso(14),
      pin: null,
      comments: true,
      showPrice: true,
      channel: (saved.contact.includes("@") || !saved.contact.trim() ? "email" : "sms") as Channel,
      views: 0 as const,
    };
    return {
      ...saved,
      link,
      status: saved.status === "zaakceptowany" ? saved.status : "wyslany",
      events: [...saved.events, { t: stamp(), k: "send", x: opis }],
    };
  };

  const utworzLink = async () => {
    const saved = offer?.link ? offer : await zapisz();
    if (!saved) return;
    if (saved.link) return;
    if (!saved.contact.trim()) {
      toast("Brakuje kontaktu", { type: "err", desc: "Wpisz e-mail albo telefon, żeby wysłać podgląd 3D." });
      return;
    }
    setZapisuje(true);
    try {
      const out = await wyslijNaSerwer(zNowymLinkiem(saved, "Link 3D z kreatora · 14 dni"), false);
      setOffer(out);
      toast("Link 3D gotowy", { desc: "Wyślij go osobno od PDF. PIN i ważność zmienisz w panelu oferty." });
    } catch (e) {
      toast("Nie utworzono linku", { type: "err", desc: e instanceof Error ? e.message : "" });
    } finally {
      setZapisuje(false);
    }
  };

  /**
   * Do PDF: najpierw zapis (kod QR ma pokazać tę samą kuchnię co plik), potem link –
   * obecny, jeśli działa, albo nowy, gdy go nie ma lub wygasł. Bez zapisu (brak klienta, nazwy) PDF wychodzi bez kodu.
   */
  const zapewnijLink = async (): Promise<LinkDoPdf | null> => {
    const saved = await zapisz();
    if (!saved) return null;
    let out = saved;
    if (!saved.link || linkWygasl(saved.link.expiresAt)) {
      setZapisuje(true);
      try {
        out = await wyslijNaSerwer(zNowymLinkiem(saved, saved.link ? "Nowy link 3D do kodu QR w PDF (poprzedni wygasł) · 14 dni" : "Link 3D do kodu QR w PDF · 14 dni"), false);
        setOffer(out);
      } finally {
        setZapisuje(false);
      }
    }
    if (!out.link) return null;
    return { id: out.id, url: `${linkOrigin}/oferta/${out.link.slug}`, wazny: waznyDo(out.link.expiresAt), pin: !!out.link.pin };
  };

  const wyslij3d = () => {
    if (!offer?.link) return;
    const tekst = offerMessage(offer, linkOrigin, offer.link.channel);
    const href = sendHref(offer, offer.link.channel, tekst);
    if (href) window.location.href = href;
    else void navigator.clipboard.writeText(tekst).then(() => toast("Wiadomość 3D skopiowana"));
  };

  /** „Ułóż propozycję” z odpowiedzi z kroków 1–3; pokazuje, czego nie dało się zmieścić. */
  const propozycja = () => {
    if (plan.elementy.length && !window.confirm("Zastąpić obecne elementy propozycją z odpowiedzi?")) return;
    const next = ulozPropozycje(typ, plan, wywiad);
    if (!next.elementy.length) {
      toast("Nic się nie zmieściło", { type: "err", desc: "Sprawdź długość ściany i drzwi na niej." });
      return;
    }
    setPlan(next);
    ustawZaznaczony(null);
    const rodzaje = new Set(next.elementy.map((e) => e.rodzaj));
    const brak =
      typ === "kuchnia"
        ? wywiad.agd.filter((a) => {
            if (a === "zmywarka-60" || a === "zmywarka-45") return !rodzaje.has("zmywarka");
            if (a === "piekarnik-slupek" || a === "piekarnik-dolny") return !rodzaje.has("piekarnik");
            if (a === "lodowka-zabudowa") return !rodzaje.has("lodowka-zabudowa");
            if (a === "lodowka-wolnostojaca") return !rodzaje.has("lodowka");
            if (a === "plyta") return !rodzaje.has("plyta-indukcja") && !rodzaje.has("plyta-gaz");
            if (a === "okap") return !rodzaje.has("okap");
            if (a === "mikrofalowka") return !rodzaje.has("mikrofalowka");
            return false;
          })
        : [];
    const n = next.elementy.length;
    toast(`Propozycja gotowa: ${n} ${n === 1 ? "element" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "elementy" : "elementów"}`, {
      desc: brak.length ? `Nie zmieściło się: ${brak.map((a) => AGD_LABEL[a].toLowerCase()).join(", ")}. Wydłuż ścianę albo dodaj ręcznie.` : "Popraw ją na rzucie – dwuklik na meblu otwiera wnętrze.",
    });
    setKrok("meble");
  };

  const przyklad = () => {
    if (plan.elementy.length && !window.confirm("Zastąpić obecne szafki układem przykładowym?")) return;
    setPlan((p) => ({ ...(typ === "kuchnia" || typ === "inne" ? wstawPrzyklad(p.uklad) : wstawPrzykladMebli(typ)), ...(p.wywiad ? { wywiad: p.wywiad } : {}) }));
    ustawZaznaczony(null);
    setKrok("meble");
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
          <b>{TYP_PROJEKTU[typ].kreator}</b>
        </div>
        <span className="grow" />
        {lokalnie ? <span className="sample">Dane demo</span> : null}
        <button type="button" className="btn btn-plain" aria-label="Samouczek" title="Samouczek" onClick={() => setSamouczek(true)}>
          <span className="hide-sm">Samouczek</span>
          <span className="kr-tylko-sm" aria-hidden>
            ?
          </span>
        </button>
        <button type="button" className="btn btn-ink" data-tour="zapisz" disabled={zapisuje || auth} onClick={() => void zapisz()}>
          Zapisz ofertę
        </button>
        <LogoutButton />
      </header>

      {!gotowe ? <p className="lede kr-wait">Wczytywanie kreatora…</p> : null}

      {gotowe && !auth ? (
        <div className="kr-body">
          <aside className="kr-col kr-catalog" aria-label="Katalog elementów" data-tour="katalog">
            <div className="kr-pad">
              <h2>Katalog · {TYP_PROJEKTU[typ].label}</h2>
              <button type="button" className="btn btn-ghost wide" onClick={() => setBiblioteka(true)}>
                Biblioteka modeli – miniatury
              </button>
              <p className="lede">Kliknięcie dodaje element na końcu ściany {sciana === "B" && plan.uklad === "L" ? "B" : "A"}. Wymiary: szer. × wys. × gł.</p>
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
              <label className="kr-search">
                Szukaj
                <input
                  className="input"
                  value={szukaj}
                  placeholder="np. zmywarka, półka"
                  onChange={(e) => setSzukaj(e.target.value)}
                  aria-label="Szukaj w katalogu"
                />
              </label>
              <label className="kr-check">
                <input type="checkbox" checked={wszystkieGrupy || typ === "inne"} disabled={typ === "inne"} onChange={(e) => setWszystkieGrupy(e.target.checked)} />
                Pokaż wszystkie elementy (nie tylko: {TYP_PROJEKTU[typ].label.toLowerCase()})
              </label>
              {GRUPY_PRESETOW.filter((g) => wszystkieGrupy || GRUPY_TYPU[typ].presety.includes(g.id)).map((g) => {
                const lista = PRESETY.filter((p) => p.grupa === g.id && p.nazwa.toLowerCase().includes(szukaj.trim().toLowerCase()));
                if (!lista.length) return null;
                return (
                  <div key={g.id} className="kr-group">
                    <h3>{g.label}</h3>
                    {lista.map((p) => (
                      <button key={p.id} type="button" className="kr-item" onClick={() => otworzNowy({ nazwa: p.nazwa, strefa: p.strefa, rodzaj: p.rodzaj, w: p.w, h: p.h, d: p.d, zrodlo: "modul" })}>
                        <b>{p.nazwa}</b>
                        <span className="mono">
                          {p.w}×{p.h}×{p.d} cm
                          {cennik ? ` · ${wycenianyElement(p) ? formatPln(modulCena(p, cennik)) : "AGD, poza ceną"}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
              <BibliotekaModeli
                models={models}
                fraza={szukaj.trim().toLowerCase()}
                cennik={cennik}
                onDodaj={otworzNowy}
                grupy={wszystkieGrupy ? null : GRUPY_TYPU[typ].biblioteka}
              />
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
              <div className="kr-plan" data-tour="rzut">
                <div className="kr-scroll">
                <RzutKuchni
                  plan={plan}
                  zaznaczony={zaznaczony}
                  wymiary={wymiary}
                  onWybierz={setZaznaczony}
                  onPrzesun={(id, x, z) => zmien((p) => ({ ...p, elementy: p.elementy.map((e) => (e.id === id ? { ...e, x, z } : e)) }))}
                  onKolizja={() => toast("Elementy nachodzą na siebie", { type: "err", desc: "Zostawiam poprzednie miejsce." })}
                  onOtworz={(id) => setOkno({ tryb: "edycja", id })}
                />
                </div>
                <p className="kr-legend">
                  <span>
                    <i data-zone="dolna" /> szafka dolna
                  </span>
                  <span>
                    <i data-zone="gorna" /> szafka górna
                  </span>
                  <span>
                    <i data-zone="wysoka" /> słupek
                  </span>
                  <span>
                    <i data-zone="polka" /> półka
                  </span>
                  <span>
                    <i data-zone="blat" /> na blacie
                  </span>
                  <span>
                    <i data-zone="front" /> strona frontu
                  </span>
                  <button type="button" className="btn btn-ghost kr-dim-toggle" aria-pressed={wymiary} onClick={() => setWymiary((v) => !v)}>
                    {wymiary ? "Ukryj wymiary" : "Pokaż wymiary"}
                  </button>
                </p>
              </div>
            )}
            {(!waski || zakladka === "3d") && (
              <div className="kr-view3d" data-tour="widok3d">
                <PrzyciskOtwarcia className="btn btn-ghost kr-otworz" />
                <KuchniaTlo
                  plan={plan}
                  modele={modeleSceny}
                  zaznaczony={zaznaczony}
                  onWybierz={setZaznaczony}
                  zdjecie
                  wymiary={wymiary}
                  onUjecie={ustawUjecie}
                />
              </div>
            )}
          </section>

          <aside className="kr-col kr-side" aria-label="Kroki kreatora i cena">
            <PasekKrokow krok={krok} typ={typ} onKrok={setKrok} gotowe={gotoweKroki} />
            <div className="kr-pad kr-side-body" key={krok}>
              {krok === "pomieszczenie" ? (
                <KrokPomieszczenie
                  typ={typ}
                  setTyp={setTyp}
                  plan={plan}
                  setPlan={setPlan}
                  wywiad={wywiad}
                  setWywiad={setWywiad}
                  onUklad={(v) => {
                    setPlan((p) => ({ ...p, uklad: v }));
                    if (v === "ciag") setSciana("A");
                  }}
                />
              ) : krok === "otoczenie" ? (
                <KrokOtoczenie typ={typ} plan={plan} wywiad={wywiad} setWywiad={setWywiad} />
              ) : krok === "wyposazenie" ? (
                <KrokWyposazenie typ={typ} plan={plan} wywiad={wywiad} setWywiad={setWywiad} onPropozycja={propozycja} onPrzyklad={przyklad} />
              ) : krok === "meble" ? (
                <div className="kr-krok" data-krok="meble">
                  <h2>Meble</h2>
                  <p className="lede">Dodawaj z katalogu po lewej (okno z wymiarami i wnętrzem), przeciągaj na rzucie. Dwuklik na meblu – wymiary i wnętrze.</p>
                  {plan.elementy.length ? (
                    <ul className="kr-lista-el" aria-label="Elementy projektu">
                      {plan.elementy.map((e) => (
                        <li key={e.id}>
                          <button type="button" aria-pressed={zaznaczony === e.id} onClick={() => setZaznaczony(e.id)} onDoubleClick={() => setOkno({ tryb: "edycja", id: e.id })}>
                            <b>{e.nazwa}</b>
                            <span className="mono">
                              {e.w}×{e.h}×{e.d}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="kr-hint">Projekt jest pusty. Wróć do kroku „{etykietaKroku("wyposazenie", typ)}” i ułóż propozycję albo dodaj elementy z katalogu.</p>
                  )}
                  <KreatorWlasciwosci
                    plan={plan}
                    element={element}
                    cena={element ? cenaElementu(element, cennik) : null}
                    agd={element ? !wycenianyElement(element) : false}
                    onNazwa={(nazwa) => {
                      if (!element) return;
                      setPlan((p) => ({ ...p, elementy: p.elementy.map((el) => (el.id === element.id ? { ...el, nazwa } : el)) }));
                    }}
                    onWymiar={(key, value) => (element ? ustawWymiar(element.id, key, value) : false)}
                    onObrot={() => {
                      if (element) aktualizujElement(element.id, (el) => ({ ...el, rot: (((el.rot + 90) % 360) as Obrot) }));
                    }}
                    onUsun={() => {
                      if (!element) return;
                      setPlan((p) => ({ ...p, elementy: p.elementy.filter((e) => e.id !== element.id) }));
                      setZaznaczony(null);
                    }}
                    onKopiuj={() => {
                      if (!element) return;
                      dodaj({
                        nazwa: element.nazwa,
                        strefa: element.strefa,
                        rodzaj: element.rodzaj,
                        w: element.w,
                        h: element.h,
                        d: element.d,
                        zrodlo: element.zrodlo,
                        modelId: element.modelId,
                        wnetrze: element.wnetrze,
                      });
                    }}
                    onDociagnij={() => {
                      if (element) dociagnij(element.id);
                    }}
                    onWnetrze={() => {
                      if (element) setOkno({ tryb: "edycja", id: element.id });
                    }}
                  />
                  {wystajePozaSciany(plan) ? <p className="kr-warn">Część elementów wystaje poza długość ścian. Wydłuż ścianę albo przysuń je.</p> : null}
                </div>
              ) : krok === "materialy" ? (
                <div className="kr-krok" data-krok="materialy">
                  <h2>Materiały</h2>
                  <p className="lede">Na start oferty. Klient i tak zmieni je w podglądzie 3D – cena przeliczy się z dopłatami.</p>
                  <div className="field">
                    <span className="lab">Fronty</span>
                    <div className="swatches" role="radiogroup" aria-label="Fronty">
                      {opcjeMaterialu("front", kCtx, front).map((f) => (
                        <button key={f.id} type="button" className="sw" role="radio" aria-checked={front === f.id} aria-label={f.name} data-tip={f.name} onClick={() => setFrontId(f.id)}>
                          <span style={{ background: f.color }} />
                        </button>
                      ))}
                    </div>
                  </div>
                  {typ === "kuchnia" || typ === "inne" ? (
                    <div className="field">
                      <span className="lab">Blat</span>
                      <Wybor label="Blat" value={countertop} onChange={setCountertopId} options={opcjeMaterialu("countertop", kCtx, countertop)} />
                    </div>
                  ) : null}
                  <div className="field">
                    <span className="lab">Okucia</span>
                    <Wybor label="Okucia" value={hardware} onChange={setHardwareId} options={opcjeMaterialu("hardware", kCtx, hardware)} />
                  </div>
                </div>
              ) : (
                <div className="kr-krok" data-krok="oferta">
                  <h2>Klient i oferta</h2>
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
                    <input id="k-title" className="input" value={title} placeholder={`Np. ${TYP_PROJEKTU[typ].label}, dąb`} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="kr-dims">
                    <label htmlFor="k-budzet">
                      Budżet klienta (zł)
                      <input
                        id="k-budzet"
                        className="input"
                        inputMode="numeric"
                        value={wywiad.budzet ?? ""}
                        placeholder="opcjonalnie"
                        onChange={(e) => setWywiad((w) => ({ ...w, budzet: e.target.value.replace(/\D/g, "") ? Math.min(10_000_000, Number(e.target.value.replace(/\D/g, ""))) : null }))}
                      />
                    </label>
                    <label htmlFor="k-termin">
                      Termin
                      <input id="k-termin" className="input" maxLength={80} value={wywiad.termin} placeholder="np. do końca marca" onChange={(e) => setWywiad((w) => ({ ...w, termin: e.target.value }))} />
                    </label>
                  </div>
                  <label htmlFor="k-uwagi" className="kr-pole">
                    Uwagi z pomiaru
                    <textarea id="k-uwagi" className="input" rows={3} maxLength={1000} value={wywiad.uwagi} placeholder="np. krzywa ściana, gniazdka do przeniesienia" onChange={(e) => setWywiad((w) => ({ ...w, uwagi: e.target.value }))} />
                  </label>
                  {wywiad.budzet && plan.elementy.length && razem > wywiad.budzet ? (
                    <p className="kr-warn">Projekt ({formatPln(razem)}) przekracza budżet klienta o {formatPln(razem - wywiad.budzet)}.</p>
                  ) : null}

                  <section className="kr-card">
                    <h3>Oferta PDF</h3>
                    <p className="lede">Handlowa: pozycje, wymiary i ceny, z kodem QR do podglądu 3D. Pobranie zapisuje ofertę i w razie potrzeby tworzy link. W oknie drukowania wybierz „Zapisz jako PDF”.</p>
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
                      zapewnijLink={zapewnijLink}
                      ujecie={ujecie}
                    />
                  </section>

                  <section className="kr-card">
                    <h3>Podgląd 3D</h3>
                    <p className="lede">Link jak przy zwykłej ofercie. Klient obraca projekt, otwiera drzwi i szuflady, zmienia materiały.</p>
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
              )}
            </div>
            <div className="kr-sum kr-side-foot" data-tour="dalej">
              <p>
                Zabudowa netto <b>{plan.elementy.length ? formatPln(suma) : "—"}</b>
              </p>
              <p>
                Razem z dopłatami za materiały <b>{plan.elementy.length ? formatPln(razem) : "—"}</b>
              </p>
              {cennikBlad ? <p className="lede">Cennik firmy się nie wczytał — kwota orientacyjna (cennik domyślny). Przy zapisie serwer policzy ją z Twojego cennika.</p> : null}
              <div className="kr-nav">
                {indeksKroku > 0 ? (
                  <button type="button" className="btn btn-ghost" onClick={() => setKrok(KROKI[indeksKroku - 1])}>
                    Wstecz
                  </button>
                ) : (
                  <span />
                )}
                {indeksKroku < KROKI.length - 1 ? (
                  <button type="button" className="btn btn-ink" onClick={() => setKrok(KROKI[indeksKroku + 1])}>
                    Dalej: {etykietaKroku(KROKI[indeksKroku + 1], typ)}
                  </button>
                ) : (
                  <button type="button" className="btn btn-ink" disabled={zapisuje || auth} onClick={() => void zapisz()}>
                    Zapisz ofertę
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {biblioteka && gotowe && !auth ? <KreatorBiblioteka models={models} cennik={cennik} onDodaj={otworzNowy} onClose={zamknijBiblioteke} typ={typ} /> : null}
      {okno && gotowe && !auth
        ? (() => {
            const edytowany = okno.tryb === "edycja" ? plan.elementy.find((e) => e.id === okno.id) : null;
            if (okno.tryb === "edycja" && !edytowany) return null;
            const start: ElementOkna = okno.tryb === "nowy" ? okno.el : (edytowany as ElementKuchni);
            return (
              <KreatorWnetrze
                key={okno.tryb === "nowy" ? `n-${start.nazwa}-${start.modelId ?? ""}` : `e-${okno.id}`}
                tryb={okno.tryb}
                el={start}
                cennik={cennik}
                onAnuluj={() => setOkno(null)}
                onZapisz={(nowy) => {
                  if (okno.tryb === "nowy") {
                    dodaj(nowy);
                    toast(`Dodano: ${nowy.nazwa}`, { desc: biblioteka ? "Możesz dodać kolejny element albo zamknąć bibliotekę." : undefined });
                    setOkno(null);
                  } else if (zapiszElement(okno.id, nowy)) setOkno(null);
                }}
              />
            );
          })()
        : null}
      {auth ? <LoginDialog error="" onLoggedIn={() => void wczytaj()} /> : null}
      {samouczek && gotowe && !auth ? <KreatorSamouczek typ={typ} onKoniec={() => setSamouczek(false)} /> : null}
      <Tooltips />
      <Toaster />
    </div>
  );
}

function BibliotekaModeli({
  models,
  fraza,
  cennik,
  onDodaj,
  grupy,
}: {
  models: ModelMeta[];
  fraza: string;
  cennik: ModulCennik | null;
  onDodaj: (el: NowyElement) => void;
  /** Grupy pasujące do projektu; null = wszystkie. */
  grupy: readonly GrupaBiblioteki[] | null;
}) {
  const { moduly, wlasne, kuchnie } = podzielModele(models);
  const pasuje = (nazwa: string) => nazwa.toLowerCase().includes(fraza);
  const wlasneWidoczne = wlasne.filter((m) => pasuje(m.name));
  return (
    <>
      {GRUPY_BIBLIOTEKI.filter((g) => !grupy || grupy.includes(g.id)).map((g) => {
        const lista = moduly.filter((x) => x.wpis.grupa === g.id && x.wpis.strefa && x.wpis.rodzaj && pasuje(x.wpis.nazwa));
        if (!lista.length) return null;
        return (
          <div key={g.id} className="kr-group">
            <h3>{g.label}</h3>
            {lista.map(({ model, wpis }) => {
              const strefa = wpis.strefa;
              const rodzaj = wpis.rodzaj;
              if (!strefa || !rodzaj) return null;
              const poza = !wycenianyElement({ rodzaj });
              return (
                <button
                  key={model.id}
                  type="button"
                  className="kr-item"
                  onClick={() =>
                    onDodaj({
                      nazwa: wpis.nazwa,
                      strefa,
                      rodzaj,
                      w: wpis.w,
                      h: wpis.h,
                      d: wpis.d,
                      zrodlo: "model",
                      modelId: model.id,
                    })
                  }
                >
                  <b>{wpis.nazwa}</b>
                  <span className="mono">
                    {wpis.w}×{wpis.h}×{wpis.d} cm
                    {cennik ? ` · ${poza ? "AGD, poza ceną" : formatPln(modulCena(wpis, cennik))}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
      {wlasneWidoczne.length || !fraza ? (
      <div className="kr-group">
        <h3>Modele firmy</h3>
        {wlasneWidoczne.length ? (
          wlasneWidoczne.map((m) => (
            <button
              key={m.id}
              type="button"
              className="kr-item"
              onClick={() =>
                onDodaj({
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
        ) : !fraza ? (
          <p className="lede">
            {moduly.length
              ? "Własne GLB, spoza biblioteki, pojawią się tutaj."
              : "Biblioteka modułów pojawi się po wgraniu (seed/modele-kuchnia-50 oraz seed/modele-szafy-komody-100). Własny GLB dodasz w "}
            {moduly.length ? null : <a href="/panel/ustawienia?tab=models">Ustawieniach → Modele 3D</a>}
            {moduly.length ? null : "."}
          </p>
        ) : null}
        {!fraza && kuchnie.length && (!grupy || grupy.includes("dolne")) ? (
          <p className="lede">
            Gotowe kuchnie ({kuchnie.map((k) => k.wpis.nazwa.replace(" (komplet)", "")).join(", ")}) wybierzesz jako model całej oferty, nie jako
            szafkę.
          </p>
        ) : null}
      </div>
      ) : null}
    </>
  );
}

/** Blat i okucia: wszystkie opcje widoczne naraz (zawijane), z dopłatą jak na stronie klienta. */
function Wybor({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: readonly { id: string; name: string; delta: number }[];
}) {
  return (
    <div className="kr-choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" className="btn btn-ghost" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.name}
          {o.delta ? <i>{`${o.delta > 0 ? "+" : ""}${formatPln(o.delta)}`}</i> : null}
        </button>
      ))}
    </div>
  );
}
