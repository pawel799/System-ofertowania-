"use client";

/*
 * "Kreator na żywo": przyklejony pokaz sterowany przewinięciem.
 * Po lewej kroki, po prawej scena 3D (formatki składają się w szafki, lecą na arkusze,
 * potem prawdziwy model kuchni) i makieta kreatora, po której jeździ kursor i klika.
 *
 * Wydajność: postęp liczony raz na klatkę (rAF), kursor i scena czytają go bez renderu Reacta,
 * makieta renderuje się tylko przy zmianie zaokrąglonego postępu. Scena 3D (three.js)
 * doczytuje się dopiero, gdy sekcja zbliża się do ekranu; model kuchni (~8 MB) tylko na
 * szybkim łączu i bez trybu oszczędzania danych.
 * Ograniczony ruch: bez przyklejania i kursora – pięć statycznych klatek makiety.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { FRONTS } from "@/components/catalog";
import { HOME } from "@/content/strona-glowna";
import { CABINET_LABEL } from "./kreator/silnik/model";
import { edgeCode, groupParts, materialLabel } from "./kreator/silnik/parts";
import { btn } from "../styles";
import { nr } from "./Section";
import {
  ADD_AT,
  COPY_AT,
  DEMO_CABINETS,
  FRONT_AT,
  LAYOUT,
  LINK_AT,
  PARTS,
  PHASES,
  SETTINGS,
  STATS,
  easeInOut,
  easeOut,
  frontAt,
  phaseOf,
  span,
} from "./kreator/demoData";
import { setProgress } from "./kreator/progress";

const ShowScene = dynamic(() => import("./kreator/ShowScene"), { ssr: false, loading: () => null });

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ---------- Skrypt kursora: dokąd jedzie i kiedy klika ---------- */

const CLICKS: { at: number; t: string }[] = [
  { at: ADD_AT[0], t: "add-0" },
  { at: ADD_AT[1], t: "add-1" },
  { at: ADD_AT[2], t: "add-2" },
  { at: 0.155, t: "w-2" },
  { at: PHASES[1], t: "tab-1" },
  { at: PHASES[2], t: "tab-2" },
  { at: PHASES[3], t: "tab-3" },
  ...FRONT_AT.map((f) => ({ at: f.p, t: `sw-${f.id}` })),
  { at: PHASES[4], t: "tab-4" },
  { at: LINK_AT, t: "link" },
  { at: COPY_AT, t: "copy" },
];
const CLICK_LEN = 0.012;
/** Ile sekund gra sama każda faza (szafki, formatki, rozkrój, materiały, link). */
const PHASE_SECONDS = [4.5, 3, 4, 4.5, 4];
const pressedAt = (p: number) => CLICKS.find((c) => p >= c.at && p < c.at + CLICK_LEN)?.t ?? "";

/** Wpisywanie szerokości górnej szafki: 600 -> 8 -> 80 -> 800. */
function widthText(p: number) {
  const t = span(p, 0.158, 0.19);
  if (t <= 0) return "600";
  const s = "800".slice(0, Math.max(1, Math.ceil(t * 3)));
  return s;
}

const LINK_URL = "system-ofertowania.pages.dev/oferta/k7Rp2xQa9m";
const fmt = (n: number, d = 0) => n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
const GROUPED = groupParts(PARTS);
const SHEET = LAYOUT[0].sheets[0];

/* ---------- Makieta kreatora (stały rozmiar 640 × 430, skalowana do miejsca) ---------- */

const MOCK_W = 640;
const MOCK_H = 430;
const TABS = ["Szafki", "Formatki", "Rozkrój", "Materiały", "Link"];

