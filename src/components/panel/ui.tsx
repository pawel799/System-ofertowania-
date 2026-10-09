"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { Status } from "./offers";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Ikona statusu (kółko wypełnia się wraz z postępem) ---------- */

const STATUS_COLOR: Record<Status, string> = {
  szkic: "var(--text-3)",
  wyslany: "var(--accent)",
  otwarty: "var(--teal)",
  poprawki: "var(--amber)",
  zaakceptowany: "var(--green)",
};

export function StatusIcon({ status }: { status: Status }) {
  const c = STATUS_COLOR[status];
  if (status === "szkic")
    return (
      <svg className="st" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="2.4 2.1" />
      </svg>
    );
  if (status === "zaakceptowany")
    return (
      <svg className="st" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.75" fill={c} />
        <path d="m5.2 8.2 1.9 1.9 3.7-4" fill="none" stroke="var(--panel)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "poprawki")
    return (
      <svg className="st" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.5" />
        <path d="M8 4.8v3.6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="10.9" r=".95" fill={c} />
      </svg>
    );
  const pie =
    status === "wyslany"
      ? "M8 8V4.5A3.5 3.5 0 0 1 11.5 8Z"
      : "M8 8V4.5A3.5 3.5 0 0 1 8 11.5Z";
  return (
    <svg className="st" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.5" />
      <path d={pie} fill={c} />
    </svg>
  );
}

/* ---------- Przełącznik segmentowy (clip-path na kopii rzędu) ---------- */

export function Seg<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: V; label: ReactNode }[];
  value: V;
  onChange: (value: V) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const place = useCallback(
    (animate: boolean) => {
      const row = rowRef.current;
      const copy = copyRef.current;
      const button = row?.querySelector<HTMLElement>(
        `[data-v="${CSS.escape(value)}"]`,
      );
      if (!row || !copy || !button) return;
      const x = button.offsetLeft - row.offsetLeft;
      const right = row.offsetWidth - (x + button.offsetWidth);
      if (!animate) copy.style.transition = "none";
      copy.style.clipPath = `inset(0 ${right}px 0 ${x}px round 7px)`;
      if (!animate) requestAnimationFrame(() => (copy.style.transition = ""));
      // Przy przewijanym przełączniku wybrana opcja zawsze ma być widoczna.
      const seg = row.parentElement;
      if (seg && seg.scrollWidth > seg.clientWidth) {
        const left = x - 12;
        const right = x + button.offsetWidth + 12 - seg.clientWidth;
        if (left < seg.scrollLeft || right > seg.scrollLeft)
          seg.scrollTo({
            left: left < seg.scrollLeft ? left : right,
            behavior: animate && !reducedMotion() ? "smooth" : "auto",
          });
      }
    },
    [value],
  );

  useLayoutEffect(() => {
    place(!first.current);
    first.current = false;
  }, [place, options]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(row);
    return () => ro.disconnect();
  }, [place]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next =
      options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(next.value);
    rowRef.current
      ?.querySelector<HTMLElement>(`[data-v="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      <div className="seg-row" ref={rowRef} onKeyDown={onKeyDown}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            data-v={o.value}
            aria-checked={o.value === value}
            tabIndex={o.value === value ? 0 : -1}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="seg-row seg-copy" ref={copyRef} aria-hidden>
        {options.map((o) => (
          <span key={o.value}>{o.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Toasty w stosie (jak Sonner) ---------- */

type ToastType = "ok" | "err" | "info";
type ToastData = { id: number; title: string; desc?: string; type: ToastType };
const toastListeners = new Set<(t: ToastData) => void>();
let toastSeq = 0;

export function toast(title: string, opts: { desc?: string; type?: ToastType } = {}) {
  const t: ToastData = { id: ++toastSeq, title, desc: opts.desc, type: opts.type ?? "ok" };
  toastListeners.forEach((l) => l(t));
}

const TOAST_ICON: Record<ToastType, ReactNode> = {
  ok: (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="m5 8.2 2 2 4-4.4" fill="none" stroke="var(--panel)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  err: (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path d="M8 4.6v4" stroke="var(--panel)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8" cy="11.1" r="1" fill="var(--panel)" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.3v3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r=".9" fill="currentColor" />
    </svg>
  ),
};

type Item = ToastData & { gone?: boolean };

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const els = useRef(new Map<number, HTMLLIElement>());

  useEffect(() => {
    const add = (t: ToastData) =>
      setItems((list) => {
        const live = list.filter((x) => !x.gone);
        // Najwyżej 3 widoczne: starsze wylatują.
        const drop = new Set(live.slice(2).map((x) => x.id));
        return [t, ...list.map((x) => (drop.has(x.id) ? { ...x, gone: true } : x))];
      });
    toastListeners.add(add);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      toastListeners.delete(add);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((x) => (x.id === id ? { ...x, gone: true } : x)));
  }, []);

  // Usuwamy z DOM po animacji wyjścia.
  useEffect(() => {
    if (!items.some((x) => x.gone)) return;
    const timer = setTimeout(
      () => setItems((list) => list.filter((x) => !x.gone)),
      reducedMotion() ? 0 : 400,
    );
    return () => clearTimeout(timer);
  }, [items]);

  const layout = useCallback(() => {
    let off = 0;
    let index = 0;
    for (const item of items) {
      const el = els.current.get(item.id);
      if (!el || !el.dataset.mounted || el.hasAttribute("data-dragging")) {
        if (!item.gone) index++;
        continue;
      }
      if (item.gone) {
        el.style.transform = "translateY(100%)";
        el.style.opacity = "0";
        continue;
      }
      el.style.zIndex = String(100 - index);
      if (expanded) {
        el.style.transform = `translateY(${-off}px)`;
        el.style.opacity = "1";
        off += el.offsetHeight + 10;
      } else {
        el.style.transform = `translateY(${-index * 12}px) scale(${1 - index * 0.05})`;
        el.style.opacity = index < 3 ? "1" : "0";
      }
      index++;
    }
    const front = items.find((x) => !x.gone);
    const frontEl = front ? els.current.get(front.id) : undefined;
    listRef.current?.style.setProperty(
      "--gap-h",
      expanded ? `${off}px` : frontEl ? `${frontEl.offsetHeight + 24}px` : "0px",
    );
  }, [items, expanded]);

  useLayoutEffect(layout, [layout]);

  return (
    <ol
      className="toaster"
      ref={listRef}
      aria-live="polite"
      onPointerEnter={(e) => e.pointerType === "mouse" && setExpanded(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setExpanded(false)}
    >
      {items.map((t) => (
        <ToastItem
          key={t.id}
          data={t}
          paused={expanded || hidden || !!t.gone}
          register={(el) => {
            if (el) els.current.set(t.id, el);
            else els.current.delete(t.id);
          }}
          onMounted={layout}
          onRelease={layout}
          onDismiss={() => dismiss(t.id)}
        />
      ))}
    </ol>
  );
}

function ToastItem({
  data,
  paused,
  register,
  onMounted,
  onRelease,
  onDismiss,
}: {
  data: Item;
  paused: boolean;
  register: (el: HTMLLIElement | null) => void;
  onMounted: () => void;
  onRelease: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const remaining = useRef(4000);
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let a = 0;
    let b = 0;
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => {
        el.dataset.mounted = "1";
        onMounted();
      });
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
    // Tylko przy pierwszym montażu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer zatrzymuje się po najechaniu i gdy karta jest w tle.
  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const timer = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - start));
    };
  }, [paused, onDismiss]);

  const end = () => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    drag.current = null;
    el.removeAttribute("data-dragging");
    const velocity = Math.abs(d.dy) / Math.max(1, Date.now() - d.t0);
    if (d.dy > 45 || (d.dy > 4 && velocity > 0.11)) onDismiss();
    else onRelease();
  };

  return (
    <li
      ref={(el) => {
        ref.current = el;
        register(el);
      }}
      className="toast"
      data-type={data.type}
      role="status"
      onPointerDown={(e) => {
        if (drag.current || !ref.current) return;
        drag.current = { y0: e.clientY, t0: Date.now(), dy: 0 };
        ref.current.setPointerCapture(e.pointerId);
        ref.current.setAttribute("data-dragging", "");
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !ref.current) return;
        const raw = e.clientY - d.y0;
        d.dy = raw > 0 ? raw : raw * 0.2; // w górę z oporem
        ref.current.style.transform = `translateY(${d.dy}px)`;
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {TOAST_ICON[data.type]}
      <div>
        <div>{data.title}</div>
        {data.desc && <div className="toast-d">{data.desc}</div>}
      </div>
    </li>
  );
}

/* ---------- Tooltipy: opóźnienie przy pierwszym, sąsiednie od razu ---------- */

export function Tooltips() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let open = false;
    let lastClose = 0;
    let target: HTMLElement | null = null;

    const hide = () => {
      clearTimeout(timer);
      if (open) {
        lastClose = Date.now();
        open = false;
      }
      tip.removeAttribute("data-show");
      tip.hidden = true;
      target = null;
    };
    const show = (el: HTMLElement) => {
      const instant = open || Date.now() - lastClose < 300;
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          target = el;
          tip.textContent = el.dataset.tip ?? "";
          if (el.dataset.kbd) {
            const k = document.createElement("kbd");
            k.textContent = el.dataset.kbd;
            tip.appendChild(k);
          }
          tip.hidden = false;
          tip.toggleAttribute("data-instant", instant);
          const r = el.getBoundingClientRect();
          const w = tip.offsetWidth;
          const h = tip.offsetHeight;
          const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
          let y = r.top - h - 8;
          tip.style.transformOrigin = "50% 100%";
          if (y < 8) {
            y = r.bottom + 8;
            tip.style.transformOrigin = "50% 0";
          }
          tip.style.left = `${x}px`;
          tip.style.top = `${y}px`;
          requestAnimationFrame(() => tip.setAttribute("data-show", ""));
          open = true;
        },
        instant ? 0 : 450,
      );
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-tip]");
      if (el && el !== target) show(el);
      else if (!el && (target || timer)) hide();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      clearTimeout(timer);
    };
  }, []);
  return <div className="tip" ref={ref} role="tooltip" hidden />;
}

/* ---------- Kopiowanie z ikoną, która zmienia się w ptaszek ---------- */

export function CopyButton({
  text,
  label,
  onFallback,
}: {
  text: string;
  label: string;
  onFallback: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy"
      aria-label={label}
      data-tip={label}
      data-copied={copied ? "" : undefined}
      onClick={() => {
        copyText(text).then(() => setCopied(true), onFallback);
      }}
    >
      <svg className="i-copy" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 3.2A1.8 1.8 0 0 0 9 2.5H4.3c-1 0-1.8.8-1.8 1.8V9c0 .6.3 1.2.7 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <svg className="i-check" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function copyText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text);
  } catch (e) {
    return Promise.reject(e);
  }
}

/* ---------- Przytrzymaj, aby potwierdzić (akcje nieodwracalne) ---------- */

export function HoldButton({
  children,
  holdLabel,
  ariaLabel,
  onConfirm,
}: {
  children: ReactNode;
  holdLabel: string;
  ariaLabel: string;
  onConfirm: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, 2000);
  };
  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      className="btn btn-ghost hold"
      aria-label={ariaLabel}
      data-holding={holding ? "" : undefined}
      onPointerDown={(e) => e.button === 0 && start()}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stop()}
    >
      <span>{children}</span>
      <span className="fill" aria-hidden>
        {holdLabel}
      </span>
    </button>
  );
}

/* ---------- Licznik, który przewija cyfrę przy zmianie ---------- */

export function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useLayoutEffect(() => {
    const el = ref.current;
    const from = prev.current;
    prev.current = value;
    if (!el || from === value || reducedMotion()) return;
    const old = document.createElement("span");
    old.textContent = String(from);
    old.style.position = "absolute";
    old.style.left = "0";
    el.appendChild(old);
    const current = el.firstElementChild as HTMLElement | null;
    const opt: KeyframeAnimationOptions = { duration: 300, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };
    old.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-100%)", opacity: 0 }], opt).onfinish = () => old.remove();
    current?.animate([{ transform: "translateY(100%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], opt);
  }, [value]);
  return (
    <span className="counter" ref={ref}>
      <span>{value}</span>
    </span>
  );
}
