"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from "react";
import { COUNTERTOPS, setCountertop } from "../countertopStore";
import { FRONTS, setFront } from "../frontStore";
import { HARDWARE, setHardware } from "../hardwareStore";
import { formatPln, totalPrice } from "../pricing";
import {
  CHANNEL_LABEL,
  COUNTERTOP_COLOR,
  HARDWARE_COLOR,
  LAYOUT_LABEL,
  SAMPLE_OFFERS,
  STATUS_LABEL,
  STATUS_ORDER,
  dayPlus,
  daysFromNowIso,
  newPin,
  newSlug,
  nextOfferId,
  offerMessage,
  stamp,
  type Channel,
  type EventKind,
  type Layout,
  type Offer,
  type Status,
} from "./offers";
import {
  CopyButton,
  Counter,
  HoldButton,
  Seg,
  StatusIcon,
  Toaster,
  Tooltips,
  toast,
} from "./ui";
import { PanelState, TokenDialog } from "./PanelGate";
import { usePanelOffers } from "./usePanelOffers";

// Ta sama scena co na stronie oferty, osadzona w okienku podglądu.
const KitchenGlbScene = dynamic(() => import("../KitchenGlbScene"), {
  ssr: false,
  loading: () => (
    <div
      style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#a8a29e", fontSize: 12 }}
    >
      Wczytywanie sceny…
    </div>
  ),
});

type Filter = "all" | "client" | "fix" | "done";
const FILTERS: { value: Filter; label: string; test: (o: Offer) => boolean }[] = [
  { value: "all", label: "Wszystkie", test: () => true },
  { value: "client", label: "U klienta", test: (o) => o.status === "wyslany" || o.status === "otwarty" },
  { value: "fix", label: "Poprawki", test: (o) => o.status === "poprawki" },
  { value: "done", label: "Gotowe", test: (o) => o.status === "zaakceptowany" },
];

const EVENT_COLOR: Record<EventKind, string> = {
  create: "var(--text-3)",
  send: "var(--accent)",
  open: "var(--teal)",
  comment: "var(--amber)",
  accept: "var(--green)",
  revoke: "var(--red)",
  edit: "var(--g4)",
};

type Draft = { channel: Channel; days: number; comments: boolean; pin: boolean; price: boolean };

function draftFor(o: Offer): Draft {
  const L = o.link;
  return L
    ? { channel: L.channel, days: L.days, comments: L.comments, pin: !!L.pin, price: L.showPrice }
    : { channel: o.contact.includes("@") ? "email" : "sms", days: 7, comments: true, pin: false, price: true };
}

const nameOf = (list: { id: string; name: string }[], id: string) =>
  list.find((x) => x.id === id)?.name ?? id;

const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