function Mock({ p, pressed }: { p: number; pressed: string }) {
  const phase = phaseOf(p);
  const press = (t: string) => ({ "data-t": t, "data-pressed": pressed === t ? "" : undefined });
  const front = frontAt(p);

  return (
    <div className="ks-mock" style={{ width: MOCK_W, height: MOCK_H }}>
      <div className="ks-bar">
        <span className="ks-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="ks-title">Kreator · KUCH-2026/14</span>
        <span className="ks-save">{p > 0.04 ? "Zapisano" : "Szkic"}</span>
      </div>
      <div className="ks-tabs">
        {TABS.map((t, i) => (
          <span key={t} className="ks-tab" aria-current={phase === i ? "true" : undefined} {...press(`tab-${i}`)}>
            {t}
          </span>
        ))}
      </div>

      <div className="ks-body">
        {phase === 0 ? (
          <>
            <div className="ks-table">
              <div className="ks-tr ks-th">
                <span>Szafka</span>
                <span>Typ</span>
                <span>Szer.</span>
                <span>Wys.</span>
                <span>Gł.</span>
              </div>
              {DEMO_CABINETS.map((c, i) =>
                p >= ADD_AT[i] ? (
                  <div key={c.id} className="ks-tr ks-row-in">
                    <span className="ks-strong">{c.name}</span>
                    <span>{CABINET_LABEL[c.kind]}</span>
                    <span className="ks-num" {...(i === 2 ? press("w-2") : {})} data-focus={i === 2 && p > 0.155 && p < 0.2 ? "" : undefined}>
                      {i === 2 ? widthText(p) : c.width}
                    </span>
                    <span className="ks-num">{c.height}</span>
                    <span className="ks-num">{c.depth}</span>
                  </div>
                ) : null,
              )}
              {p < ADD_AT[0] ? <p className="ks-empty">Dodaj szafki, żeby policzyć formatki.</p> : null}
            </div>
            <div className="ks-add">
              {DEMO_CABINETS.map((c, i) => (
                <span key={c.id} className="ks-btn" {...press(`add-${i}`)}>
                  + {CABINET_LABEL[c.kind]}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {phase === 1 ? (
          <>
            <div className="ks-stats">
              <div>
                <small>Formatki</small>
                <b>{fmt(Math.round(STATS.count * easeOut(span(p, 0.2, 0.3))))} szt.</b>
              </div>
              <div>
                <small>Powierzchnia</small>
                <b>{fmt(STATS.area * easeOut(span(p, 0.21, 0.31)), 2)} m²</b>
              </div>
              <div>
                <small>Okleina {SETTINGS.edge}</small>
                <b>{fmt(STATS.edge * easeOut(span(p, 0.22, 0.32)), 1)} m</b>
              </div>
            </div>
            <div className="ks-table ks-parts">
              {GROUPED.slice(0, 8).map((g, i) =>
                p >= 0.2 + i * 0.012 ? (
                  <div key={i} className="ks-tr ks-row-in">
                    <span className="ks-strong">{g.label}</span>
                    <span className="ks-faint">{materialLabel(g.material, SETTINGS)}</span>
                    <span className="ks-num">
                      {g.length}×{g.width}
                    </span>
                    <span className="ks-num">×{g.qty}</span>
                    <span className="ks-num">{edgeCode(g.edges)}</span>
                  </div>
                ) : null,
              )}
            </div>
          </>
        ) : null}

        {phase === 2 ? (
          <div className="ks-cut">
            <svg viewBox={`0 0 ${SETTINGS.sheetLength} ${SETTINGS.sheetWidth}`} aria-hidden>
              <rect width={SETTINGS.sheetLength} height={SETTINGS.sheetWidth} className="ks-board" />
              {SHEET.placements.map((pl, i) => {
                const show = span(p, 0.37 + (i / SHEET.placements.length) * 0.13, 0.4 + (i / SHEET.placements.length) * 0.13);
                return show > 0 ? (
                  <rect
                    key={i}
                    x={pl.x}
                    y={pl.y}
                    width={pl.w}
                    height={pl.h}
                    className="ks-part"
                    style={{ opacity: show, transform: `translateY(${(1 - easeOut(show)) * -60}px)` }}
                  />
                ) : null;
              })}
            </svg>
            <div className="ks-stats ks-stats-col">
              <div>
                <small>Arkusze</small>
                <b>{STATS.sheets}</b>
              </div>
              <div>
                <small>Wykorzystanie</small>
                <b>{fmt(STATS.usage * 100 * easeOut(span(p, 0.4, 0.54)), 1)}%</b>
              </div>
              <div>
                <small>Rzaz</small>
                <b>{SETTINGS.kerf} mm</b>
              </div>
            </div>
          </div>
        ) : null}

        {phase === 3 ? (
          <div className="ks-mats">
            <small>Fronty</small>
            <div className="ks-swatches">
              {FRONTS.map((f) => (
                <span
                  key={f.id}
                  className="ks-sw"
                  aria-current={front === f.id ? "true" : undefined}
                  style={{ "--c": f.color } as CSSProperties}
                  {...press(`sw-${f.id}`)}
                />
              ))}
            </div>
            <p className="ks-mat-name">
              Front: <b>{FRONTS.find((f) => f.id === front)?.name}</b>
            </p>
            <small>Blat</small>
            <div className="ks-seg">
              <span aria-current="true">Kwarcyt Calacatta</span>
              <span>Granit</span>
              <span>Laminat dąb</span>
            </div>
            <p className="ks-hint">Kuchnia w 3D zmienia się od razu – tak samo zobaczy to klient.</p>
          </div>
        ) : null}

        {phase === 4 ? (
          <div className="ks-link">
            <span className="ks-btn ks-btn-ink" {...press("link")}>
              Utwórz link dla klienta
            </span>
            {p >= LINK_AT ? (
              <div className="ks-row-in">
                <div className="ks-linkbox">
                  <span>{LINK_URL.slice(0, Math.ceil(LINK_URL.length * span(p, LINK_AT, LINK_AT + 0.03)))}</span>
                  <span className="ks-btn" {...press("copy")}>
                    Kopiuj
                  </span>
                </div>
                <div className="ks-kv">
                  <small>Ważny do</small>
                  <b>19 lis</b>
                  <small>PIN</small>
                  <b className="ks-num">4821</b>
                  <small>Otwarcia</small>
                  <b>{p > 0.95 ? 1 : 0}</b>
                </div>
              </div>
            ) : null}
            {p >= COPY_AT ? <div className="ks-toast ks-row-in">Skopiowano link · wyślij go klientowi</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- Pokaz ---------- */

type Net = { saveData?: boolean; effectiveType?: string };

export default function KreatorShow() {
  const k = HOME.kreator;
  const section = useRef<HTMLDivElement>(null);
  const mockBox = useRef<HTMLDivElement>(null);
  const mockRoot = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(0);
  const [pressed, setPressed] = useState("");
  const [scale, setScale] = useState(0.8);
  const [near, setNear] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [kitchen, setKitchen] = useState(false);
  const [small, setSmall] = useState(false);
  const kitchenAllowed = useRef(false);
  // Ostatnia funkcja klatki: wołana też po renderze makiety, bo cel kursora może dopiero się pojawić.
  const frameRef = useRef<() => void>(() => undefined);

  // Ograniczony ruch, rozmiar ekranu, łącze.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sm = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      setReduced(mq.matches);
      setSmall(sm.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    sm.addEventListener("change", sync);
    const net = (navigator as Navigator & { connection?: Net }).connection;
    kitchenAllowed.current = !(net?.saveData || /(^|-)2g$|3g/.test(net?.effectiveType ?? ""));
    return () => {
      mq.removeEventListener("change", sync);
      sm.removeEventListener("change", sync);
    };
  }, []);

  // Scena 3D dopiero, gdy sekcja jest blisko ekranu.
  useEffect(() => {
    const el = section.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // Skala makiety do dostępnego miejsca.
  useEffect(() => {
    const el = mockBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setScale(Math.min(width / MOCK_W, height / MOCK_H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [reduced]);

  // Przewijanie -> postęp, kursor, klatka makiety. Raz na klatkę.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let lastQ = -1;
    let lastPressed = "";
    const cur = { x: MOCK_W * 0.7, y: MOCK_H * 0.8 };

    const targetOf = (t: string) => {
      const root = mockRoot.current;
      const el = root?.querySelector<HTMLElement>(`[data-t="${t}"]`);
      if (!root || !el) return null;
      const r = el.getBoundingClientRect();
      const o = root.getBoundingClientRect();
      const s = o.width / MOCK_W || 1;
      return { x: (r.left - o.left + r.width * 0.55) / s, y: (r.top - o.top + r.height * 0.6) / s };
    };

    let phaseNow = -1;
    let enteredAt = 0;

    const frame = () => {
      raf = 0;
      const el = section.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrollP = Math.min(1, Math.max(0, total > 0 ? -rect.top / total : 0));

      // Przewinięcie wybiera fazę, a w jej obrębie pokaz gra sam (kursor, kliknięcia, 3D).
      // Zegar fazy rusza, gdy scena jest przyklejona i karta jest widoczna.
      const now = performance.now();
      const engaged = rect.top <= 1 && rect.bottom >= window.innerHeight - 1 && !document.hidden;
      const ph = phaseOf(scrollP);
      if (ph !== phaseNow || !engaged) {
        phaseNow = ph;
        enteredAt = now;
      }
      const a = PHASES[ph];
      const b = PHASES[ph + 1];
      const local = span(scrollP, a, b);
      const timed = engaged ? (now - enteredAt) / 1000 / PHASE_SECONDS[ph] : 0;
      const p = a + (b - a) * Math.min(0.999, Math.max(local, timed));
      setProgress(p);
      if (engaged && timed < 1 && local < 0.999) raf = requestAnimationFrame(frame);

      const nq = Math.floor(p * 500) / 500;
      if (nq !== lastQ) {
        lastQ = nq;
        setQ(nq);
      }
      const pr = pressedAt(p);
      if (pr !== lastPressed) {
        lastPressed = pr;
        setPressed(pr);
      }
      if (p > 0.12 && kitchenAllowed.current) setKitchen(true);

      // Kursor: jedzie do następnego celu w drugiej połowie odcinka (ease-in-out), potem klika.
      const next = CLICKS.find((c) => p < c.at + CLICK_LEN) ?? CLICKS[CLICKS.length - 1];
      const idx = CLICKS.indexOf(next);
      const prevAt = idx > 0 ? CLICKS[idx - 1].at + CLICK_LEN : 0;
      const t = easeInOut(span(p, prevAt + (next.at - prevAt) * 0.35, next.at));
      const to = targetOf(next.t);
      const from = idx > 0 ? targetOf(CLICKS[idx - 1].t) : null;
      if (to) {
        const fx = from?.x ?? MOCK_W * 0.7;
        const fy = from?.y ?? MOCK_H * 0.85;
        cur.x = fx + (to.x - fx) * t;
        cur.y = fy + (to.y - fy) * t;
      }
      if (cursor.current) {
        const down = pr ? 0.86 : 1;
        cursor.current.style.transform = `translate(${cur.x}px, ${cur.y}px) scale(${down})`;
        cursor.current.dataset.click = pr ? "" : undefined;
        if (!pr) delete cursor.current.dataset.click;
      }

      // Przejście do prawdziwej kuchni: krótkie przyciemnienie sceny.
      const dip = Math.max(0, 1 - Math.abs(p - 0.585) / 0.018);
      // Widok klienta: scena zwęża się do ramki telefonu.
      const phone = easeInOut(span(p, 0.8, 0.86));
      if (canvasWrap.current) {
        canvasWrap.current.style.opacity = String(1 - dip * 0.9);
        const wide = window.innerWidth >= 1024;
        const side = wide ? 36 : 21;
        const top = wide ? 9 : 22;
        const bottom = wide ? 9 : 41;
        canvasWrap.current.style.clipPath =
          phone > 0 ? `inset(${phone * top}% ${phone * side}% ${phone * bottom}% ${phone * side}% round ${phone * 36}px)` : "";
      }
      if (bar.current) bar.current.style.transform = `scaleX(${scrollP})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    frameRef.current = onScroll;
    document.addEventListener("visibilitychange", onScroll);
    frame();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onScroll);
    };
  }, [reduced]);

  // Po renderze nowej klatki makiety (np. pojawiły się próbki frontów) kursor mierzy cel jeszcze raz.
  useEffect(() => frameRef.current(), [q]);

  const phase = phaseOf(q);

  const head = (
    <header className="mx-auto max-w-6xl px-6 md:px-10 xl:px-0">
      <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500">{k.eyebrow}</p>
      <h2 className="mt-4 max-w-3xl text-balance text-3xl leading-[1.08] text-stone-50 md:text-5xl">{k.title}</h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-400">{k.lead}</p>
    </header>
  );

  const cta = (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 pb-24 pt-10 sm:flex-row sm:items-center md:px-10 xl:px-0">
      <Link href={k.cta.href} className={`${btn("solid")} !h-auto min-h-14 w-full !whitespace-normal px-8 py-3 text-center text-base sm:w-auto`}>
        {k.cta.label}
      </Link>
      <p className="text-sm text-stone-500">Projekt zapiszesz w linku. Nic nie trafia na nasz serwer.</p>
    </div>
  );

  if (reduced) {
    // Statyczne klatki zamiast pokazu przewijanego.
    const frames = [0.19, 0.34, 0.55, 0.76, 0.98];
    return (
      <section id={k.id} className="scroll-mt-16 border-t border-white/10 pt-24 md:pt-32">
        {head}
        <ol className="mx-auto mt-14 grid max-w-6xl gap-10 px-6 md:grid-cols-2 md:px-10 xl:px-0">
          {k.steps.map((s, i) => (
            <li key={s.title}>
              <p className="text-[11px] tabular-nums tracking-[0.25em] text-stone-500">{nr(i)}</p>
              <h3 className="mt-2 text-xl text-stone-50">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-400">{s.text}</p>
              <div className="ks-static mt-5" ref={i === 0 ? mockBox : undefined}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: MOCK_W }}>
                  <Mock p={frames[i]} pressed="" />
                </div>
              </div>
            </li>
          ))}
        </ol>
        {cta}
      </section>
    );
  }

  return (
    <section id={k.id} className="scroll-mt-16 border-t border-white/10 pt-24 md:pt-32">
      {head}
      <div ref={section} className="relative mt-12 h-[400vh] lg:h-[440vh]">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          {/* Scena 3D na cały ekran */}
          <div ref={canvasWrap} className="absolute inset-0 bg-[#100f0d]">
            {near ? (
              <SceneBoundary>
                <ShowScene loadKitchen={kitchen} small={small} />
              </SceneBoundary>
            ) : null}
          </div>
          {/* Przyciemnienie pod tekstem: góra na telefonie, lewa strona na komputerze */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-black/85 lg:via-black/25 lg:via-30% lg:to-transparent lg:to-45%"
          />
          <span
            className={`pointer-events-none absolute left-1/2 top-[calc(22%+0.75rem)] z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-stone-200 backdrop-blur transition-opacity duration-300 lg:top-[calc(9%+0.75rem)] ${phase === 4 ? "opacity-100" : "opacity-0"}`}
          >
            Widok klienta
          </span>

          {/* Kroki */}
          <ol className="absolute inset-x-0 top-16 z-10 px-6 pt-3 md:px-10 lg:bottom-0 lg:right-auto lg:flex lg:w-[34%] lg:flex-col lg:justify-center lg:pt-0 xl:pl-[max(2.5rem,calc((100vw-72rem)/2))]">
            {k.steps.map((s, i) => {
              const on = i === phase;
              return (
                <li key={s.title} aria-current={on ? "step" : undefined} className={`${on ? "block" : "hidden"} relative lg:block lg:py-4 lg:pl-6`}>
                  <span aria-hidden className="absolute inset-y-0 left-0 hidden w-px bg-white/15 lg:block" />
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 hidden w-px origin-top bg-stone-50 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] lg:block ${on ? "scale-y-100" : "scale-y-0"}`}
                  />
                  <span className="block text-[11px] tabular-nums tracking-[0.25em] text-stone-400">
                    {nr(i)} <span className="lg:hidden">/ {nr(k.steps.length - 1)}</span>
                  </span>
                  <span className={`mt-1 block text-xl transition-colors duration-200 lg:mt-2 lg:text-2xl ${on ? "text-stone-50" : "text-stone-500"}`}>
                    {s.title}
                  </span>
                  <span className={`mt-1 block max-w-md text-sm leading-relaxed transition-colors duration-200 ${on ? "text-stone-300" : "text-stone-600"}`}>
                    {s.text}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Makieta kreatora z kursorem */}
          <div
            ref={mockBox}
            className="absolute inset-x-3 bottom-4 z-10 h-[38%] sm:inset-x-6 lg:bottom-[5%] lg:left-auto lg:right-[3%] lg:h-[40%] lg:w-[38%] xl:right-[max(2.5rem,calc((100vw-72rem)/2))]"
          >
            <div
              ref={mockRoot}
              className="absolute bottom-0 left-1/2 lg:left-auto lg:right-0"
              style={{
                width: MOCK_W,
                height: MOCK_H,
                transform: `translateX(${small ? "-50%" : "0"}) scale(${scale})`,
                transformOrigin: small ? "bottom center" : "bottom right",
              }}
            >
              <Mock p={q} pressed={pressed} />
              <div ref={cursor} className="ks-cursor" aria-hidden>
                <svg viewBox="0 0 24 24" width="26" height="26">
                  <path d="M4 2.5 20 11l-7 1.8L10 20Z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
                <i className="ks-ripple" />
              </div>
            </div>
          </div>

          {/* Pasek postępu przewinięcia */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-white/10">
            <div ref={bar} className="h-0.5 origin-left bg-stone-100" style={{ transform: "scaleX(0)" }} />
          </div>
        </div>
      </div>
      {cta}
    </section>
  );
}
