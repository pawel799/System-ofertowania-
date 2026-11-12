"use client";

import { planPokazowy } from "@/lib/pokaz";
import { projektDoLinku, projektZLinku } from "@/lib/projektWLinku";
import PrzelacznikMotywu from "../motyw/PrzelacznikMotywu";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dopasuj, podobienstwo } from "@/lib/szukaj";
import { COUNTERTOPS } from "../catalog";
import { FRONTS } from "../frontStore";
import { HARDWARE } from "../hardwareStore";
import { setCountertop } from "../countertopStore";
import { setFront } from "../frontStore";
import { setHardware } from "../hardwareStore";
import { setPalettes as setPaletteStore } from "../paletteStore";
import { setKatalog as setKatalogStore, useKatalog } from "../katalogStore";
import { findMaterial, opcjeMaterialu, type KatalogPozycja } from "../katalogFirmy";
import { koloryMebla, uchwytMebla } from "@/lib/kolory";
import type { ScianaDodatkowa, ScianaPokoju, UstawieniaScian } from "@/lib/sciany";
import FormatkiOkno from "../produkcja/FormatkiOkno";
import { useHistoria } from "./useHistoria";
import { useTelefon } from "./telefon";
import KreatorScian, { edycjaKolorowScian, PrzelacznikSufitu, SciankiDzialowe, ScianyPokoju, WyborPodlogi } from "./KreatorScian";
import { zastosujZmianePokoju, type ZmianaPokoju } from "@/lib/ksztaltPokoju";
import { czyObrys, mebelZaSciana, scianyPokojuWszystkie } from "@/lib/sciany";
import { DREWNO_RE, type ZrodloMaterialow } from "../produkcja/formatki";
import { useBrand } from "@/lib/brand";
import type { Palette } from "../palettes";
import { formatPln } from "../pricing";
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
  opisPozaWycena,
  zmienWymiar,
  type ElementKuchni,
  type Obrot,
  type Strefa,
  zKata,
  rect,
  type PlanKuchni,
  type Sciana,
} from "@/lib/kuchnia";
import KuchniaTlo, { type KuchniaUjecie } from "../kuchnia/KuchniaTlo";
import RzutKuchni, { przesunMebel } from "../kuchnia/RzutKuchni";
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
import { AGD_LABEL, wywiadDomyslny, type Otwor, type PunktInstalacji, type Wywiad } from "@/lib/wywiad";
import { ulozPropozycje } from "@/lib/propozycja";
import { grupyMaterialow } from "@/lib/opcjeProjektu";
import { dodatkiDomyslne, type DodatekOferty } from "@/lib/dodatki";
import { cennikZPlyta } from "@/lib/modul";
import { useCenaKoncowa } from "./useCenaKoncowa";
import { KreatorCena } from "./KreatorCena";
import { KreatorKolory } from "./KreatorKolory";
import SterowanieScian from "../kuchnia/SterowanieScian";
import { useSciany, zresetujSciany } from "../kuchnia/scianyStore";
import { setKoloryProjektu, useKoloryProjektu } from "../koloryStore";
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

/** Ustawienia ścian do zapisu: kolor ze sceny (scianyStore), reszta (usunięte, dodatkowe, sufit) z planu. */
function scianyZKolorem(sc: UstawieniaScian | undefined, kolor: string | null): { sciany?: UstawieniaScian } {
  const { kolor: _stary, ...reszta } = sc ?? {};
  void _stary;
  const out: UstawieniaScian = { ...reszta, ...(kolor ? { kolor } : {}) };
  return Object.keys(out).length ? { sciany: out } : {};
}

/**
 * test = test kreatora bez konta (/kreator): bez logowania i bez zapisu na serwerze,
 * start od kuchni pokazowej, projekt można zapisać w linku (src/lib/projektWLinku.ts).
 */
