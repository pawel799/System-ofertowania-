import type { Media } from "@/content/strona-glowna";
import LoopVideo from "./LoopVideo";

/*
 * Pole na zrzut ekranu albo nagranie. Bez pliku pokazuje ramkę ze znacznikami w rogach
 * (jak na rzucie) i podpisem, co ma tu trafić – układ się nie zmienia po podmianie.
 */
export default function MediaSlot({ media, className = "" }: { media: Media; className?: string }) {
  const ratio = media.ratio ?? "16 / 10";
  const frame = `relative overflow-hidden rounded-2xl border border-white/10 bg-[#141210] ${className}`;

  if (media.video) {
    return (
      <div className={frame} style={{ aspectRatio: ratio }}>
        <LoopVideo mp4={media.video} webm={media.videoWebm} poster={media.poster} label={media.alt} />
      </div>
    );
  }

  if (media.src) {
    return (
      <div className={frame} style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- statyczny eksport: zwykły <img> */}
        <img src={media.src} alt={media.alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={media.alt}
      className={frame}
      style={{
        aspectRatio: ratio,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {CORNERS.map((c) => (
        <span key={c} aria-hidden className={`absolute h-4 w-4 border-white/30 ${c}`} />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="text-[11px] uppercase tracking-[0.25em] text-stone-500">Miejsce na zrzut</span>
        <span className="max-w-xs text-sm text-stone-400">{media.alt}</span>
      </div>
    </div>
  );
}

const CORNERS = [
  "left-4 top-4 border-l border-t",
  "right-4 top-4 border-r border-t",
  "bottom-4 left-4 border-b border-l",
  "bottom-4 right-4 border-b border-r",
];
