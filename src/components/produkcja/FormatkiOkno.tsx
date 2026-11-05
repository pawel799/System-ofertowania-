"use client";

/* Okno „Formatki i rozkrój” w kreatorze (montowane tylko, gdy otwarte). */
import { useEffect, useState } from "react";
import type { PlanKuchni } from "@/lib/kuchnia";
import { useOknoPrzewijane } from "../panel/useOknoPrzewijane";
import Produkcja from "./Produkcja";
import type { ZrodloMaterialow } from "./formatki";
import type { MetaProdukcji } from "./dokument";

export default function FormatkiOkno({ plan, zrodlo, meta, onClose }: { plan: PlanKuchni; zrodlo: ZrodloMaterialow; meta: MetaProdukcji; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const przewijanie = useOknoPrzewijane(open);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div className="overlay" data-open={open ? "" : undefined}>
      <div className="backdrop" onClick={onClose} />
      <div className="modal pr-okno" role="dialog" aria-modal="true" aria-labelledby="pr-tytul">
        <div className="m-pad pr-head">
          <div className="m-top">
            <h2 id="pr-tytul" style={{ fontSize: 15 }}>
              Formatki i rozkrój
            </h2>
            <button type="button" className="btn btn-plain" onClick={onClose} aria-label="Zamknij formatki">
              Zamknij
            </button>
          </div>
        </div>
        <div className="pr-body" data-przewijanie={przewijanie ? "" : undefined}>
          <Produkcja projekt={{ plan, zrodlo }} meta={meta} />
        </div>
      </div>
    </div>
  );
}