export default function KreatorApp({ test = false }: { test?: boolean } = {}) {
  const [auth, setAuth] = useState(false);
  const [gotowe, setGotowe] = useState(false);
  const [lokalnie, setLokalnie] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [istniejace, setIstniejace] = useState<Offer[]>([]);
  // Plan z historią: Ctrl+Z cofa, Ctrl+Shift+Z / Ctrl+Y ponawia (useHistoria.ts).
  // Strażnik: żadna zmiana (przeciąganie, klawisze, wymiary, obrót, ściany, katalog) nie może postawić mebla za ścianą.
  const historia = useHistoria<PlanKuchni>(() => pustyPlan("ciag"), {
    walidacja: mebleZaScianami,
    onOdrzucone: (k) => toast("Mebel nie może stać za ścianą", { type: "err", desc: k }),
  });
  const { wartosc: plan, ustaw: setPlan, reset: resetPlan, cofnij, ponow, moznaCofnac, moznaPonowic } = historia;
  const [client, setClient] = useState("");
  const [contact, setContact] = useState("");
  const [title, setTitle] = useState("");
  const [front, setFrontId] = useState(FRONTS[0].id);
  // Płyta korpusów i dodatki do ceny (cennik → płyty, własne pozycje). null = nowa oferta, dodatki domyślne po wczytaniu cennika.
  const [plytaId, setPlytaId] = useState<string | undefined>(undefined);
  const [dodatki, setDodatki] = useState<DodatekOferty[] | null>(null);
  const [countertop, setCountertopId] = useState(COUNTERTOPS[0].id);
  const [hardware, setHardwareId] = useState(HARDWARE[0].id);
  const [sciana, setSciana] = useState<Sciana>("A");
  const [zaznaczony, ustawZaznaczony] = useState<string | null>(null);
  /** Krok kreatora: pomieszczenie → okna i instalacje → wyposażenie → meble → materiały → oferta. */
  const [krok, setKrok] = useState<Krok>("pomieszczenie");
  const [samouczek, setSamouczek] = useState(false);
  // Zaznaczenie mebla (rzut, 3D, lista) przenosi do kroku „Meble”, gdzie są jego właściwości –
  // poza krokiem „Materiały”: tam kliknięty mebel dostaje własne kolory.
  const setZaznaczony = useCallback((id: string | null) => {
    ustawZaznaczony(id);
    if (id) setKrok((k) => (k === "materialy" ? k : "meble"));
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
  const telefon = useTelefon();
  const { cennik, blad: cennikBlad, gotowy: cennikGotowy } = useCennik(!test);
  const ujecie = useRef<KuchniaUjecie | null>(null);
  const ustawUjecie = useCallback((u: KuchniaUjecie | null) => {
    ujecie.current = u;
  }, []);

  const wczytajOferte = useCallback((o: Offer) => {
    setOffer(o);
    resetPlan(o.kuchnia ?? pustyPlan(o.layout === "L" ? "L" : "ciag"));
    setClient(o.client);
    setContact(o.contact);
    setTitle(o.title);
    setFrontId(o.front);
    setCountertopId(o.countertop);
    setHardwareId(o.hardware);
    setTyp(o.projekt ?? "kuchnia");
    setPlytaId(o.kuchnia?.plyta);
    setKoloryProjektu(o.kuchnia?.kolory);
    zresetujSciany(o.kuchnia?.sciany?.kolor);
    setDodatki(o.kuchnia?.dodatki ?? []);
    // Zapisana oferta: projekt już jest – zaczynamy od mebli.
    setKrok("meble");
  }, [resetPlan]);

  const wczytaj = useCallback(async () => {
    if (test) {
      // Test bez konta: nic z API. Projekt z linku (jeśli jest i jest poprawny), inaczej kuchnia pokazowa.
      setKatalogStore([]);
      setLokalnie(false);
      const zLinku = await projektZLinku(window.location.hash);
      let wczytany = false;
      if (zLinku) {
        try {
          const p = parseKuchnia(zLinku.plan);
          setTyp(parseTypProjektu(zLinku.typ) ?? "kuchnia");
          resetPlan(p);
          zresetujSciany(p.sciany?.kolor);
          setTitle(zLinku.title);
          if (FRONTS.some((f) => f.id === zLinku.front)) setFrontId(zLinku.front);
          if (COUNTERTOPS.some((c) => c.id === zLinku.countertop)) setCountertopId(zLinku.countertop);
          if (HARDWARE.some((h) => h.id === zLinku.hardware)) setHardwareId(zLinku.hardware);
          setKrok("meble");
          wczytany = true;
          toast("Wczytano projekt z linku", { desc: "Dane były tylko w adresie – nic nie pobraliśmy z serwera." });
        } catch {
          toast("Link do projektu jest uszkodzony", { type: "err", desc: "Pokazuję kuchnię przykładową." });
        }
      }
      if (!zLinku && window.location.hash.startsWith("#projekt=")) {
        toast("Link do projektu jest uszkodzony", { type: "err", desc: "Pokazuję kuchnię przykładową." });
      }
      if (!wczytany) {
        const pokaz = planPokazowy();
        setTyp("kuchnia");
        resetPlan(pokaz);
        zresetujSciany(pokaz.sciany?.kolor);
        setTitle("Kuchnia w L – dąb i grafit");
        setKrok("meble");
      }
      setSamouczek(false);
      setAuth(false);
      setGotowe(true);
      return;
    }
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
        setKoloryProjektu(null);
        zresetujSciany(null);
        if (!samouczekWidziany()) setSamouczek(true);
        if (id) toast("Nie ma takiej oferty", { type: "err", desc: "Zaczynam nowy projekt." });
        // Nowa kuchnia: materiały startowe z katalogu firmy (gdy go ma), inaczej zestaw wbudowany.
        const kat = { palettes: pakiety, katalog: katalogFirmy };
        setFrontId(opcjeMaterialu("front", kat)[0]?.id ?? FRONTS[0].id);
        setCountertopId(opcjeMaterialu("countertop", kat)[0]?.id ?? COUNTERTOPS[0].id);
        setHardwareId(opcjeMaterialu("hardware", kat)[0]?.id ?? HARDWARE[0].id);
        // Prezentacja: /panel/kreator?pokaz=1 – gotowa kuchnia pokazowa (src/lib/pokaz.ts), bez samouczka.
        if (new URLSearchParams(window.location.search).get("pokaz") === "1") {
          const pokaz = planPokazowy();
          setTyp("kuchnia");
          resetPlan(pokaz);
          zresetujSciany(pokaz.sciany?.kolor);
          setSamouczek(false);
          setTitle("Kuchnia w L – dąb i grafit");
          setKrok("meble");
        }
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
  }, [wczytajOferte, resetPlan, test]);

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

  // Test bez konta: projekt na bieżąco w linku (#projekt=…), bez zaśmiecania historii.
  useEffect(() => {
    if (!test || !gotowe) return;
    let alive = true;
    const t = window.setTimeout(() => {
      void projektDoLinku({ typ, title, plan, front, countertop, hardware }).then((hash) => {
        if (alive) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
      });
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [test, gotowe, typ, title, plan, front, countertop, hardware]);

  const kopiujLinkProjektu = async () => {
    const hash = await projektDoLinku({ typ, title, plan, front, countertop, hardware });
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      toast("Skopiowano link do projektu", {
        desc: url.length > 8000 ? "Projekt jest duży – link może się nie zmieścić w niektórych komunikatorach." : "Kto go otworzy, zobaczy ten sam projekt. Nic nie trafiło na serwer.",
      });
    } catch {
      toast("Nie udało się skopiować", { type: "err", desc: "Skopiuj adres z paska przeglądarki." });
    }
  };

  const element = plan.elementy.find((e) => e.id === zaznaczony) ?? null;
  const wywiad: Wywiad = plan.wywiad ?? wywiadDomyslny(typ);
  const setWywiad = (fn: (w: Wywiad) => Wywiad) => setPlan((p) => ({ ...p, wywiad: fn(p.wywiad ?? wywiadDomyslny(typ)) }));
  // Okno albo drzwi przeciągnięte na rzucie / w 3D (już sprawdzone – sprawdzOtwor w src/lib/otwory.ts).
  const przesunOtwor = useCallback((i: number, o: Otwor) => setPlan((p) => (p.wywiad ? { ...p, wywiad: { ...p.wywiad, otwory: p.wywiad.otwory.map((x, j) => (j === i ? o : x)) } } : p)), [setPlan]);
  const bladOtworu = useCallback((powod: string) => toast("Tu nie można przesunąć", { type: "err", desc: powod }), []);
  const przesunSciane = useCallback(
    (i: number, sc: ScianaDodatkowa) =>
      setPlan((p) => (p.sciany?.dodatkowe ? { ...p, sciany: { ...p.sciany, dodatkowe: p.sciany.dodatkowe.map((x, j) => (j === i ? sc : x)) } } : p)),
    [setPlan],
  );
  const przesunPunkt = useCallback(
    (i: number, pk: PunktInstalacji) => setPlan((p) => (p.wywiad ? { ...p, wywiad: { ...p.wywiad, punkty: (p.wywiad.punkty ?? []).map((x, j) => (j === i ? pk : x)) } } : p)),
    [setPlan],
  );
  // Przeciąganie mebli w 3D (tylko kreator): nowe miejsce już sprawdzone w scenie.
  const edycjaMebli = useMemo(
    () => ({
      onPrzesun: (id: string, x: number, z: number) => setPlan((p) => ({ ...p, elementy: p.elementy.map((e) => (e.id === id ? { ...e, x, z } : e)) })),
      onKolizja: (powod: string) => toast("Tu nie można postawić mebla", { type: "err", desc: powod }),
    }),
    [setPlan],
  );
  const indeksKroku = KROKI.indexOf(krok);
  const gotoweKroki = new Set<Krok>([
    ...(plan.wywiad ? (["pomieszczenie", "otoczenie"] as Krok[]) : []),
    ...(plan.elementy.length ? (["wyposazenie", "meble"] as Krok[]) : []),
    ...(offer ? (["materialy", "oferta"] as Krok[]) : []),
  ]);
  // Wspólne kolory boków i środka (kolory.ts) – w magazynie, jak front; scena 3D czyta je stamtąd.
  const koloryProjektu = useKoloryProjektu();
  // Kolor ścian w 3D (scianyStore) – zapisuje się w planie, klient widzi go na linku.
  const { kolor: kolorScian } = useSciany();
  // Plan z płytą, dodatkami i kolorami – to idzie do ceny, PDF i na serwer.
  const planCeny = useMemo<PlanKuchni>(
    () => ({
      ...plan,
      ...(plytaId ? { plyta: plytaId } : {}),
      ...(dodatki?.length ? { dodatki } : {}),
      ...(koloryProjektu.korpus || koloryProjektu.srodek ? { kolory: koloryProjektu } : {}),
      ...scianyZKolorem(plan.sciany, kolorScian),
    }),
    [plan, plytaId, dodatki, koloryProjektu, kolorScian],
  );
  const katalog = useKatalog();
  const kCtx = { palettes, katalog };
  const brand = useBrand();
  const [formatki, setFormatki] = useState(false);
  const [kreatorScian, setKreatorScian] = useState(false);
  /** Zaznaczona ściana pokoju (klik na rzucie / litera w lewym panelu) – karta ściany. */
  const [scianaPokoju, setScianaPokoju] = useState<ScianaPokoju | null>(null);
  const zmienPokoj = (z: ZmianaPokoju) => {
    const w = zastosujZmianePokoju(plan, z);
    if ("blad" in w) toast("Tak się nie da", { type: "err", desc: w.blad });
    else setPlan(w.plan);
  };
  const zamknijKreatorScian = useCallback(() => setKreatorScian(false), []);
  // Kliknięta ściana w 3D → własny kolor (PaletaSciany nad sceną).
  const edycjaKolorow = useMemo(() => edycjaKolorowScian(setPlan), [setPlan]);
  const zamknijFormatki = useCallback(() => setFormatki(false), []);
  // Materiały do formatek: kolory mebli (fronty, boki, środek) i okucia z katalogu firmy – jak w PDF oferty.
  const zrodloProdukcji = useMemo<ZrodloMaterialow>(() => {
    const ctx = { palettes, katalog };
    return {
      material: (el, czesc) => {
        const id = koloryMebla(el, front, planCeny.kolory)[czesc];
        const m = findMaterial("front", id, ctx);
        const nazwa = m?.name ?? id;
        return { klucz: id, nazwa, grubosc: m?.thicknessMm ?? 18, sloje: m?.finish === "struktura" || DREWNO_RE.test(nazwa), rodzaj: "plyta" };
      },
      uchwyt: (el) => {
        const m = findMaterial("hardware", uchwytMebla(el, hardware), ctx);
        return { nazwa: m?.name ?? "uchwyt", bez: !!m?.bezUchwytu };
      },
      blat: findMaterial("countertop", countertop, ctx)?.name,
    };
  }, [palettes, katalog, front, hardware, countertop, planCeny.kolory]);
  const modeleSceny = useMemo(
    () => models.filter((m) => plan.elementy.some((e) => e.modelId === m.id)).map(toPublicModel),
    [models, plan.elementy],
  );
  // Te same grupy materiałów co na stronie klienta (opcjeProjektu.ts): szafa bez blatu, regał bez uchwytów…
  const grupy = useMemo(() => grupyMaterialow({ plan, modele: modeleSceny }), [plan, modeleSceny]);
  // Krok „Materiały” zaczyna od kolorów wszystkich mebli; kliknięty potem mebel dostaje własne.
  useEffect(() => {
    if (krok === "materialy") setZaznaczony(null);
  }, [krok, setZaznaczony]);
  // Nowa oferta: pozycje cennika oznaczone „zawsze” wchodzą same (raz, po wczytaniu cennika).
  useEffect(() => {
    if (dodatki === null && cennikGotowy && !offer) setDodatki(dodatkiDomyslne(cennik));
  }, [dodatki, cennikGotowy, offer, cennik]);
  // Cennik z ceną płyty wybranej w ofercie – ceny pozycji w katalogu, oknie elementu i właściwościach.
  const cennikOferty = useMemo(() => cennikZPlyta(cennik, plytaId), [cennik, plytaId]);
  const cena = useCenaKoncowa({ plan: planCeny, cennik, wybor: { front, countertop, hardware }, grupy, materialy: kCtx });
  const razem = cena.razem;
  // Legenda rzutu: tylko strefy, które są w projekcie; poza kuchnią bez „słupka” i „szafki dolnej”.
  const legenda = useMemo(() => {
    const opisy: [Strefa, string][] =
      typ === "kuchnia"
        ? [["dolna", "szafka dolna"], ["gorna", "szafka górna"], ["wysoka", "słupek"], ["polka", "półka"], ["blat", "na blacie"]]
        : [["dolna", "mebel stojący"], ["gorna", "mebel wiszący"], ["wysoka", "mebel wysoki (szafa, regał)"], ["polka", "półka"], ["blat", "na blacie"]];
    const obecne = new Set(plan.elementy.map((e) => e.strefa));
    return obecne.size ? opisy.filter(([st]) => obecne.has(st)) : opisy.filter(([st]) => typ === "kuchnia" || st !== "blat");
  }, [plan.elementy, typ]);
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
        // Kolory i okucia z okna elementu (puste = jak pozostałe meble).
        if (nowy.kolory && Object.keys(nowy.kolory).length) out.kolory = nowy.kolory;
        else delete out.kolory;
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
    if (test) {
      throw new ApiError(0, "test", "To test kreatora: nic nie zapisujemy na serwerze. Załóż konto, żeby zapisać ofertę i wysłać link klientowi.");
    }
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
      id: nextOfferId(istniejace, typ),
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
        ...planCeny,
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
    // Przykład zastępuje meble – pokój (wymiary, kształt, ściany, podłoga, sufit) i odpowiedzi z wywiadu zostają.
    setPlan((p) => ({
      ...(typ === "kuchnia" || typ === "inne" ? wstawPrzyklad(p.uklad) : wstawPrzykladMebli(typ)),
      ...(p.wywiad ? { wywiad: p.wywiad } : {}),
      ...(p.pomieszczenie ? { pomieszczenie: p.pomieszczenie } : {}),
      ...(p.sciany ? { sciany: p.sciany } : {}),
    }));
    ustawZaznaczony(null);
    setKrok("meble");
  };

  const usunZaznaczony = () => {
    if (!element) return;
    setPlan((p) => ({ ...p, elementy: p.elementy.filter((e) => e.id !== element.id) }));
    setZaznaczony(null);
  };
  const kopiujZaznaczony = () => {
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
      kolory: element.kolory,
    });
  };

  // Skróty klawiszowe (lista: SKROTY, okno pod „?”). Handler w refie – zawsze widzi bieżący plan i zaznaczenie.
  const [skroty, setSkroty] = useState(false);
  // Kiosk: pełny ekran tylko ze sceną (kr-stage) i krokami (kr-side); katalog wysuwany z paska. ?kiosk=1 – od startu.
  const [kiosk, setKiosk] = useState(false);
  const [katalogKiosk, setKatalogKiosk] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("kiosk") === "1") setKiosk(true);
    const zmiana = () => {
      // Wyjście z pełnego ekranu (Esc, gest przeglądarki) kończy też kiosk i pełny ekran rzutu / 3D.
      if (!document.fullscreenElement && document.documentElement.dataset.kioskApi === "1") {
        delete document.documentElement.dataset.kioskApi;
        setKiosk(false);
        setPelny(null);
        setKatalogKiosk(false);
      }
    };
    document.addEventListener("fullscreenchange", zmiana);
    return () => document.removeEventListener("fullscreenchange", zmiana);
  }, []);
  /** Pełny ekran samego edytora (rzut) albo samego podglądu 3D – osobno od kiosku. */
  const [pelny, setPelny] = useState<"rzut" | "3d" | null>(null);
  const pelnyEkranApi = async () => {
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        document.documentElement.dataset.kioskApi = "1";
      }
    } catch {
      // Bez Fullscreen API (iPhone, ramka) – panel i tak zakrywa całe okno.
    }
  };
  const wejdzPelny = (cel: "rzut" | "3d") => {
    setPelny(cel);
    setZakladka(cel);
    setKatalogKiosk(false);
    void pelnyEkranApi();
  };
  const wyjdzPelny = () => {
    setPelny(null);
    setKatalogKiosk(false);
    if (!kiosk) {
      delete document.documentElement.dataset.kioskApi;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }
  };
  const wejdzKiosk = async () => {
    setKiosk(true);
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        document.documentElement.dataset.kioskApi = "1";
      }
    } catch {
      // Bez Fullscreen API (iPhone, ramka) – sam układ kiosku na całym oknie.
    }
  };
  const wyjdzKiosk = () => {
    setKiosk(false);
    setKatalogKiosk(false);
    delete document.documentElement.dataset.kioskApi;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };
  const klawisze = useRef<(e: KeyboardEvent) => void>(() => {});
  klawisze.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const cel = e.target as HTMLElement | null;
    const wPolu = !!cel && (cel.isContentEditable || /^(input|textarea|select)$/i.test(cel.tagName));
    // Otwarte okno: cofanie działa tylko w kreatorze ścian (data-cofanie), reszta skrótów – tylko bez okien.
    const modal = document.querySelector<HTMLElement>('[aria-modal="true"]');
    const cofanieWOknie = !modal || modal.hasAttribute("data-cofanie");
    if (mod && k === "s") {
      e.preventDefault();
      if (!modal && !zapisuje && !auth && !test) void zapisz();
      return;
    }
    if (wPolu) return;
    if (mod && !e.altKey && (k === "z" || k === "y")) {
      if (!cofanieWOknie) return;
      e.preventDefault();
      const wstecz = k === "z" && !e.shiftKey;
      if (wstecz ? !moznaCofnac : !moznaPonowic) return void toast(wstecz ? "Nie ma czego cofnąć" : "Nie ma czego ponowić");
      if (wstecz) cofnij();
      else ponow();
      return;
    }
    if (modal) return;
    if (e.key === "Escape" && pelny) {
      wyjdzPelny();
      return;
    }
    if (!mod && !e.altKey && k === "f" && !e.shiftKey) {
      e.preventDefault();
      if (kiosk) wyjdzKiosk();
      else void wejdzKiosk();
      return;
    }
    if (!mod && !e.altKey && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
      e.preventDefault();
      setSkroty(true);
      return;
    }
    if (e.key === "Escape" && (zaznaczony || scianaPokoju)) {
      setZaznaczony(null);
      setScianaPokoju(null);
      return;
    }
    if (!element) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      usunZaznaczony();
    } else if (mod && k === "d") {
      e.preventDefault();
      kopiujZaznaczony();
    } else if (!mod && !e.altKey && k === "r") {
      e.preventDefault();
      aktualizujElement(element.id, (el) => ({ ...el, rot: (((el.rot + 90) % 360) as Obrot) }));
    } else if (!mod && e.key === "Enter" && !cel?.closest("button, a")) {
      e.preventDefault();
      setOkno({ tryb: "edycja", id: element.id });
    } else if (!mod && e.key.startsWith("Arrow")) {
      const krok = e.shiftKey ? 1 : 5;
      const [dx, dz] = e.key === "ArrowLeft" ? [-krok, 0] : e.key === "ArrowRight" ? [krok, 0] : e.key === "ArrowUp" ? [0, -krok] : e.key === "ArrowDown" ? [0, krok] : [0, 0];
      if (!dx && !dz) return;
      e.preventDefault();
      const w = przesunMebel(plan, element, dx, dz);
      if (!w) return;
      if ("blad" in w) toast("Tu nie można postawić mebla", { type: "err", desc: w.blad ?? "Mebel wszedłby na inny element." });
      else setPlan((p) => ({ ...p, elementy: p.elementy.map((el) => (el.id === element.id ? { ...el, x: w.x, z: w.z } : el)) }));
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => klawisze.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // Telefon: kreator jest tylko na komputerze (i tablecie) – tu sam podgląd ofert.
  if (telefon)
    return (
      <div className="pnl kreator">
        <header className="top">
          <a className="btn btn-plain" href="/panel" aria-label="Wróć do ofert">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <PanelBrand />
          <span className="grow" />
          <PrzelacznikMotywu className="btn btn-plain" domyslny="system" />
        </header>
        <div className="kr-telefon" role="status">
          <h1>Kreator działa na komputerze</h1>
          <p className="lede">
            {test
              ? "Otwórz tę stronę na komputerze albo tablecie, żeby wypróbować kreator. Na telefonie zobaczysz przykładową ofertę z kuchnią 3D."
              : "Na telefonie możesz przeglądać oferty, podgląd 3D i wysyłać linki klientom. Projekty tworzysz i zmieniasz na większym ekranie."}
          </p>
          {test ? (
            <a className="btn btn-ghost" href="/oferta/demo">
              Przykładowa oferta 3D
            </a>
          ) : null}
          {offer?.link ? (
            <a className="btn btn-ghost" href={`/oferta/${offer.link.slug}`}>
              Podgląd tej oferty
            </a>
          ) : null}
          <a className="btn btn-ink" href={test ? "/rejestracja" : "/panel"}>
            {test ? "Załóż konto" : "Przejdź do ofert"}
          </a>
        </div>
        <Toaster />
      </div>
    );

  return (
    <div className="pnl kreator" data-kiosk={kiosk ? "" : undefined} data-pelny={pelny ?? undefined} data-katalog={(kiosk || pelny === "rzut") && katalogKiosk ? "" : undefined}>
      <header className="top">
        <a className="btn btn-plain" href={test ? "/" : "/panel"} aria-label={test ? "Strona główna" : "Wróć do ofert"}>
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
        {test ? (
          <span className="sample" title="Nic nie wysyłamy na serwer. Projekt zapisuje się tylko w linku.">
            Test bez konta
          </span>
        ) : null}
        <button type="button" className="btn btn-plain" aria-label="Cofnij" title="Cofnij (Ctrl+Z)" disabled={!moznaCofnac} onClick={cofnij}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M5.5 3 2.5 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 6h6.5a4 4 0 0 1 0 8H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="btn btn-plain" aria-label="Ponów" title="Ponów (Ctrl+Shift+Z / Ctrl+Y)" disabled={!moznaPonowic} onClick={ponow}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="m10.5 3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 6H6.5a4 4 0 0 0 0 8H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="btn btn-plain hide-sm" aria-label="Skróty klawiszowe" title="Skróty klawiszowe (?)" onClick={() => setSkroty(true)}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="1.5" y="4" width="13" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4 6.5h1M7.5 6.5h1M11 6.5h1M5 9.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        {kiosk ? (
          <>
            <button type="button" className="btn btn-ghost" aria-pressed={katalogKiosk} onClick={() => setKatalogKiosk((v) => !v)}>
              Katalog
            </button>
            <button type="button" className="btn btn-plain" aria-pressed={wymiary} onClick={() => setWymiary((v) => !v)}>
              Wymiary
            </button>
            <button type="button" className="btn btn-plain" onClick={() => setKreatorScian(true)}>
              Ściany
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn btn-plain kr-pelny"
          aria-label={kiosk ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
          title={kiosk ? "Wyjdź z pełnego ekranu (F)" : "Pełny ekran – kiosk (F)"}
          onClick={() => (kiosk ? wyjdzKiosk() : void wejdzKiosk())}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            {kiosk ? (
              <path d="M6 2.5V6H2.5M10 2.5V6h3.5M6 13.5V10H2.5M10 13.5V10h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          <span className="hide-sm">{kiosk ? "Wyjdź" : "Pełny ekran"}</span>
        </button>
        <button type="button" className="btn btn-plain kr-bez-kiosku" aria-label="Samouczek" title="Samouczek" onClick={() => setSamouczek(true)}>
          <span className="hide-sm">Samouczek</span>
          <span className="kr-tylko-sm" aria-hidden>
            ?
          </span>
        </button>
        {test ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void kopiujLinkProjektu()} title="Projekt zapisuje się w linku – nic nie trafia na serwer">
              <span className="hide-sm">Kopiuj link do projektu</span>
              <span className="kr-tylko-sm" aria-hidden>
                Link
              </span>
            </button>
            <a className="btn btn-ink" href="/rejestracja">
              Załóż konto
            </a>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ink" data-tour="zapisz" disabled={zapisuje || auth} onClick={() => void zapisz()}>
              Zapisz ofertę
            </button>
            <span className="kr-bez-kiosku kr-contents">
              <LogoutButton />
            </span>
          </>
        )}
        <PrzelacznikMotywu className="btn btn-plain" domyslny="system" />
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
              <div className="kr-pokoj-blok" data-tour="sciany">
                <div className="kr-pokoj-gora">
                  <b>Ściany</b>
                  <span className="faint">
                    {czyObrys(plan)
                      ? `${scianyPokojuWszystkie(plan).length} ścian · własny kształt`
                      : plan.pomieszczenie
                        ? `prostokąt ${plan.pomieszczenie.szer} × ${plan.pomieszczenie.dlug} cm`
                        : "bez wymiarów pokoju"}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost wide" onClick={() => setKreatorScian(true)}>
                  Kreator ścian
                </button>
                <ScianyPokoju plan={plan} setPlan={setPlan} wybrana={scianaPokoju} setWybrana={setScianaPokoju} />
                <PrzelacznikSufitu plan={plan} setPlan={setPlan} />
                <WyborPodlogi plan={plan} setPlan={setPlan} />
                <SciankiDzialowe plan={plan} setPlan={setPlan} kompakt />
              </div>
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
              {GRUPY_PRESETOW.filter((g) => wszystkieGrupy || GRUPY_TYPU[typ].presety.includes(g.id)).map((g, nr) => {
                const lista = filtruj(PRESETY.filter((p) => p.grupa === g.id), (p) => `${p.nazwa} ${g.label} ${p.w}`, szukaj);
                if (!lista.length) return null;
                return (
                  <GrupaKatalogu key={g.id} id={`p-${g.id}`} tytul={g.label} liczba={lista.length} szukanie={!!szukaj.trim()} domyslnieOtwarta={nr === 0}>
                    {lista.map((p) => (
                      <button key={p.id} type="button" className="kr-item" onClick={() => otworzNowy({ nazwa: p.nazwa, strefa: p.strefa, rodzaj: p.rodzaj, w: p.w, h: p.h, d: p.d, zrodlo: "modul" })}>
                        <b>{p.nazwa}</b>
                        <span className="mono">
                          {p.w}×{p.h}×{p.d} cm
                          {cennik ? ` · ${wycenianyElement(p) ? formatPln(modulCena(p, cennikOferty)) : opisPozaWycena(p)}` : ""}
                        </span>
                      </button>
                    ))}
                  </GrupaKatalogu>
                );
              })}
              <PodobneWKatalogu
                fraza={szukaj}
                pozycje={[
                  ...GRUPY_PRESETOW.filter((g) => wszystkieGrupy || GRUPY_TYPU[typ].presety.includes(g.id)).flatMap((g) =>
                    PRESETY.filter((p) => p.grupa === g.id).map((p) => ({ klucz: p.id, nazwa: p.nazwa, onClick: () => otworzNowy({ nazwa: p.nazwa, strefa: p.strefa, rodzaj: p.rodzaj, w: p.w, h: p.h, d: p.d, zrodlo: "modul" as const }) })),
                  ),
                ]}
                ukryj={GRUPY_PRESETOW.some((g) => (wszystkieGrupy || GRUPY_TYPU[typ].presety.includes(g.id)) && filtruj(PRESETY.filter((p) => p.grupa === g.id), (p) => `${p.nazwa} ${g.label} ${p.w}`, szukaj).length) || maModeleDoFrazy(models, szukaj)}
              />
              <BibliotekaModeli
                models={models}
                fraza={szukaj.trim()}
                cennik={cennikOferty}
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
                {pelny === "rzut" ? (
                  <PasekPelnegoEkranu
                    tytul="Edytor – rzut"
                    cofnij={moznaCofnac ? cofnij : null}
                    ponow={moznaPonowic ? ponow : null}
                    wymiary={wymiary}
                    onWymiary={() => setWymiary((v) => !v)}
                    onInny={() => wejdzPelny("3d")}
                    inny="Podgląd 3D"
                    onWyjdz={wyjdzPelny}
                  >
                    <button type="button" className="btn btn-ghost" aria-pressed={katalogKiosk} onClick={() => setKatalogKiosk((v) => !v)}>
                      Katalog
                    </button>
                    <button type="button" className="btn btn-plain" onClick={() => setKreatorScian(true)}>
                      Ściany
                    </button>
                  </PasekPelnegoEkranu>
                ) : null}
                <div className="kr-scroll">
                <RzutKuchni
                  plan={plan}
                  zaznaczony={zaznaczony}
                  wymiary={wymiary}
                  onWybierz={setZaznaczony}
                  onPrzesun={(id, x, z) => zmien((p) => ({ ...p, elementy: p.elementy.map((e) => (e.id === id ? { ...e, x, z } : e)) }))}
                  onKolizja={(powod) =>
                    toast(powod ? "Tu nie można postawić mebla" : "Elementy nachodzą na siebie", { type: "err", desc: powod ?? "Zostawiam poprzednie miejsce." })
                  }
                  onOtworz={(id) => setOkno({ tryb: "edycja", id })}
                  onOtwor={przesunOtwor}
                  onBladOtworu={bladOtworu}
                  onPunkt={przesunPunkt}
                  onSciana={przesunSciane}
                  scianaPokoju={scianaPokoju}
                  onScianaPokoju={setScianaPokoju}
                  onPokoj={zmienPokoj}
                />
                </div>
                <p className="kr-legend">
                  {legenda.map(([strefa, opis]) => (
                    <span key={strefa}>
                      <i data-zone={strefa} /> {opis}
                    </span>
                  ))}
                  <span>
                    <i data-zone="front" /> strona frontu
                  </span>
                  <button type="button" className="btn btn-ghost kr-dim-toggle" aria-pressed={wymiary} onClick={() => setWymiary((v) => !v)}>
                    {wymiary ? "Ukryj wymiary" : "Pokaż wymiary"}
                  </button>
                  {pelny !== "rzut" ? (
                    <button type="button" className="btn btn-ghost kr-pelny-btn" onClick={() => wejdzPelny("rzut")} title="Sam edytor (rzut) na pełnym ekranie">
                      <IkonaPelnyEkran /> Pełny ekran
                    </button>
                  ) : null}
                </p>
              </div>
            )}
            {(!waski || zakladka === "3d") && (
              <div className="kr-view3d" data-tour="widok3d">
                {pelny === "3d" ? (
                  <PasekPelnegoEkranu
                    tytul="Podgląd 3D"
                    cofnij={moznaCofnac ? cofnij : null}
                    ponow={moznaPonowic ? ponow : null}
                    wymiary={wymiary}
                    onWymiary={() => setWymiary((v) => !v)}
                    onInny={() => wejdzPelny("rzut")}
                    inny="Edytor – rzut"
                    onWyjdz={wyjdzPelny}
                  />
                ) : null}
                <div className="kr-narzedzia3d">
                  {pelny !== "3d" ? (
                    <button type="button" className="btn btn-ghost kr-otworz" onClick={() => wejdzPelny("3d")} title="Sam podgląd 3D na pełnym ekranie">
                      <IkonaPelnyEkran /> Pełny ekran
                    </button>
                  ) : null}
                  <PrzyciskOtwarcia className="btn btn-ghost kr-otworz" />
                  <SterowanieScian className="btn btn-ghost kr-otworz" klasaPanelu="kr-sciany-panel" wlasnyKolor />
                </div>
                <KuchniaTlo
                  plan={plan}
                  edycjaOtworow={{ onOtwor: przesunOtwor, onBlad: bladOtworu, onPunkt: przesunPunkt, onSciana: przesunSciane }}
                  edycjaMebli={edycjaMebli}
                  edycjaKolorow={edycjaKolorow}
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
                  onKreatorScian={() => setKreatorScian(true)}
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
                    cena={element ? cenaElementu(element, cennikOferty) : null}
                    agd={element ? !wycenianyElement(element) : false}
                    onNazwa={(nazwa) => {
                      if (!element) return;
                      setPlan((p) => ({ ...p, elementy: p.elementy.map((el) => (el.id === element.id ? { ...el, nazwa } : el)) }));
                    }}
                    onWymiar={(key, value) => (element ? ustawWymiar(element.id, key, value) : false)}
                    onObrot={() => {
                      if (element) aktualizujElement(element.id, (el) => ({ ...el, rot: (((el.rot + 90) % 360) as Obrot) }));
                    }}
                    onKat={(stopnie) => {
                      if (!element) return;
                      aktualizujElement(element.id, (el) => {
                        const { kat: _stary, ...bez } = el;
                        void _stary;
                        const obrocony = { ...bez, ...zKata(stopnie) };
                        // Mebel przy ścianie zostaje przy niej (ten sam odstęp obrysu), a obrys nigdy nie wchodzi w ścianę A ani B (L).
                        const r0 = rect(el);
                        const r = rect(obrocony);
                        const przyA = r0.z0 < 24;
                        const przyB = plan.uklad === "L" && r0.x0 < 24;
                        const z = przyA ? obrocony.z + Math.round(Math.max(0, r0.z0) - r.z0) : r.z0 < 0 ? obrocony.z - Math.floor(r.z0) : obrocony.z;
                        const x = przyB ? obrocony.x + Math.round(Math.max(0, r0.x0) - r.x0) : plan.uklad === "L" && r.x0 < 0 ? obrocony.x - Math.floor(r.x0) : obrocony.x;
                        return { ...obrocony, x, z };
                      });
                    }}
                    onUsun={usunZaznaczony}
                    onKopiuj={kopiujZaznaczony}
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
                  {!grupy.front && !grupy.korpus && !grupy.blat && !grupy.okucia ? (
                    <p className="kr-hint">Elementy tego projektu nie mają frontów, blatu ani uchwytów do wyboru.</p>
                  ) : null}
                  <KreatorKolory
                    plan={plan}
                    setPlan={setPlan}
                    front={front}
                    setFront={setFrontId}
                    projekt={koloryProjektu}
                    setProjekt={setKoloryProjektu}
                    zaznaczony={zaznaczony}
                    setZaznaczony={setZaznaczony}
                    grupy={grupy}
                    modele={modeleSceny}
                    ctx={kCtx}
                    hardware={hardware}
                  />
                  {grupy.blat ? (
                    <div className="field">
                      <span className="lab">Blat</span>
                      <Wybor label="Blat" value={countertop} onChange={setCountertopId} options={opcjeMaterialu("countertop", kCtx, countertop)} />
                    </div>
                  ) : null}
                  {grupy.okucia ? (
                    <div className="field">
                      <span className="lab">Okucia</span>
                      <Wybor label="Okucia" value={hardware} onChange={setHardwareId} options={opcjeMaterialu("hardware", kCtx, hardware)} />
                    </div>
                  ) : null}
                  <KreatorCena cennik={cennik} plytaId={plytaId} setPlytaId={setPlytaId} dodatki={dodatki ?? []} setDodatki={setDodatki} cena={cena} />
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
                      plan={planCeny}
                      front={front}
                      countertop={countertop}
                      hardware={hardware}
                      palettes={palettes}
                      linkUrl={linkUrl}
                      zapewnijLink={zapewnijLink}
                      ujecie={ujecie}
                      modele={modeleSceny}
                      projekt={typ}
                      bezCennikaFirmy={test}
                    />
                  </section>

                  <section className="kr-card">
                    <h3>Produkcja</h3>
                    <p className="lede">Formatki do cięcia z okleiną, okucia, blaty i rozkrój płyt. Wydruk dla warsztatu i plik CSV dla hurtowni.</p>
                    <div className="actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setFormatki(true)} disabled={!plan.elementy.length}>
                        Formatki i rozkrój
                      </button>
                    </div>
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
                Meble netto <b>{plan.elementy.length ? formatPln(cena.meble) : "—"}</b>
              </p>
              {cena.dodatki ? (
                <p>
                  Dodatki <b>{formatPln(cena.dodatki)}</b>
                </p>
              ) : null}
              <p>
                Razem{cena.dodatki ? " z dodatkami" : ""} i materiałami <b>{plan.elementy.length ? formatPln(razem) : "—"}</b>
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

      {skroty ? <OknoSkrotow onClose={() => setSkroty(false)} /> : null}
      {kreatorScian ? <KreatorScian plan={plan} setPlan={setPlan} onWysokosc={(n) => setWywiad((w) => ({ ...w, wysokosc: n }))} onClose={zamknijKreatorScian} /> : null}
      {formatki ? (
        <FormatkiOkno
          plan={planCeny}
          zrodlo={zrodloProdukcji}
          meta={{ firma: brand.name, tytul: title.trim() || "Projekt", kod: offer?.id ?? "SZKIC", data: new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) }}
          onClose={zamknijFormatki}
        />
      ) : null}
      {biblioteka && gotowe && !auth ? <KreatorBiblioteka models={models} cennik={cennikOferty} onDodaj={otworzNowy} onClose={zamknijBiblioteke} typ={typ} /> : null}
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
                cennik={cennikOferty}
                wyglad={{
                  ctx: kCtx,
                  front,
                  hardware,
                  projekt: koloryProjektu,
                  modele: models.map(toPublicModel),
                  onDlaWszystkich: (k) => {
                    // „Dla całości”: kolory wspólne projektu, a własne kolory pozostałych mebli znikają.
                    if (k.front) setFrontId(k.front);
                    if (k.uchwyt) setHardwareId(k.uchwyt);
                    setKoloryProjektu({ korpus: k.korpus ?? koloryProjektu.korpus, srodek: k.srodek ?? koloryProjektu.srodek });
                    setPlan((p) => ({ ...p, elementy: p.elementy.map((e) => (({ kolory: _k, ...r }) => (void _k, r))(e)) }));
                    if (okno?.tryb === "edycja") setOkno(null);
                    toast("Kolory ustawione dla wszystkich mebli");
                  },
                }}
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
  const wlasneWidoczne = filtruj(wlasne, (m) => m.name, fraza);
  return (
    <>
      {GRUPY_BIBLIOTEKI.filter((g) => !grupy || grupy.includes(g.id)).map((g) => {
        const lista = filtruj(
          moduly.filter((x) => x.wpis.grupa === g.id && x.wpis.strefa && x.wpis.rodzaj),
          (x) => `${x.wpis.nazwa} ${g.label} ${x.wpis.w}`,
          fraza,
        );
        if (!lista.length) return null;
        return (
          <GrupaKatalogu key={g.id} id={`b-${g.id}`} tytul={g.label} liczba={lista.length} szukanie={!!fraza}>
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
                    {cennik ? ` · ${poza ? opisPozaWycena({ rodzaj }) : formatPln(modulCena(wpis, cennik))}` : ""}
                  </span>
                </button>
              );
            })}
          </GrupaKatalogu>
        );
      })}
      {wlasneWidoczne.length || !fraza ? (
      <GrupaKatalogu id="b-wlasne" tytul="Modele firmy" liczba={wlasneWidoczne.length} szukanie={!!fraza}>
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
                  // Rzeczywiste wymiary z wgrywania (Ustawienia → Modele 3D); stare modele bez nich – 60×72×56.
                  w: Math.round(m.wymiary?.w ?? 60),
                  h: Math.round(m.wymiary?.h ?? 72),
                  d: Math.round(m.wymiary?.d ?? 56),
                  zrodlo: "model",
                  modelId: m.id,
                })
              }
            >
              <b>{m.name}</b>
              <span className="mono">{m.wymiary ? `GLB · ${Math.round(m.wymiary.w)}×${Math.round(m.wymiary.h)}×${Math.round(m.wymiary.d)} cm` : "GLB · 60×72×56, skalowane"}</span>
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
      </GrupaKatalogu>
      ) : null}
    </>
  );
}

