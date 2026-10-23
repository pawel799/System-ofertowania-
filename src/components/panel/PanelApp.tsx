"use client";

import { ModulySection } from "./ModulySection";
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
import { setPalettes as setPaletteStore } from "../paletteStore";
import { findRalFront, paletteFronts, type FrontChoice, type Palette } from "../palettes";
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
  offerSubject,
  pinMessage,
  sendHref,
  stamp,
  type Channel,
  type ClientType,
  type EventKind,
  type Layout,
  type Offer,
  type Status,
} from "./offers";
import { cleanNip, formatNip, isValidNip, type CompanyLookup } from "./company";
import { assetsApi, panelAuth, toPublicModel, type DomainView, type ModelMeta } from "./offerApi";
import { LoginDialog, LogoutButton, PanelBrand, PanelState, PlanNotice } from "./PanelGate";
import { usePanelOffers } from "./usePanelOffers";
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

// Wgrany model 3D (zamiast kuchni demo) w okienku podglądu.
const CustomModelScene = dynamic(() => import("../CustomModelScene"), {
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

/** Front z katalogu albo z pakietu RAL (nazwa i kolor próbki). */
const frontInfo = (palettes: Palette[], id: string): FrontChoice | undefined =>
  FRONTS.find((f) => f.id === id) ?? findRalFront(palettes, id);

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
  // Z ustawień (/panel/ustawienia): wgrane modele, pakiety RAL, własna domena linków.
  const [models, setModels] = useState<ModelMeta[]>([]);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [domain, setDomain] = useState<DomainView | null>(null);

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

  // Modele, pakiety i domena: tylko z API (w trybie lokalnym ich nie ma).
  useEffect(() => {
    if (store.mode !== "api") return;
    let alive = true;
    void Promise.allSettled([assetsApi.models(), assetsApi.palettes(), assetsApi.domain()]).then(([m, p, d]) => {
      if (!alive) return;
      if (m.status === "fulfilled") setModels(m.value);
      if (p.status === "fulfilled") setPalettes(p.value);
      if (d.status === "fulfilled") setDomain(d.value);
    });
    return () => {
      alive = false;
    };
  }, [store.mode]);

  // Scena 3D i cena korzystają z tych samych pakietów RAL.
  useEffect(() => setPaletteStore(palettes), [palettes]);

  // Własna domena działa (nazwa + certyfikat): linki dla klientów idą na nią.
  const linkOrigin = domain?.active && domain.domain ? `https://${domain.domain.hostname}` : origin;

  // Scena 3D pokazuje materiały zaznaczonej oferty.
  useEffect(() => {
    if (!offer) return;
    setFront(offer.front);
    setCountertop(offer.countertop);
    setHardware(offer.hardware);
  }, [offer?.front, offer?.countertop, offer?.hardware]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wiadomość odświeża się sama, dopóki ktoś jej nie poprawił ręcznie.
  useEffect(() => {
    if (offer && !msgDirty) setMessage(offerMessage(offer, linkOrigin, offer.link?.channel ?? draft.channel));
  }, [offer, linkOrigin, msgDirty, draft.channel]);

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
      models={models}
      palettes={palettes}
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
  const tokenDialog = store.mode === "auth" ? <LoginDialog error={store.error} onLoggedIn={store.afterLogin} /> : null;

  if (!offer)
    return (
      <PanelState mode={store.mode} error={store.error} onRetry={store.retry} onNew={() => setNewOpen({ instant: false })}>
        {newDialog}
        {tokenDialog}
        <Toaster />
      </PanelState>
    );

  const L = offer.link;
  const total = totalPrice(offer, offer.base, palettes);
  const linkUrl = L ? `${linkOrigin}/oferta/${L.slug}` : "";
  const shortUrl = L ? `${linkOrigin.replace(/^https?:\/\//, "")}/oferta/${L.slug}` : "";
  const offerModel = offer.modelId ? models.find((m) => m.id === offer.modelId) : undefined;
  const ralFronts = paletteFronts(palettes);
  const lastTime = (o: Offer) => o.events[o.events.length - 1]?.t ?? "";
  const frontColor = FRONTS.find((f) => f.id === offer.front)?.color ?? "#999";
  const handle = HARDWARE_COLOR[offer.hardware];

  const setMaterial = (kind: "front" | "countertop" | "hardware", id: string) => {
    if (offer[kind] === id) return;
    const label =
      kind === "front"
        ? `Front: ${frontInfo(palettes, id)?.name ?? id}`
        : kind === "countertop"
          ? `Blat: ${nameOf(COUNTERTOPS, id)}`
          : `Okucia: ${nameOf(HARDWARE, id)}`;
    update(offer.id, (o) => withEvent({ ...o, [kind]: id }, "edit", label));
  };

  const setModel = (modelId: string) => {
    if ((offer.modelId ?? "") === modelId) return;
    const name = modelId ? models.find((m) => m.id === modelId)?.name ?? modelId : "Kuchnia demo";
    update(offer.id, (o) => {
      const next = { ...o };
      if (modelId) next.modelId = modelId;
      else delete next.modelId;
      return withEvent(next, "edit", `Model 3D: ${name}`);
    });
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

  // Usunięcie oferty: znika z listy, a usePanelOffers wysyła DELETE /api/offers/:id
  // (KV kasuje ofertę i jej link). Zaznaczenie przechodzi na sąsiednią ofertę.
  const removeOffer = () => {
    const removed = offer;
    const nextVisible = visible.filter((o) => o.id !== removed.id);
    const idx = Math.max(0, visible.findIndex((o) => o.id === removed.id));
    const rest = offers.filter((o) => o.id !== removed.id);
    const next = nextVisible[Math.min(idx, nextVisible.length - 1)] ?? rest[0];
    setOffers(rest);
    if (next) {
      setSelId(next.id);
      setDraft(draftFor(next));
    } else {
      setSelId("");
      setView("list");
    }
    setMsgDirty(false);
    toast("Oferta usunięta", {
      desc: removed.link ? `${removed.id} · link klienta przestał działać.` : removed.id,
    });
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
              {(() => {
                const href = sendHref(offer, L.channel, message);
                return href ? (
                  <a className="btn btn-ink" href={href} data-tip={L.channel === "email" ? `Otwiera program pocztowy: „${offerSubject(offer)}”` : "Otwiera SMS na telefonie"}>
                    {L.channel === "email" ? "Wyślij e-mailem" : "Wyślij SMS-em"}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ink"
                    onClick={() =>
                      void copyMessage(message).then(() => {
                        toast("Wiadomość skopiowana", { desc: "Wklej ją w rozmowie z klientem." });
                        window.open("https://www.messenger.com/", "_blank", "noopener");
                      }, fallbackSelect(msgRef))
                    }
                  >
                    Kopiuj i otwórz Messengera
                  </button>
                );
              })()}
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
            {L.pin ? (
              <div className="field">
                <span className="lab">PIN – wyślij osobno</span>
                <div className="linkbox">
                  <input readOnly value={pinMessage(offer)} aria-label="Wiadomość z PIN-em" />
                  <CopyButton text={pinMessage(offer)} label="Kopiuj PIN" onFallback={() => toast("Zaznacz i skopiuj PIN ręcznie", { type: "info" })} />
                </div>
                <p className="faint" style={{ margin: 0, fontSize: 12 }}>
                  Najbezpieczniej inną drogą niż link: gdy link idzie mailem, PIN wyślij SMS-em (i odwrotnie).
                </p>
              </div>
            ) : null}
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
        <PanelBrand />
        <div className="crumb">
          <span>/</span>
          <span>Oferty</span>
          <span className="c-offer" style={{ display: "contents" }}>
            <span>/</span>
            <b>{offer.id}</b>
          </span>
        </div>
        <span className="grow" />
        {store.mode === "api" ? <PlanNotice /> : null}
        {store.mode === "local" ? (
          <span className="sample" data-tip="Brak API (zwykły next dev): oferty zapisują się tylko w tej przeglądarce">
            Dane demo
          </span>
        ) : (
          <span className="sample" data-tip="Oferty zapisują się w Cloudflare i działają na każdym urządzeniu">
            {store.sync === "saving" ? "Zapisywanie…" : store.sync === "error" ? "Błąd zapisu" : "Zapisano"}
          </span>
        )}
        <a className="btn btn-plain" href="/panel/zgloszenia" data-tip="Prośby o wycenę i pomiar, wiadomości z kontaktu">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2.5 4.5h11v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.4" />
            <path d="m2.5 4.5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <span className="hide-sm">Zgłoszenia</span>
        </a>
        <a className="btn btn-plain" href="/panel/ustawienia" data-tip="Firma i logo, modele 3D, kolory RAL, własna domena">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13 8a5 5 0 0 0-.1-1l1.4-1.1-1.5-2.6-1.7.6a5 5 0 0 0-1.7-1L9 1.2H7l-.4 1.7a5 5 0 0 0-1.7 1l-1.7-.6-1.5 2.6L3.1 7a5 5 0 0 0 0 2l-1.4 1.1 1.5 2.6 1.7-.6a5 5 0 0 0 1.7 1L7 14.8h2l.4-1.7a5 5 0 0 0 1.7-1l1.7.6 1.5-2.6L12.9 9c.1-.3.1-.7.1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          <span className="hide-sm">Ustawienia</span>
        </a>
        <LogoutButton />
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
                      title={frontInfo(palettes, o.front)?.name ?? o.front}
                      style={{ background: frontInfo(palettes, o.front)?.color }}
                    />
                    <span className="row-sub">
                      <span className="mono">{o.id}</span> · {o.clientType === "company" ? "Firma: " : ""}
                      {o.client} · {lastTime(o)}
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
            {offerModel ? (
              <CustomModelScene key={offerModel.id} model={toPublicModel(offerModel)} embedded />
            ) : (
              <KitchenGlbScene embedded />
            )}
            <div className="vp-bar">
              <span className="vp-tag">
                Podgląd 3D · {offerModel ? offerModel.name : LAYOUT_LABEL[offer.layout]}
              </span>
              {L ? (
                <a className="vp-open" href={`/oferta/${L.slug}`} target="_blank" rel="noreferrer">
                  Otwórz jako klient
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M6 3.5h6.5V10M12.5 3.5 4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ) : (
                <button
                  type="button"
                  className="vp-open vp-open-off"
                  onClick={() =>
                    toast("Najpierw utwórz link", {
                      type: "info",
                      desc: "Strona klienta działa pod linkiem z sekcji „Link dla klienta”.",
                    })
                  }
                >
                  Otwórz jako klient
                </button>
              )}
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

          {offer.clientType === "company" && offer.company ? (
            <dl className="specs company">
              <div>
                <dt>Firma</dt>
                <dd>{offer.company.name}</dd>
              </div>
              <div>
                <dt>NIP</dt>
                <dd className="mono">{offer.company.nip ? formatNip(offer.company.nip) : "—"}</dd>
              </div>
              <div>
                <dt>Adres</dt>
                <dd>
                  {[offer.company.street, [offer.company.postalCode, offer.company.city].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt>Osoba kontaktowa</dt>
                <dd>{offer.contactPerson || "—"}</dd>
              </div>
              {offer.company.krs ? (
                <div>
                  <dt>KRS</dt>
                  <dd className="mono">{offer.company.krs}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mats">
            {models.length || offer.modelId ? (
              <div>
                <label className="mat-label" htmlFor="o-model">
                  Model 3D
                </label>
                <select
                  id="o-model"
                  className="input model-select"
                  value={offer.modelId ?? ""}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">Kuchnia demo</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {offer.modelId && !offerModel ? <option value={offer.modelId}>Model niedostępny</option> : null}
                </select>
              </div>
            ) : null}
            <div>
              <div className="mat-label">
                Fronty <span>{frontInfo(palettes, offer.front)?.name ?? offer.front}</span>
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
                {ralFronts.length ? <i className="sw-sep" aria-hidden /> : null}
                {ralFronts.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="sw"
                    role="radio"
                    aria-checked={offer.front === f.id}
                    aria-label={f.name}
                    data-tip={`${f.name}${f.delta ? ` · +${formatPln(f.delta)}` : ""}`}
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

          <ModulySection moduly={offer.moduly ?? []} onChange={(m, label) => update(offer.id, (o) => withEvent({ ...o, moduly: m }, "edit", label))} />

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

          <section className="sec">
            <h2>Usuń ofertę</h2>
            <p className="lede">
              Oferta zniknie z panelu{offer.link ? ", a link klienta przestanie działać" : ""}. Tego nie da się cofnąć.
            </p>
            <div className="danger-row">
              <HoldButton holdLabel="Przytrzymaj…" ariaLabel={`Przytrzymaj, aby usunąć ofertę ${offer.id}`} onConfirm={removeOffer}>
                Usuń ofertę
              </HoldButton>
            </div>
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

type CompanyForm = {
  nip: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  regon: string;
  krs: string;
  legalForm: string;
  vatStatus: string;
};

const EMPTY_COMPANY: CompanyForm = {
  nip: "",
  name: "",
  street: "",
  postalCode: "",
  city: "",
  regon: "",
  krs: "",
  legalForm: "",
  vatStatus: "",
};

type Lookup =
  | { state: "idle" }
  | { state: "loading"; nip: string }
  | { state: "done"; nip: string; sources: ("vat" | "krs")[]; vatStatus: string }
  | { state: "error"; nip: string; message: string };

function NewOfferDialog({
  instant,
  nextId,
  models,
  palettes,
  onClose,
  onCreate,
}: {
  instant: boolean;
  nextId: string;
  models: ModelMeta[];
  palettes: Palette[];
  onClose: () => void;
  onCreate: (o: Offer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<ClientType>("private");
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const nipRef = useRef<HTMLInputElement>(null);
  const lastFetched = useRef("");
  const [form, setForm] = useState({
    client: "",
    contactPerson: "",
    contact: "",
    title: "",
    layout: "L" as Layout,
    base: "24900",
    front: FRONTS[0].id,
    countertop: COUNTERTOPS[0].id,
    hardware: HARDWARE[0].id,
    modelId: "",
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

  const switchType = (t: ClientType) => {
    setType(t);
    setError("");
    requestAnimationFrame(() => (t === "company" ? nipRef : firstRef).current?.focus());
  };

  const nipDigits = cleanNip(company.nip);
  const nipInvalid = nipDigits.length === 10 && !isValidNip(nipDigits);

  const fetchCompany = useCallback(async (nip: string) => {
    lastFetched.current = nip;
    setLookup({ state: "loading", nip });
    try {
      const res = await fetch(`/api/firma?nip=${nip}`, { headers: panelAuth() });
      const data = (await res.json()) as CompanyLookup;
      if (lastFetched.current !== nip) return; // w międzyczasie wpisano inny NIP
      if (!data.ok) {
        setLookup({ state: "error", nip, message: data.error });
        return;
      }
      const c = data.company;
      setCompany((prev) => ({
        ...prev,
        name: c.name,
        street: c.street,
        postalCode: c.postalCode,
        city: c.city,
        regon: c.regon,
        krs: c.krs,
        legalForm: c.legalForm,
        vatStatus: c.vatStatus,
      }));
      setLookup({ state: "done", nip, sources: data.sources, vatStatus: c.vatStatus });
      // Krótkie podświetlenie pól, które się uzupełniły (bez ruchu – tylko kolor).
      requestAnimationFrame(() => {
        formRef.current?.querySelectorAll<HTMLElement>("[data-autofill]").forEach((el) => {
          el.animate(
            [
              { backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--g2))" },
              { backgroundColor: "var(--g2)" },
            ],
            { duration: 900, easing: "ease" },
          );
        });
      });
    } catch {
      if (lastFetched.current !== nip) return;
      setLookup({ state: "error", nip, message: "Nie udało się połączyć z serwerem. Sprawdź internet albo wpisz dane ręcznie." });
    }
  }, []);

  // Pełny, poprawny NIP pobiera dane sam – bez klikania.
  useEffect(() => {
    if (type !== "company" || !isValidNip(nipDigits) || lastFetched.current === nipDigits) return;
    const t = setTimeout(() => void fetchCompany(nipDigits), 250);
    return () => clearTimeout(t);
  }, [type, nipDigits, fetchCompany]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const isCompany = type === "company";
    const client = isCompany ? company.name.trim() : form.client.trim();
    if (!client) {
      setError(isCompany ? "Uzupełnij nazwę firmy albo pobierz ją po NIP-ie." : "Wpisz imię i nazwisko klienta.");
      return;
    }
    if (isCompany && company.nip.trim() && !isValidNip(company.nip)) {
      setError("NIP ma błąd. Popraw go albo zostaw puste pole.");
      return;
    }
    if (!title) {
      setError("Wpisz nazwę oferty.");
      return;
    }
    const base = Number(form.base.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(base) || base <= 0) {
      setError("Cena bazowa musi być liczbą większą od zera.");
      return;
    }
    const person = isCompany ? form.contactPerson.trim() : client;
    onCreate({
      id: nextId,
      title,
      client,
      clientType: type,
      company: isCompany
        ? { ...company, nip: cleanNip(company.nip), name: client }
        : undefined,
      contactPerson: isCompany ? person || undefined : undefined,
      greet: /\s/.test(person) || (isCompany && person) ? person.split(/\s+/)[0] : null,
      contact: form.contact.trim(),
      layout: form.layout,
      base,
      front: form.front,
      countertop: form.countertop,
      hardware: form.hardware,
      ...(form.modelId ? { modelId: form.modelId } : {}),
      status: "szkic",
      link: null,
      events: [{ t: stamp(), k: "create", x: isCompany ? "Oferta przygotowana dla firmy" : "Oferta przygotowana" }],
    });
  };

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setC = (k: keyof CompanyForm) => (v: string) => setCompany((c) => ({ ...c, [k]: v }));

  const lookupMsg =
    nipInvalid ? (
      <p className="nip-msg err">Ten NIP ma błąd (nie zgadza się suma kontrolna).</p>
    ) : lookup.state === "loading" ? (
      <p className="nip-msg" role="status">
        <span className="spin" aria-hidden />
        Szukam w wykazie VAT i KRS…
      </p>
    ) : lookup.state === "error" && lookup.nip === nipDigits ? (
      <p className="nip-msg err">{lookup.message}</p>
    ) : lookup.state === "done" && lookup.nip === nipDigits ? (
      <p className="nip-msg ok" role="status">
        Uzupełnione z {lookup.sources.includes("krs") ? "wykazu VAT i KRS" : "wykazu VAT"}
        {lookup.vatStatus ? ` · VAT: ${lookup.vatStatus.toLowerCase()}` : ""}. Możesz poprawić każde pole.
      </p>
    ) : (
      <p className="nip-msg faint">Wpisz NIP, a nazwę i adres uzupełnię z rejestrów.</p>
    );

  return (
    <div
      className="overlay"
      data-open={open && !closing ? "" : undefined}
      data-instant={instant ? "" : undefined}
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div className="backdrop" onClick={close} />
      <form ref={formRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="new-title" onSubmit={submit} noValidate>
        <div className="m-pad">
          <div className="m-top">
            <h2 id="new-title" style={{ fontSize: 15 }}>
              Nowa oferta <span className="mono faint">{nextId}</span>
            </h2>
            <button type="button" className="icon-btn" aria-label="Zamknij" onClick={close}>
              <CloseIcon />
            </button>
          </div>

          <div className="field">
            <span className="lab">Klient</span>
            <Seg
              label="Rodzaj klienta"
              value={type}
              onChange={switchType}
              options={[
                { value: "private", label: "Klient prywatny" },
                { value: "company", label: "Firma" },
              ]}
            />
          </div>

          {type === "private" ? (
            <div className="grid2 swap-in" key="private">
              <div className="field">
                <label htmlFor="n-client">Imię i nazwisko</label>
                <input id="n-client" ref={firstRef} className="input" autoComplete="off" value={form.client} onChange={(e) => set("client")(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="n-contact">E-mail lub telefon</label>
                <input id="n-contact" className="input" autoComplete="off" autoCapitalize="none" value={form.contact} onChange={(e) => set("contact")(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="swap-in" key="company">
              <div className="field">
                <label htmlFor="n-nip">NIP</label>
                <div className="nip-row">
                  <input
                    id="n-nip"
                    ref={nipRef}
                    className="input mono-input"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="np. 526-025-02-74"
                    aria-invalid={nipInvalid || undefined}
                    value={company.nip}
                    onChange={(e) => setC("nip")(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (isValidNip(nipDigits)) void fetchCompany(nipDigits);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!isValidNip(nipDigits) || lookup.state === "loading"}
                    onClick={() => void fetchCompany(nipDigits)}
                  >
                    {lookup.state === "loading" ? "Szukam…" : "Pobierz dane"}
                  </button>
                </div>
                {lookupMsg}
              </div>
              <div className="field">
                <label htmlFor="n-cname">Nazwa firmy</label>
                <input id="n-cname" data-autofill className="input" autoComplete="off" value={company.name} onChange={(e) => setC("name")(e.target.value)} />
              </div>
              <div className="grid-addr">
                <div className="field">
                  <label htmlFor="n-street">Ulica i numer</label>
                  <input id="n-street" data-autofill className="input" autoComplete="off" value={company.street} onChange={(e) => setC("street")(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="n-postal">Kod</label>
                  <input id="n-postal" data-autofill className="input" inputMode="numeric" autoComplete="off" placeholder="00-000" value={company.postalCode} onChange={(e) => setC("postalCode")(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="n-city">Miejscowość</label>
                  <input id="n-city" data-autofill className="input" autoComplete="off" value={company.city} onChange={(e) => setC("city")(e.target.value)} />
                </div>
              </div>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="n-regon">REGON</label>
                  <input id="n-regon" data-autofill className="input mono-input" inputMode="numeric" autoComplete="off" value={company.regon} onChange={(e) => setC("regon")(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="n-krs">KRS</label>
                  <input id="n-krs" data-autofill className="input mono-input" inputMode="numeric" autoComplete="off" placeholder="brak (np. JDG)" value={company.krs} onChange={(e) => setC("krs")(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="n-person">Osoba kontaktowa</label>
                  <input id="n-person" className="input" autoComplete="off" value={form.contactPerson} onChange={(e) => set("contactPerson")(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="n-contact">E-mail lub telefon</label>
                  <input id="n-contact" className="input" autoComplete="off" autoCapitalize="none" value={form.contact} onChange={(e) => set("contact")(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="grid2">
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
          {models.length ? (
            <div className="field">
              <label htmlFor="n-model">Model 3D</label>
              <select id="n-model" className="input" value={form.modelId} onChange={(e) => set("modelId")(e.target.value)}>
                <option value="">Kuchnia demo</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="field">
            <span className="lab">Fronty</span>
            <div className="swatches" role="radiogroup" aria-label="Fronty">
              {[...FRONTS, ...paletteFronts(palettes)].map((f, i) => (
                <button key={f.id} type="button" className="sw" role="radio" aria-checked={form.front === f.id} aria-label={f.name} data-tip={f.name} onClick={() => set("front")(f.id)} data-first-ral={i === FRONTS.length ? "" : undefined}>
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
