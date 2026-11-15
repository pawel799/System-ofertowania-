"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Nagranie w pętli bez dźwięku. Gra tylko, gdy jest na ekranie (oszczędza baterię).
 * Przy „ograniczonym ruchu” stoi na kadrze startowym (poster) – także gdy ktoś zmieni
 * ustawienie w trakcie wizyty. Bez widocznych kontrolek (wygląda jak żywa aplikacja, nie film); przycisk
 * pauzy pojawia się tylko po przejściu klawiszem Tab (WCAG 2.2.2).
 */
export default function LoopVideo({
  mp4,
  webm,
  poster,
  label,
}: {
  mp4: string;
  webm?: string;
  poster?: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // Wybór użytkownika: null = automatycznie (gra na ekranie, chyba że ograniczony ruch).
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [reduce, setReduce] = useState(false);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const v = ref.current;
    if (!v) return () => mq.removeEventListener("change", sync);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(v);
    return () => {
      mq.removeEventListener("change", sync);
      io.disconnect();
    };
  }, []);

  const shouldPlay = visible && (userPaused === null ? !reduce : !userPaused);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (shouldPlay) v.play().catch(() => {});
    else v.pause();
  }, [shouldPlay]);

  return (
    <>
      <video
        ref={ref}
        poster={poster}
        aria-label={label}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 h-full w-full object-cover"
      >
        {/* Przeglądarka bierze pierwsze źródło, które umie odtworzyć – lżejszy webm najpierw. */}
        {webm ? <source src={webm} type="video/webm" /> : null}
        <source src={mp4} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={(e) => {
          // Pole z nagraniem jest w linku do oferty demo – przycisk nie może w niego klikać.
          e.preventDefault();
          e.stopPropagation();
          setUserPaused(playing);
        }}
        aria-label={playing ? "Zatrzymaj nagranie" : "Odtwórz nagranie"}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:bottom-3 focus-visible:right-3 focus-visible:z-[1] focus-visible:flex focus-visible:h-10 focus-visible:w-10 focus-visible:items-center focus-visible:justify-center focus-visible:rounded-full focus-visible:border focus-visible:border-white/20 focus-visible:bg-black/60 focus-visible:text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="currentColor">
          {playing ? <path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
        </svg>
      </button>
    </>
  );
}