export default function PanelApp() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selId, setSelId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "detail">("list");
  const [draft, setDraft] = useState<Draft>(() => draftFor(SAMPLE_OFFERS[0]));
  const [message, setMessage] = useState("");
  const [msgDirty, setMsgDirty] = useState(false);
  const [origin, setOrigin] = useState("");
  const [newOpen, setNewOpen] = useState<null | { instant: boolean }>(null);
  const [menu, setMenu] = useState<null | { instant: boolean }>(null);

  const offer = offers.find((o) => o.id === selId) ?? offers[0];
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const msgRef = useRef<HTMLTextAreaElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  // Panel linku: osobna kolumna na szerokim ekranie, pod modelem na węższym.
  const wide = useMediaQuery("(min-width: 1280px)");

  /* --- Zapis ofert: API w Cloudflare (albo localStorage przy samym next dev) --- */
  useEffect(() => setOrigin(window.location.origin), []);
  const store = usePanelOffers(offers, setOffers, (list) => {
    if (!list.length) return;
    setSelId(list[0].id);
    setDraft(draftFor(list[0]));
  });

  // Scena 3D pokazuje materiały zaznaczonej oferty.
  useEffect(() => {
    if (!offer) return;
    setFront(offer.front);
    setCountertop(offer.countertop);
    setHardware(offer.hardware);
  }, [offer?.front, offer?.countertop, offer?.hardware]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wiadomość odświeża się sama, dopóki ktoś jej nie poprawił ręcznie.
  useEffect(() => {
    if (offer && !msgDirty) setMessage(offerMessage(offer, origin));
  }, [offer, origin, msgDirty]);

  // Blokada przewijania pod oknem dialogowym.
  useEffect(() => {
    document.body.style.overflow = newOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [newOpen]);

  const update = useCallback((id: string, fn: (o: Offer) => Offer) => {
    setOffers((list) => list.map((o) => (o.id === id ? fn(o) : o)));
  }, []);
  const withEvent = (o: Offer, k: EventKind, x: string): Offer => ({
    ...o,
    events: [...o.events, { t: stamp(), k, x }],
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.value === filter)!.test;
    return offers.filter(
      (o) => test(o) && (!q || `${o.id} ${o.title} ${o.client}`.toLowerCase().includes(q)),
    );
  }, [offers, filter, query]);

  const select = useCallback(
    (id: string, opts: { scroll?: boolean } = {}) => {
      const o = offers.find((x) => x.id === id);
      if (!o) return;
      setSelId(id);
      setDraft(draftFor(o));
      setMsgDirty(false);
      if (opts.scroll)
        requestAnimationFrame(() =>
          rootRef.current
            ?.querySelector(`.row[data-id="${CSS.escape(id)}"]`)
            ?.scrollIntoView({ block: "nearest" }),
        );
    },
    [offers],
  );

  /* --- Skróty klawiszowe (bez animacji: używane dziesiątki razy dziennie) --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menu) return setMenu(null);
      }
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,select,[contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey || newOpen) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setNewOpen({ instant: true });
      } else if (["ArrowDown", "ArrowUp", "j", "k"].includes(e.key)) {
        if (!visible.length) return;
        e.preventDefault();
        const i = visible.findIndex((o) => o.id === selId);
        const step = e.key === "ArrowDown" || e.key === "j" ? 1 : -1;
        const next = visible[Math.max(0, Math.min(visible.length - 1, (i < 0 ? 0 : i) + step))];
        if (next.id !== selId) select(next.id, { scroll: true });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu, newOpen, visible, selId, select]);

  const newDialog = newOpen ? (
    <NewOfferDialog
      instant={newOpen.instant}
      nextId={nextOfferId(offers)}
      onClose={() => setNewOpen(null)}
      onCreate={(o) => {
        setOffers((list) => [o, ...list]);
        setFilter("all");
        setQuery("");
        setSelId(o.id);
        setDraft(draftFor(o));
        setMsgDirty(false);
        setView("detail");
        setNewOpen(null);
        toast("Dodano ofertę", { desc: `${o.id} · ${o.title}` });
      }}
    />
  ) : null;
  const tokenDialog = store.mode === "auth" ? <TokenDialog error={store.error} onSubmit={store.submitToken} /> : null;

  if (!offer)
    return (
      <PanelState mode={store.mode} error={store.error} onRetry={store.retry} onNew={() => setNewOpen({ instant: false })}>
        {newDialog}
        {tokenDialog}
        <Toaster />
      </PanelState>
    );

  const L = offer.link;
  const total = totalPrice(offer, offer.base);
  const linkUrl = L ? `${origin}/oferta/${L.slug}` : "";
  const shortUrl = L ? `${origin.replace(/^https?:\/\//, "")}/oferta/${L.slug}` : "";
  const lastTime = (o: Offer) => o.events[o.events.length - 1]?.t ?? "";
  const frontColor = FRONTS.find((f) => f.id === offer.front)?.color ?? "#999";
  const handle = HARDWARE_COLOR[offer.hardware];

  const setMaterial = (kind: "front" | "countertop" | "hardware", id: string) => {
    if (offer[kind] === id) return;
    const label =
      kind === "front"
        ? `Front: ${nameOf(FRONTS, id)}`
        : kind === "countertop"
          ? `Blat: ${nameOf(COUNTERTOPS, id)}`
          : `Okucia: ${nameOf(HARDWARE, id)}`;
    update(offer.id, (o) => withEvent({ ...o, [kind]: id }, "edit", label));
  };

  const createLink = () => {
    if (!offer.contact.trim()) {
      toast("Brakuje kontaktu", { type: "err", desc: "Wpisz e-mail lub telefon klienta." });
      return;
    }
    const link = {
      slug: newSlug(),
      days: draft.days,
      expires: dayPlus(draft.days),
      expiresAt: daysFromNowIso(draft.days),
      pin: draft.pin ? newPin() : null,
      comments: draft.comments,
      showPrice: draft.price,
      channel: draft.channel,
      views: 0,
    };
    update(offer.id, (o) =>
      withEvent(
        { ...o, link, status: o.status === "zaakceptowany" ? o.status : "wyslany" },
        "send",
        `Link utworzony · ${CHANNEL_LABEL[draft.channel]} · ${draft.days === 1 ? "24 h" : `${draft.days} dni`}${link.pin ? " · PIN" : ""}`,
      ),
    );
    setMsgDirty(false);
    toast("Link gotowy", { desc: "Skopiuj wiadomość i wyślij ją klientowi." });
  };

  const revoke = () => {
    update(offer.id, (o) =>
      withEvent(
        { ...o, link: null, status: o.status === "zaakceptowany" ? o.status : "szkic" },
        "revoke",
        "Link unieważniony",
      ),
    );
    setDraft(draftFor({ ...offer, link: null }));
    setMsgDirty(false);
    toast("Link unieważniony", { desc: "Stary adres przestał działać." });
  };

  const setStatus = (s: Status) => {
    setMenu(null);
    statusBtnRef.current?.focus();
    if (s === offer.status) return;
    update(offer.id, (o) => withEvent({ ...o, status: s }, "edit", `Status: ${STATUS_LABEL[s]}`));
    toast(`Status: ${STATUS_LABEL[s]}`, { type: "info" });
  };

  const fallbackSelect = (ref: RefObject<HTMLInputElement | HTMLTextAreaElement>) => () => {
    ref.current?.focus();
    ref.current?.select();
    toast("Zaznaczyłem tekst", { type: "info", desc: "Skopiuj go skrótem klawiszowym." });
  };

  const linkPanel = (
    <>
      <section className="side">
        <h2>Link dla klienta</h2>
        <p className="lede">
          {L
            ? "Link działa. Klient nie musi się logować."
            : "Klient dostanie stronę oferty z kuchnią w 3D. Działa na telefonie, bez logowania."}
        </p>

        {L ? (
          <>
            <div className="linkbox">
              <input ref={linkRef} id="link-out" readOnly value={linkUrl} aria-label="Link dla klienta" />
              <CopyButton text={linkUrl} label="Kopiuj link" onFallback={fallbackSelect(linkRef)} />
            </div>
            <dl className="kv">
              <dt>Ważny do</dt>
              <dd>{L.expires}</dd>
              <dt>Kanał</dt>
              <dd>{CHANNEL_LABEL[L.channel]}</dd>
              <dt>PIN</dt>
              <dd className="mono">{L.pin ?? "brak"}</dd>
              <dt>Otwarcia</dt>
              <dd>
                <Counter value={L.views} />
              </dd>
            </dl>
            <div className="actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  void copyMessage(message).then(
                    () => toast("Wiadomość skopiowana"),
                    fallbackSelect(msgRef),
                  )
                }
              >
                Kopiuj wiadomość
              </button>
              <HoldButton holdLabel="Przytrzymaj…" ariaLabel="Przytrzymaj, aby unieważnić link" onConfirm={revoke}>
                Unieważnij
              </HoldButton>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="contact">Do kogo</label>
              <input
                id="contact"
                className="input"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={offer.contact}
                onChange={(e) => update(offer.id, (o) => ({ ...o, contact: e.target.value }))}
              />
            </div>
            <div className="field">
              <span className="lab">Kanał</span>
              <Seg
                label="Kanał"
                value={draft.channel}
                onChange={(channel) => setDraft((d) => ({ ...d, channel }))}
                options={(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
              />
            </div>
            <div className="field">
              <span className="lab">Ważność</span>
              <Seg
                label="Ważność linku"
                value={String(draft.days)}
                onChange={(v) => setDraft((d) => ({ ...d, days: Number(v) }))}
                options={[
                  { value: "1", label: "24 h" },
                  { value: "7", label: "7 dni" },
                  { value: "30", label: "30 dni" },
                ]}
              />
            </div>
            <div className="toggles">
              {(
                [
                  ["comments", "Klient może dodać uwagi"],
                  ["pin", "Zabezpiecz PIN-em"],
                  ["price", "Pokaż cenę"],
                ] as const
              ).map(([key, text]) => (
                <label className="tg" key={key} htmlFor={`opt-${key}`}>
                  {text}
                  <input
                    id={`opt-${key}`}
                    type="checkbox"
                    className="switch"
                    checked={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                  />
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-ink wide" onClick={createLink}>
              Utwórz link
            </button>
          </>
        )}

        <div className="field">
          <label htmlFor="msg">Wiadomość</label>
          <textarea
            id="msg"
            ref={msgRef}
            className="input"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setMsgDirty(true);
            }}
          />
        </div>
      </section>

      <section className="side">
        <h2>Podgląd w wiadomości</h2>
        <div className="og">
          <div className="og-img" aria-hidden>
            <div className="og-kitchen">
              <div className="og-top" style={{ background: COUNTERTOP_COLOR[offer.countertop] ?? "#ccc" }} />
              <div className="og-fronts">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    style={{ background: frontColor, "--h": handle ?? "transparent" } as CSSProperties}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="og-body">
            <span className="mono faint">{L ? shortUrl : "link pojawi się po utworzeniu"}</span>
            <b>
              {offer.id}: {offer.title}
            </b>
            <p>Kuchnia w 3D, materiały do wyboru i wycena.</p>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <div className="pnl" data-view={view} ref={rootRef}>
      <header className="top">
        <button type="button" className="btn btn-plain back" onClick={() => setView("list")} aria-label="Wróć do listy">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="logo">
          <span className="logo-mark" aria-hidden>
            SK
          </span>
          Studio Kuchnie
        </div>
        <div className="crumb">
          <span>/</span>
          <span>Oferty</span>
          <span className="c-offer" style={{ display: "contents" }}>
            <span>/</span>
            <b>{offer.id}</b>
          </span>
        </div>
        <span className="grow" />
        {store.mode === "local" ? (
          <span className="sample" data-tip="Brak API (zwykły next dev): oferty zapisują się tylko w tej przeglądarce">
            Dane demo
          </span>
        ) : (
          <span className="sample" data-tip="Oferty zapisują się w Cloudflare i działają na każdym urządzeniu">
            {store.sync === "saving" ? "Zapisywanie…" : store.sync === "error" ? "Błąd zapisu" : "Zapisano"}
          </span>
        )}
        <button
          type="button"
          className="btn btn-ink"
          data-tip="Nowa oferta"
          data-kbd="N"
          onClick={(e) => setNewOpen({ instant: e.detail === 0 })}
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span>Nowa</span>
        </button>
      </header>

      <div className="shell">
        <aside className="surface s-list" aria-label="Oferty">
          <div className="l-head">
            <label className="search">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                placeholder="Szukaj ofert"
                autoComplete="off"
                enterKeyHint="search"
                aria-label="Szukaj ofert"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>/</kbd>
            </label>
            <Seg
              label="Filtr"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
            />
          </div>
          <ul className="rows">
            {visible.length ? (
              visible.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="row"
                    data-id={o.id}
                    aria-current={o.id === offer.id}
                    onClick={() => {
                      select(o.id);
                      setView("detail");
                      if (window.matchMedia("(max-width: 899px)").matches) window.scrollTo(0, 0);
                    }}
                  >
                    <StatusIcon status={o.status} />
                    <span className="row-title">{o.title}</span>
                    <span
                      className="row-swatch"
                      title={nameOf(FRONTS, o.front)}
                      style={{ background: FRONTS.find((f) => f.id === o.front)?.color }}
                    />
                    <span className="row-sub">
                      <span className="mono">{o.id}</span> · {o.client} · {lastTime(o)}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="empty">
                {query ? `Żadna oferta nie pasuje do „${query}”.` : "W tym widoku nie ma jeszcze ofert."}
              </li>
            )}
          </ul>
        </aside>

        <main className="surface s-main" aria-label="Oferta">
          <div className="m-head">
            <div className="m-title">
              <div className="m-meta">
                <span className="mono">{offer.id}</span>
                <span>{offer.client}</span>
              </div>
              <h1>{offer.title}</h1>
            </div>
            <button
              ref={statusBtnRef}
              type="button"
              className="btn btn-ghost"
              aria-haspopup="menu"
              aria-expanded={!!menu}
              onClick={(e) => setMenu(menu ? null : { instant: e.detail === 0 })}
            >
              <StatusIcon status={offer.status} />
              {STATUS_LABEL[offer.status]}
              <svg className="chev" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="vp">
            <KitchenGlbScene embedded />
            <div className="vp-bar">
              <span className="vp-tag">Podgląd 3D · {LAYOUT_LABEL[offer.layout]}</span>
              {L ? (
                <a className="vp-open" href={`/oferta/${L.slug}`} target="_blank" rel="noreferrer">
                  Otwórz jako klient
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M6 3.5h6.5V10M12.5 3.5 4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>

          <dl className="specs">
            <div>
              <dt>Wycena netto</dt>
              <dd className="price">{formatPln(total)}</dd>
            </div>
            <div>
              <dt>Układ</dt>
              <dd>{LAYOUT_LABEL[offer.layout]}</dd>
            </div>
            <div>
              <dt>Zabudowa bazowo</dt>
              <dd>{formatPln(offer.base)}</dd>
            </div>
            <div>
              <dt>Kontakt</dt>
              <dd>{offer.contact || "—"}</dd>
            </div>
          </dl>

          <div className="mats">
            <div>
              <div className="mat-label">
                Fronty <span>{nameOf(FRONTS, offer.front)}</span>
              </div>
              <div className="swatches" role="radiogroup" aria-label="Fronty">
                {FRONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="sw"
                    role="radio"
                    aria-checked={offer.front === f.id}
                    aria-label={f.name}
                    data-tip={f.name}
                    onClick={() => setMaterial("front", f.id)}
                  >
                    <span style={{ background: f.color }} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mat-label">Blat</div>
              <Seg
                label="Blat"
                value={offer.countertop}
                onChange={(id) => setMaterial("countertop", id)}
                options={COUNTERTOPS.map((c) => ({
                  value: c.id,
                  label: (
                    <>
                      {c.name}
                      {c.delta !== 0 && <span className="delta">{`${c.delta > 0 ? "+" : ""}${formatPln(c.delta)}`}</span>}
                    </>
                  ),
                }))}
              />
            </div>
            <div>
              <div className="mat-label">Okucia</div>
              <Seg
                label="Okucia"
                value={offer.hardware}
                onChange={(id) => setMaterial("hardware", id)}
                options={HARDWARE.map((h) => ({ value: h.id, label: h.name }))}
              />
            </div>
          </div>

          {offer.comment ? (
            <div className="callout">
              <div className="callout-h">
                <StatusIcon status="poprawki" />
                Uwagi klienta
              </div>
              <p>{offer.comment}</p>
            </div>
          ) : null}

          {!wide ? <div className="side-inline">{linkPanel}</div> : null}

          <section className="sec">
            <h2>Aktywność</h2>
            <ol className="tl">
              {[...offer.events].reverse().map((ev, i) => (
                <li key={`${ev.t}-${i}`}>
                  <i className="tl-dot" style={{ background: EVENT_COLOR[ev.k] }} />
                  <span className="tl-body">
                    <span className="tl-text">{ev.x}</span>
                    <span className="tl-time mono">{ev.t}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </main>

        {wide ? (
          <aside className="surface s-side" aria-label="Link dla klienta">
            {linkPanel}
          </aside>
        ) : null}
      </div>

      {menu ? (
        <StatusMenu
          anchor={statusBtnRef.current}
          current={offer.status}
          instant={menu.instant}
          onPick={setStatus}
          onClose={() => setMenu(null)}
        />
      ) : null}

      {newDialog}

      {tokenDialog}
      <Tooltips />
      <Toaster />
    </div>
  );
}

function copyMessage(text: string) {
  try {
    return navigator.clipboard.writeText(text);
  } catch (e) {
    return Promise.reject(e);
  }
}

/* ---------- Menu statusu: rośnie od przycisku ---------- */

function StatusMenu({
  anchor,
  current,
  instant,
  onPick,
  onClose,
}: {
  anchor: HTMLElement | null;
  current: Status;
  instant: boolean;
  onPick: (s: Status) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const menu = ref.current;
    if (!menu || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w));
    let y = r.bottom + 6;
    let originY = "0";
    if (y + h > window.innerHeight - 8) {
      y = r.top - h - 6;
      originY = "100%";
    }
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transformOrigin = `${r.right - x - r.width / 2}px ${originY}`;
    const raf = requestAnimationFrame(() => {
      setOpen(true);
      (menu.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu.querySelector<HTMLElement>(".mi"))?.focus();
    });
    const outside = (e: PointerEvent) => {
      if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeRef.current();
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", outside);
    };
  }, [anchor]);

  return (
    <div
      ref={ref}
      className="menu"
      role="menu"
      data-open={open ? "" : undefined}
      data-instant={instant ? "" : undefined}
      onKeyDown={(e) => {
        const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(".mi") ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          items[(i + 1) % items.length]?.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          items[(i - 1 + items.length) % items.length]?.focus();
        } else if (e.key === "Tab") onClose();
        else if (e.key === "Escape") onClose();
      }}
    >
      {STATUS_ORDER.map((s) => (
        <button key={s} type="button" className="mi" role="menuitemradio" aria-checked={s === current} onClick={() => onPick(s)}>
          <StatusIcon status={s} />
          {STATUS_LABEL[s]}
          {s === current ? (
            <svg className="ok" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ---------- Nowa oferta (modal zostaje na środku) ---------- */

function NewOfferDialog({
  instant,
  nextId,
  onClose,
  onCreate,
}: {
  instant: boolean;
  nextId: string;
  onClose: () => void;
  onCreate: (o: Offer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    client: "",
    contact: "",
    title: "",
    layout: "L" as Layout,
    base: "24900",
    front: FRONTS[0].id,
    countertop: COUNTERTOPS[0].id,
    hardware: HARDWARE[0].id,
  });

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    firstRef.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wyjście szybsze niż wejście.
  const close = () => {
    setClosing(true);
    setOpen(false);
    setTimeout(onClose, instant ? 0 : 150);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const client = form.client.trim();
    const title = form.title.trim();
    if (!client || !title) {
      setError("Uzupełnij klienta i nazwę oferty.");
      return;
    }
    const base = Number(form.base.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(base) || base <= 0) {
      setError("Cena bazowa musi być liczbą większą od zera.");
      return;
    }
    const company = /^(pracownia|firma|apartamenty|studio|sklep|biuro)/i.test(client);
    onCreate({
      id: nextId,
      title,
      client,
      greet: !company && /\s/.test(client) ? client.split(/\s+/)[0] : null,
      contact: form.contact.trim(),
      layout: form.layout,
      base,
      front: form.front,
      countertop: form.countertop,
      hardware: form.hardware,
      status: "szkic",
      link: null,
      events: [{ t: stamp(), k: "create", x: "Oferta przygotowana" }],
    });
  };

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div
      className="overlay"
      data-open={open && !closing ? "" : undefined}
      data-instant={instant ? "" : undefined}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div className="backdrop" onClick={close} />
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="new-title" onSubmit={submit} noValidate>
        <div className="m-pad">
          <div className="m-top">
            <h2 id="new-title" style={{ fontSize: 15 }}>
              Nowa oferta <span className="mono faint">{nextId}</span>
            </h2>
            <button type="button" className="icon-btn" aria-label="Zamknij" onClick={close}>
              <CloseIcon />
            </button>
          </div>
          <div className="grid2">
            <div className="field">
              <label htmlFor="n-client">Klient</label>
              <input id="n-client" ref={firstRef} className="input" placeholder="Imię i nazwisko albo firma" autoComplete="off" value={form.client} onChange={(e) => set("client")(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="n-contact">E-mail lub telefon</label>
              <input id="n-contact" className="input" autoComplete="off" autoCapitalize="none" value={form.contact} onChange={(e) => set("contact")(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="n-title">Nazwa oferty</label>
              <input id="n-title" className="input" placeholder="Np. Dąb naturalny, układ L" autoComplete="off" value={form.title} onChange={(e) => set("title")(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="n-base">Zabudowa bazowo (zł netto)</label>
              <input id="n-base" className="input" inputMode="decimal" autoComplete="off" value={form.base} onChange={(e) => set("base")(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <span className="lab">Układ</span>
            <Seg
              label="Układ"
              value={form.layout}
              onChange={(v) => set("layout")(v)}
              options={(Object.keys(LAYOUT_LABEL) as Layout[]).map((l) => ({ value: l, label: l === "wyspa" ? "Wyspa" : l }))}
            />
          </div>
          <div className="field">
            <span className="lab">Fronty</span>
            <div className="swatches" role="radiogroup" aria-label="Fronty">
              {FRONTS.map((f) => (
                <button key={f.id} type="button" className="sw" role="radio" aria-checked={form.front === f.id} aria-label={f.name} data-tip={f.name} onClick={() => set("front")(f.id)}>
                  <span style={{ background: f.color }} />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="lab">Blat</span>
            <Seg label="Blat" value={form.countertop} onChange={set("countertop")} options={COUNTERTOPS.map((c) => ({ value: c.id, label: c.name }))} />
          </div>
          <div className="field">
            <span className="lab">Okucia</span>
            <Seg label="Okucia" value={form.hardware} onChange={set("hardware")} options={HARDWARE.map((h) => ({ value: h.id, label: h.name }))} />
          </div>
          {error ? <p className="err">{error}</p> : null}
        </div>
        <div className="m-foot">
          <button type="button" className="btn btn-ghost" onClick={close}>
            Anuluj
          </button>
          <button type="submit" className="btn btn-ink">
            Dodaj ofertę
          </button>
        </div>
      </form>
    </div>
  );
}
