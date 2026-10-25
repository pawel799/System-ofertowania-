"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CENNIK, type ModulCennik } from "@/lib/modul";
import { cennikApi } from "./offerApi";

/** Cennik modułów firmy. Gdy API nie odpowie — cennik domyślny i flaga `blad`. */
export function useCennik() {
  const [cennik, setCennik] = useState<ModulCennik>(DEFAULT_CENNIK);
  const [gotowy, setGotowy] = useState(false);
  const [blad, setBlad] = useState(false);
  useEffect(() => {
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
  }, []);
  return { cennik, gotowy, blad };
}
