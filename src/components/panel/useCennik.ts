"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CENNIK, type ModulCennik } from "@/lib/modul";
import { cennikApi } from "./offerApi";

/**
 * Cennik modułów firmy. Gdy API nie odpowie — cennik domyślny i flaga `blad`.
 * zFirmy = false (test kreatora bez konta): bez zapytania, od razu cennik domyślny.
 */
export function useCennik(zFirmy = true) {
  const [cennik, setCennik] = useState<ModulCennik>(DEFAULT_CENNIK);
  const [gotowy, setGotowy] = useState(false);
  const [blad, setBlad] = useState(false);
  useEffect(() => {
    if (!zFirmy) {
      setGotowy(true);
      return;
    }
    let alive = true;
    cennikApi
      .get()
      .then((c) => {
        if (!alive) return;
        setCennik(c);
        setGotowy(true);
      })
      .catch(() => {
        if (!alive) return;
        setBlad(true);
        setGotowy(true);
      });
    return () => {
      alive = false;
    };
  }, [zFirmy]);
  return { cennik, gotowy, blad };
}
