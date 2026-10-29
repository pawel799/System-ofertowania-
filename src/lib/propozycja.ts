/*
 * Propozycja układu z odpowiedzi kreatora krok po kroku (wywiad.ts): zlew przy wodzie, zmywarka obok,
 * płyta z okapem dalej, słupki na końcu, szafki górne nad dolnymi poza oknami; szafa na całą wnękę do sufitu
 * z wnętrzem pod potrzeby; meble salonu i łazienki wzdłuż ściany. Zawsze z poszanowaniem drzwi (tam nic nie stoi).
 */
import { limityRodzaju, nowyElementId, nachodzi, rect, type ElementKuchni, type PlanKuchni, type RodzajElementu, type Sciana, type Strefa } from "./kuchnia";
import { MAX_MODULY } from "./modul";
import { PRESETY_WNETRZA, sprawdzWnetrze, wnetrzeDomyslne, zPresetu, type Wnetrze } from "./wnetrze";
import type { TypProjektu } from "./projekt";
import type { Otwor, Wywiad } from "./wywiad";


type Nowy = { nazwa: string; strefa: Strefa; rodzaj: RodzajElementu; w: number; h: number; d: number; wnetrze?: Wnetrze };

const SZEROKOSCI = [80, 60, 50, 40, 30];

/** Dzieli długość na szafki 30–80 cm (najpierw szerokie). Reszta < 30 cm zostaje pusta (blenda). */
function podziel(dlugosc: number) {
  const out: number[] = [];
  let reszta = Math.floor(dlugosc);
  while (reszta >= 30) {
    const w = SZEROKOSCI.find((s) => s <= reszta && (reszta - s === 0 || reszta - s >= 30)) ?? SZEROKOSCI.find((s) => s <= reszta)!;
    out.push(w);
    reszta -= w;
  }
  return out;
}

class Ukladacz {
  elementy: ElementKuchni[] = [];
  constructor(private plan: PlanKuchni) {}
  /** Element przy ścianie: `od` = początek wzdłuż ściany [cm]. */
  dodaj(n: Nowy, sciana: Sciana, od: number) {
    if (this.elementy.length >= MAX_MODULY) return null;
    const lim = limityRodzaju(n.rodzaj, n.strefa);
    const w = Math.min(lim.w.max, Math.max(lim.w.min, n.w));
    const h = Math.min(lim.h.max, Math.max(lim.h.min, n.h));
    const d = Math.min(lim.d.max, Math.max(lim.d.min, n.d));
    const el: ElementKuchni = {
      id: nowyElementId(new Set(this.elementy.map((e) => e.id))),
      nazwa: n.nazwa,
      zrodlo: "modul",
      strefa: n.strefa,
      rodzaj: n.rodzaj,
      w,
      h,
      d,
      x: sciana === "A" ? Math.round(od + w / 2) : Math.round(d / 2),
      z: sciana === "A" ? Math.round(d / 2) : Math.round(od + w / 2),
      rot: sciana === "A" ? 0 : 90,
      ...(n.wnetrze ? { wnetrze: n.wnetrze } : {}),
    };
    if (el.wnetrze && sprawdzWnetrze(el, el.wnetrze).bledy.length) delete el.wnetrze;
    const r = rect(el);
    const kolizja = this.elementy.some((e) => konfliktProsty(e.strefa, el.strefa) && nachodzi(rect(e), r));
    if (kolizja) return null;
    this.elementy.push(el);
    return el;
  }
  wynik(): PlanKuchni {
    return { ...this.plan, elementy: this.elementy };
  }
}

function konfliktProsty(a: Strefa, b: Strefa) {
  if (a === "wysoka" || b === "wysoka") return true;
  if (a === "blat" || b === "blat") return a === b;
  return a === b;
}