/** Pozycje katalogu pasujące do frazy (odporne na literówki, odmianę i słowa pokrewne – src/lib/szukaj.ts), najlepsze pierwsze. */
function filtruj<T>(lista: readonly T[], tekst: (x: T) => string, fraza: string): T[] {
  if (!fraza.trim()) return [...lista];
  return lista
    .map((x, i) => ({ x, i, w: dopasuj(fraza, tekst(x)) }))
    .filter((r): r is { x: T; i: number; w: number } => r.w !== null)
    .sort((a, b) => a.w - b.w || a.i - b.i)
    .map((r) => r.x);
}

const maModeleDoFrazy = (models: ModelMeta[], fraza: string) => !!fraza.trim() && models.some((m) => dopasuj(fraza, m.name) !== null);

/** Kategoria katalogu jako lista rozwijana; przy szukaniu otwarte są wszystkie z wynikami. Stan zapamiętany w przeglądarce. */
function GrupaKatalogu({ id, tytul, liczba, szukanie, domyslnieOtwarta = false, children }: { id: string; tytul: string; liczba: number; szukanie: boolean; domyslnieOtwarta?: boolean; children: ReactNode }) {
  const klucz = `kr-katalog-${id}`;
  const [otwarta, setOtwarta] = useState(domyslnieOtwarta);
  useEffect(() => {
    try {
      const v = localStorage.getItem(klucz);
      if (v !== null) setOtwarta(v === "1");
    } catch {
      /* bez pamięci – zostaje domyślnie */
    }
  }, [klucz]);
  const przelacz = () => {
    setOtwarta((o) => {
      try {
        localStorage.setItem(klucz, o ? "0" : "1");
      } catch {
        /* bez pamięci */
      }
      return !o;
    });
  };
  const widoczna = szukanie || otwarta;
  return (
    <div className="kr-group kr-lista-rozwijana" data-otwarta={widoczna ? "" : undefined}>
      <button type="button" className="kr-group-head" aria-expanded={widoczna} onClick={przelacz} disabled={szukanie}>
        <svg viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="m4.5 3 3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{tytul}</span>
        <span className="kr-group-n">{liczba}</span>
      </button>
      {widoczna ? <div className="kr-group-body">{children}</div> : null}
    </div>
  );
}

