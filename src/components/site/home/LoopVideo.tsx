"use client";

import { useEffect, useRef } from "react";

/*
 * Nagranie w pętli bez dźwięku. Gra tylko, gdy jest na ekranie (oszczędza baterię),
 * a przy "ograniczonym ruchu" w systemie stoi na kadrze startowym (poster).
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

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !reduce.matches) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full object-cover"
    >
      {/* Przeglądarka bierze pierwsze źródło, które umie odtworzyć. */}
      <source src={mp4} type="video/mp4" />
      {webm ? <source src={webm} type="video/webm" /> : null}
    </video>
  );
}