/** Wolne odcinki ściany (bez drzwi), od–do [cm]. */
function wolneOdcinki(dlugosc: number, otwory: Otwor[], sciana: Sciana, od = 0) {
  const zajete = otwory
    .filter((o) => o.sciana === sciana && o.rodzaj === "drzwi")
    .map((o) => [Math.max(od, o.od - 5), o.od + o.szer + 5] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let kursor = od;
  for (const [a, b] of zajete) {
    if (a > kursor) out.push([kursor, Math.min(a, dlugosc)]);
    kursor = Math.max(kursor, b);
  }
  if (kursor < dlugosc) out.push([kursor, dlugosc]);
  return out.filter(([a, b]) => b - a >= 30);
}

const podOknem = (otwory: Otwor[], sciana: Sciana, a: number, b: number) =>
  otwory.some((o) => o.sciana === sciana && o.rodzaj === "okno" && o.od < b && o.od + o.szer > a);

function wnetrzePresetu(id: string, el: { w: number; h: number; d: number; rodzaj: RodzajElementu; strefa: Strefa }) {
  const p = PRESETY_WNETRZA.find((x) => x.id === id);
  if (!p) return wnetrzeDomyslne(el) ?? undefined;
  const wn = zPresetu(p, el);
  return sprawdzWnetrze(el, wn).bledy.length ? (wnetrzeDomyslne(el) ?? undefined) : wn;
}

function kuchnia(plan: PlanKuchni, wy: Wywiad): PlanKuchni {
  const u = new Ukladacz(plan);
  const L = plan.uklad === "L";
  const gornaH = wy.gorne === "90" ? 90 : wy.gorne === "sufit" ? Math.max(72, Math.min(110, wy.wysokosc - 145 - 2)) : 72;
  const slupekH = Math.min(230, Math.max(200, wy.wysokosc >= 250 ? 220 : wy.wysokosc - 30));
  // Strefy: zlew przy wodzie, zmywarka obok, płyta dalej (min. 40 cm blatu od zlewu), słupki na końcu.
  const wodaSciana: Sciana = wy.woda?.sciana === "B" && L ? "B" : "A";
  const sloty: { s: Sciana; od: number; do: number }[] = [];
  let startA = 0;
  if (L) {
    const n = u.dodaj({ nazwa: "Szafka narożna 90", strefa: "dolna", rodzaj: "narozna", w: 90, h: 72, d: 90 }, "A", 0);
    if (n) startA = 90;
  }
  for (const [a, b] of wolneOdcinki(plan.scianaA, wy.otwory, "A", startA)) sloty.push({ s: "A", od: a, do: b });
  if (L) for (const [a, b] of wolneOdcinki(plan.scianaB, wy.otwory, "B", 90)) sloty.push({ s: "B", od: a, do: b });

  const zlew: Nowy = { nazwa: "Szafka pod zlew 80", strefa: "dolna", rodzaj: "zlew", w: 80, h: 72, d: 56 };
  const zmyw = wy.agd.includes("zmywarka-60") ? 60 : wy.agd.includes("zmywarka-45") ? 45 : 0;
  const slupki: Nowy[] = [];
  if (wy.agd.includes("lodowka-zabudowa")) slupki.push({ nazwa: "Zabudowa lodówki 60", strefa: "wysoka", rodzaj: "lodowka-zabudowa", w: 60, h: slupekH, d: 56 });
  if (wy.agd.includes("lodowka-wolnostojaca")) slupki.push({ nazwa: "Lodówka wolnostojąca", strefa: "wysoka", rodzaj: "lodowka", w: 60, h: 185, d: 62 });
  if (wy.agd.includes("piekarnik-slupek")) slupki.push({ nazwa: "Słupek z piekarnikiem 60", strefa: "wysoka", rodzaj: "piekarnik", w: 60, h: slupekH, d: 56 });
  const dolnyPiekarnik = wy.agd.includes("piekarnik-dolny");

  // Zlew: na ścianie z wodą, środkiem jak najbliżej przyłącza.
  const slotWody = sloty.find((s) => s.s === wodaSciana && s.do - s.od >= 80 + zmyw) ?? sloty.find((s) => s.do - s.od >= 80);
  // Słupki (lodówka, piekarnik) na końcu najdłuższego odcinka bez wody, nigdy pod oknem.
  const naSlupki = [...sloty].sort((a, b) => Number(a === slotWody) - Number(b === slotWody) || b.do - b.od - (a.do - a.od))[0];
  if (naSlupki) {
    let koniec = naSlupki.do;
    for (const s of slupki) {
      // Okno nad słupkiem: przesuwamy słupek przed okno.
      let kon = koniec;
      for (const o of wy.otwory) {
        if (o.sciana === naSlupki.s && o.rodzaj === "okno" && o.od < kon && o.od + o.szer > kon - s.w) kon = o.od;
      }
      // Zlew, zmywarka i płyta są ważniejsze niż drugi słupek – zostawiamy na nie miejsce.
      const potrzebne = naSlupki === slotWody ? 80 + zmyw + (wy.agd.includes("plyta") ? 60 : 0) : 0;
      if (kon - s.w - naSlupki.od < potrzebne || kon !== koniec) break;
      u.dodaj(s, naSlupki.s, kon - s.w);
      koniec = kon - s.w;
    }
    naSlupki.do = koniec;
  }
  let zlewOd: number | null = null;
  if (slotWody && slotWody.do - slotWody.od >= 80) {
    const zmiesciZmyw = slotWody.do - slotWody.od >= 80 + zmyw;
    const cel = (wy.woda?.od ?? slotWody.od + 40) - 40;
    zlewOd = Math.max(slotWody.od, Math.min(slotWody.do - 80 - (zmiesciZmyw ? zmyw : 0), Math.round(cel / 10) * 10));
  }
  // Wypełnianie: przed zlewem szafki, zlew, zmywarka, dalej szafki z płytą na drugiej z nich.
  let plytaWstawiona = !wy.agd.includes("plyta");
  for (const slot of sloty) {
    let kursor = slot.od;
    const wstawCiag = (do_: number) => {
      for (const w of podziel(do_ - kursor)) {
        // Pod płytą: piekarnik (gdy ma być pod blatem) albo szuflady na garnki.
        // Okap nie zawiśnie pod oknem – płyta z okapem tylko poza oknem.
        const naPlyte = !plytaWstawiona && w >= 60 && !(wy.agd.includes("okap") && podOknem(wy.otwory, slot.s, kursor, kursor + w));
        const n: Nowy =
          naPlyte && w === 60 && dolnyPiekarnik
            ? { nazwa: "Piekarnik pod blatem", strefa: "dolna", rodzaj: "piekarnik", w: 60, h: 72, d: 56 }
            : naPlyte
              ? { nazwa: `Szuflady ${w}`, strefa: "dolna", rodzaj: "szuflady", w, h: 72, d: 56 }
              : { nazwa: `Szafka dolna ${w}`, strefa: "dolna", rodzaj: "szafka", w, h: 72, d: 56 };
        const el = u.dodaj(n, slot.s, kursor);
        if (el && naPlyte) {
          // Płyta na szafce z szufladami (garnki pod ręką), okap nad nią.
          u.dodaj({ nazwa: wy.gaz ? "Płyta gazowa 60" : "Płyta indukcyjna 60", strefa: "blat", rodzaj: wy.gaz ? "plyta-gaz" : "plyta-indukcja", w: 60, h: wy.gaz ? 6 : 5, d: 52 }, slot.s, kursor + (w - 60) / 2);
          if (wy.agd.includes("okap")) u.dodaj({ nazwa: "Okap kominowy 60", strefa: "gorna", rodzaj: "okap", w: 60, h: 48, d: 48 }, slot.s, kursor + (w - 60) / 2);
          plytaWstawiona = true;
        }
        kursor += w;
      }
    };
    if (slot === slotWody && zlewOd !== null) {
      wstawCiag(zlewOd);
      kursor = zlewOd;
      u.dodaj(zlew, slot.s, kursor);
      u.dodaj({ nazwa: "Zlewozmywak", strefa: "blat", rodzaj: "zlewozmywak", w: 50, h: 18, d: 40 }, slot.s, kursor + 15);
      kursor += 80;
      if (zmyw && kursor + zmyw <= slot.do) {
        u.dodaj({ nazwa: `Zmywarka do zabudowy ${zmyw}`, strefa: "dolna", rodzaj: "zmywarka", w: zmyw, h: 72, d: 56 }, slot.s, kursor);
        kursor += zmyw;
      }
    }
    wstawCiag(slot.do);
  }
  // Szafki górne nad dolnymi (nie nad oknem, nie nad płytą – tam okap, nie nad narożną od strony B).
  const dolne = u.elementy.filter((e) => e.strefa === "dolna");
  for (const e of dolne) {
    const s: Sciana = e.rot === 0 ? "A" : "B";
    const r = rect(e);
    const od = s === "A" ? r.x0 : r.z0;
    const doK = od + e.w;
    if (podOknem(wy.otwory, s, od, doK)) continue;
    if (e.rodzaj === "narozna") {
      u.dodaj({ nazwa: "Szafka górna 60", strefa: "gorna", rodzaj: "szafka", w: 60, h: gornaH, d: 32 }, "A", 0);
      continue;
    }
    if (e.w > 120) continue;
    u.dodaj({ nazwa: `Szafka górna ${e.w}`, strefa: "gorna", rodzaj: "szafka", w: e.w, h: gornaH, d: 32 }, s, od);
  }
  if (wy.agd.includes("mikrofalowka")) {
    const wolnaGorna = u.elementy.find((e) => e.strefa === "gorna" && e.rodzaj === "szafka" && e.w === 60);
    if (wolnaGorna) {
      wolnaGorna.rodzaj = "mikrofalowka";
      wolnaGorna.nazwa = "Mikrofalówka do zabudowy";
      wolnaGorna.h = 38;
      wolnaGorna.d = 35;
      delete wolnaGorna.wnetrze;
    }
  }
  return u.wynik();
}

function szafa(plan: PlanKuchni, wy: Wywiad): PlanKuchni {
  const u = new Ukladacz(plan);
  const H = Math.max(180, Math.min(280, wy.wysokosc - 2));
  const p = wy.potrzeby;
  const preset = p.includes("szuflady")
    ? "szafa-szuflady"
    : p.includes("skladane") && (p.includes("dlugie") || p.includes("koszule"))
      ? "szafa-pol-na-pol"
      : p.includes("koszule") && !p.includes("dlugie")
        ? "szafa-dwa-drazki"
        : !p.includes("dlugie") && !p.includes("koszule")
          ? "szafa-polki"
          : "szafa-drazek";
  for (const [a, b] of wolneOdcinki(plan.scianaA, wy.otwory, "A")) {
    const dl = Math.min(b - a, 400);
    if (wy.drzwiSzafy === "przesuwne" && dl >= 100) {
      const el = { nazwa: `Szafa przesuwna ${dl}`, strefa: "wysoka" as const, rodzaj: "szafa-przesuwna" as const, w: dl, h: Math.max(180, H), d: 65 };
      u.dodaj({ ...el, wnetrze: wnetrzePresetu(preset, el) }, "A", a);
    } else {
      let kursor = a;
      // Szafy uchylne po max 100 cm (dwa skrzydła po 50), równe moduły; ostatni bierze resztę.
      const ile = Math.ceil(dl / 100);
      // Parzyste szerokości – środki modułów w pełnych centymetrach, moduły stykają się bez nakładania.
      const rowna = Math.floor(dl / ile / 2) * 2;
      const czesci = Array.from({ length: ile }, (_, i) => (i < ile - 1 ? rowna : dl - rowna * (ile - 1)));
      for (const w of czesci) {
        if (w < 30) break;
        const el = { nazwa: `Szafa ${w}`, strefa: "wysoka" as const, rodzaj: "szafa" as const, w, h: Math.max(100, H), d: 60 };
        u.dodaj({ ...el, wnetrze: wnetrzePresetu(preset, el) }, "A", kursor);
        kursor += w;
      }
    }
  }
  return u.wynik();
}

function salon(plan: PlanKuchni, wy: Wywiad): PlanKuchni {
  const u = new Ukladacz(plan);
  const lista: Nowy[] = [];
  if (wy.meble.includes("nocne")) lista.push({ nazwa: "Szafka nocna 45", strefa: "dolna", rodzaj: "komoda", w: 45, h: 50, d: 40 });
  if (wy.meble.includes("komoda")) lista.push({ nazwa: "Komoda 120", strefa: "dolna", rodzaj: "komoda", w: 120, h: 85, d: 45 });
  if (wy.meble.includes("rtv")) lista.push({ nazwa: "Szafka RTV 160", strefa: "dolna", rodzaj: "rtv", w: 160, h: 45, d: 40 });
  if (wy.meble.includes("regal")) lista.push({ nazwa: "Regał 80", strefa: "wysoka", rodzaj: "regal", w: 80, h: Math.min(220, wy.wysokosc - 40), d: 35 });
  if (wy.meble.includes("nocne")) lista.push({ nazwa: "Szafka nocna 45", strefa: "dolna", rodzaj: "komoda", w: 45, h: 50, d: 40 });
  let kursor = 0;
  for (const [a, b] of wolneOdcinki(plan.scianaA, wy.otwory, "A")) {
    kursor = Math.max(kursor, a);
    while (lista.length && kursor + lista[0].w <= b) {
      const n = lista.shift()!;
      u.dodaj({ ...n, wnetrze: wnetrzeDomyslne(n) ?? undefined }, "A", kursor);
      kursor += n.w + (n.rodzaj === "komoda" && n.w < 50 ? 10 : 20);
    }
  }
  return u.wynik();
}

function lazienka(plan: PlanKuchni, wy: Wywiad): PlanKuchni {
  const u = new Ukladacz(plan);
  const w = Math.max(40, Math.min(160, wy.umywalka));
  const odcinki = wolneOdcinki(plan.scianaA, wy.otwory, "A");
  const odc = odcinki[0];
  if (!odc) return u.wynik();
  const cel = wy.woda && wy.woda.sciana === "A" ? wy.woda.od - w / 2 : odc[0];
  const od = Math.max(odc[0], Math.min(odc[1] - w, Math.round(cel)));
  const um = { nazwa: `Szafka pod umywalkę ${w}`, strefa: "dolna" as const, rodzaj: "umywalka" as const, w, h: 55, d: 46 };
  u.dodaj({ ...um, wnetrze: wnetrzeDomyslne(um) ?? undefined }, "A", od);
  if (wy.slupek) {
    const sl = { nazwa: "Słupek łazienkowy 40", strefa: "wysoka" as const, rodzaj: "szafa" as const, w: 40, h: Math.min(180, wy.wysokosc - 60), d: 33 };
    const przed = od - 40 - 10 >= odc[0] ? od - 50 : null;
    const za = od + w + 10 + 40 <= odc[1] ? od + w + 10 : null;
    const gdzie = za ?? przed;
    if (gdzie !== null) u.dodaj({ ...sl, wnetrze: wnetrzeDomyslne(sl) ?? undefined }, "A", gdzie);
  }
  return u.wynik();
}

/** Propozycja układu z odpowiedzi; zastępuje elementy planu (ściany i wywiad zostają). */
export function ulozPropozycje(typ: TypProjektu, plan: PlanKuchni, wy: Wywiad): PlanKuchni {
  const baza: PlanKuchni = { ...plan, elementy: [], wywiad: wy };
  if (typ === "szafa") return szafa({ ...baza, uklad: "ciag" }, wy);
  if (typ === "komoda") return salon({ ...baza, uklad: "ciag" }, wy);
  if (typ === "lazienka") return lazienka({ ...baza, uklad: "ciag" }, wy);
  return kuchnia(baza, wy);
}