/** Nic nie pasuje: „Może chodziło o…” – najbliższe nazwy. */
function PodobneWKatalogu({ fraza, pozycje, ukryj }: { fraza: string; pozycje: { klucz: string; nazwa: string; onClick: () => void }[]; ukryj: boolean }) {
  if (ukryj || !fraza.trim()) return null;
  const najblizsze = pozycje
    .map((p) => ({ p, d: podobienstwo(fraza, p.nazwa) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  return (
    <div className="kr-group">
      <p className="lede" style={{ margin: "4px 0" }}>
        Nic nie pasuje do „{fraza.trim()}”. Może chodziło o:
      </p>
      {najblizsze.map(({ p }) => (
        <button key={p.klucz} type="button" className="kr-item" onClick={p.onClick}>
          <b>{p.nazwa}</b>
        </button>
      ))}
    </div>
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

/** Skróty klawiszowe kreatora (okno pod „?” i przyciskiem w nagłówku). */
const SKROTY: { klawisze: string[]; opis: string }[] = [
  { klawisze: ["Ctrl", "Z"], opis: "Cofnij ostatnią zmianę projektu" },
  { klawisze: ["Ctrl", "Shift", "Z"], opis: "Ponów (także Ctrl + Y)" },
  { klawisze: ["Ctrl", "S"], opis: "Zapisz ofertę" },
  { klawisze: ["Delete"], opis: "Usuń zaznaczony mebel (także Backspace)" },
  { klawisze: ["Ctrl", "D"], opis: "Duplikuj zaznaczony mebel" },
  { klawisze: ["R"], opis: "Obróć zaznaczony mebel o 90°" },
  { klawisze: ["←", "→", "↑", "↓"], opis: "Przesuń zaznaczony mebel o 5 cm (z Shift o 1 cm)" },
  { klawisze: ["Enter"], opis: "Wymiary i wnętrze zaznaczonego mebla" },
  { klawisze: ["Esc"], opis: "Odznacz mebel / zamknij okno" },
  { klawisze: ["Delete"], opis: "W kreatorze ścian: usuń wybraną ścianę" },
  { klawisze: ["F"], opis: "Pełny ekran (kiosk) – scena i kroki, funkcje na pasku" },
  { klawisze: ["?"], opis: "Ta lista" },
];

function OknoSkrotow({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className="overlay" data-open="">
      <div className="backdrop" onClick={onClose} />
      <div className="modal kr-skroty" role="dialog" aria-modal="true" aria-labelledby="kr-skroty-t">
        <div className="m-pad">
          <div className="m-top">
            <h2 id="kr-skroty-t" style={{ fontSize: 15 }}>
              Skróty klawiszowe
            </h2>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-ink" onClick={onClose}>
              Zamknij
            </button>
          </div>
          <dl className="kr-skroty-lista">
            {SKROTY.map((s, i) => (
              <div key={i}>
                <dt>
                  {s.klawisze.map((k, j) => (
                    <kbd key={j}>{mac && k === "Ctrl" ? "⌘" : k}</kbd>
                  ))}
                </dt>
                <dd>{s.opis}</dd>
              </div>
            ))}
          </dl>
          <p className="kr-hint">Skróty nie działają, gdy piszesz w polu tekstowym (tam Ctrl+Z cofa tekst).</p>
        </div>
      </div>
    </div>
  );
}

const IkonaPelnyEkran = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden width="14" height="14">
    <path d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Pasek na pełnym ekranie edytora (rzut) albo podglądu 3D: cofnij/ponów, wymiary, przełączenie na drugi widok, wyjście. */
function PasekPelnegoEkranu({
  tytul,
  cofnij,
  ponow,
  wymiary,
  onWymiary,
  onInny,
  inny,
  onWyjdz,
  children,
}: {
  tytul: string;
  cofnij: (() => void) | null;
  ponow: (() => void) | null;
  wymiary: boolean;
  onWymiary: () => void;
  onInny: () => void;
  inny: string;
  onWyjdz: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="kr-pelny-pasek" role="toolbar" aria-label={`${tytul} – pełny ekran`}>
      <b>{tytul}</b>
      <span className="grow" />
      {children}
      <button type="button" className="btn btn-plain" aria-label="Cofnij" title="Cofnij (Ctrl+Z)" disabled={!cofnij} onClick={() => cofnij?.()}>
        ↶
      </button>
      <button type="button" className="btn btn-plain" aria-label="Ponów" title="Ponów (Ctrl+Shift+Z)" disabled={!ponow} onClick={() => ponow?.()}>
        ↷
      </button>
      <button type="button" className="btn btn-plain" aria-pressed={wymiary} onClick={onWymiary}>
        Wymiary
      </button>
      <button type="button" className="btn btn-plain" onClick={onInny}>
        {inny}
      </button>
      <button type="button" className="btn btn-ink" onClick={onWyjdz} title="Wyjdź z pełnego ekranu (Esc)">
        Wyjdź
      </button>
    </div>
  );
}

/**
 * Strażnik planu: komunikat, gdy po zmianie jakiś mebel stoi za ścianą albo przez nią przechodzi (src/lib/sciany.ts).
 * Mebel, który już stał za ścianą (stary projekt) i się nie zmienił, nie blokuje innych zmian.
 */
function mebleZaScianami(stary: PlanKuchni, nowy: PlanKuchni): string | null {
  const zaStary = new Set(stary.elementy.filter((e) => mebelZaSciana(stary, rect(e))).map((e) => e.id));
  const zly = nowy.elementy.find((e) => !zaStary.has(e.id) && mebelZaSciana(nowy, rect(e)));
  if (!zly) return null;
  const pokojZmieniony = stary.sciany?.obrys !== nowy.sciany?.obrys || stary.pomieszczenie !== nowy.pomieszczenie || stary.scianaA !== nowy.scianaA || stary.scianaB !== nowy.scianaB || stary.sciany?.bez !== nowy.sciany?.bez;
  const byl = stary.elementy.some((e) => e.id === zly.id);
  if (pokojZmieniony && byl) return `„${zly.nazwa}” znalazłby się za ścianą. Najpierw przesuń mebel, potem zmień ściany.`;
  if (!byl) return `„${zly.nazwa}” nie mieści się w pokoju przy tej ścianie. Zrób miejsce albo powiększ pokój.`;
  return `„${zly.nazwa}” znalazłby się za ścianą albo w niej.`;
}
