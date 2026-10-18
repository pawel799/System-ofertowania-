"use client";

/*
 * Zapis ofert panelu.
 *  - "api":   oferty w Cloudflare KV przez /api/offers (produkcja, wrangler pages dev).
 *             Zmiany wysyłane po krótkiej pauzie (debounce), odświeżanie przy powrocie
 *             do karty i co 30 s, żeby było widać otwarcia linków przez klientów.
 *  - "local": tylko przy `next dev` bez API: dawny zapis w localStorage + przykładowe oferty.
 *  - "auth":  serwer chce tokenu panelu (PANEL_TOKEN).
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, getToken, panelApi, setToken } from "./offerApi";
import { SAMPLE_OFFERS, STORAGE_KEY, loadOffers, saveOffers, type Offer } from "./offers";
import { toast } from "./ui";

export type PanelMode = "loading" | "api" | "local" | "auth" | "error";
export type SyncState = "saved" | "saving" | "error";

const asApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, "error", "Nieznany błąd."));

export function usePanelOffers(
  offers: Offer[],
  setOffers: Dispatch<SetStateAction<Offer[]>>,
  onFirstLoad: (list: Offer[]) => void,
) {
  const [mode, setMode] = useState<PanelMode>("loading");
  const [sync, setSync] = useState<SyncState>("saved");
  const [error, setError] = useState("");

  // id -> JSON ostatniej wersji potwierdzonej przez serwer
  const synced = useRef(new Map<string, string>());
  // id -> JSON odrzucony przez walidację (4xx): nie ponawiamy, dopóki się nie zmieni
  const rejected = useRef(new Map<string, string>());
  // id usuniętych ofert: KV list() bywa przez chwilę nieaktualny, więc odświeżenie
  // nie może przywrócić (i ponownie utworzyć) właśnie skasowanej oferty.
  const deleted = useRef(new Set<string>());
  const busy = useRef(false);
  const everLoaded = useRef(false);
  const latest = useRef(offers);
  latest.current = offers;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const firstLoad = useRef(onFirstLoad);
  firstLoad.current = onFirstLoad;
  const syncRef = useRef(sync);
  syncRef.current = sync;

  const needAuth = useCallback((e: ApiError) => {
    if (e.status !== 401) return false;
    setError(getToken() ? "Ten kod nie pasuje. Wpisz aktualny kod dostępu." : "");
    setMode("auth");
    return true;
  }, []);

  const load = useCallback(async () => {
    // Bez zapisanego kodu od razu okno logowania – bez mignięcia „Wczytywanie ofert…”.
    if (!getToken() && process.env.NODE_ENV !== "development") {
      setError("");
      setMode("auth");
      return;
    }
    setMode("loading");
    setError("");
    try {
      const list = await panelApi.list();
      synced.current = new Map(list.map((o) => [o.id, JSON.stringify(o)]));
      rejected.current.clear();
      everLoaded.current = true;
      setOffers(list);
      firstLoad.current(list);
      setSync("saved");
      setMode("api");
    } catch (e) {
      const err = asApiError(e);
      if (needAuth(err)) return;
      if (err.code === "no_api" && process.env.NODE_ENV === "development") {
        const stored = loadOffers();
        const list = stored && stored.length ? stored : SAMPLE_OFFERS;
        setOffers(list);
        firstLoad.current(list);
        setMode("local");
        return;
      }
      setError(err.message);
      setMode("error");
    }
  }, [setOffers, needAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  /* --- Tryb lokalny (next dev bez API): jak dotąd localStorage --- */
  useEffect(() => {
    if (mode === "local") saveOffers(offers);
  }, [offers, mode]);

  useEffect(() => {
    if (mode !== "local") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = loadOffers();
      if (next) setOffers(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mode, setOffers]);

  /* --- Wysyłka zmian do API --- */
  const fail = useCallback((title: string, desc: string) => {
    if (syncRef.current !== "error") toast(title, { type: "err", desc });
    setSync("error");
  }, []);

  const flush = useCallback(async () => {
    if (modeRef.current !== "api" || busy.current) return;
    busy.current = true;
    let ok = true;
    try {
      for (;;) {
        const list = latest.current;
        const job = list.find((o) => {
          const s = JSON.stringify(o);
          return synced.current.get(o.id) !== s && rejected.current.get(o.id) !== s;
        });
        const ids = new Set(list.map((o) => o.id));
        const gone = Array.from(synced.current.keys()).find((id) => !ids.has(id));
        if (!job && !gone) break;
        setSync("saving");
        try {
          if (job) {
            const sent = JSON.stringify(job);
            const saved = synced.current.has(job.id) ? await panelApi.update(job) : await panelApi.create(job);
            synced.current.set(job.id, JSON.stringify(saved));
            deleted.current.delete(job.id);
            rejected.current.delete(job.id);
            // Wersja z serwera (z dołączonymi otwarciami), o ile w międzyczasie nikt nic nie zmienił.
            const swap = (cur: Offer[]) => cur.map((o) => (o.id === job.id && JSON.stringify(o) === sent ? saved : o));
            latest.current = swap(latest.current);
            setOffers(swap);
          } else if (gone) {
            await panelApi.remove(gone).catch((e) => {
              if (asApiError(e).status !== 404) throw e;
            });
            synced.current.delete(gone);
            deleted.current.add(gone);
          }
        } catch (e) {
          const err = asApiError(e);
          if (needAuth(err)) {
            ok = false;
            break;
          }
          if (job && err.status >= 400 && err.status < 500) {
            // Dane odrzucone (np. zajęty numer oferty): nie ponawiamy tej samej wersji.
            rejected.current.set(job.id, JSON.stringify(job));
            toast("Nie zapisano oferty", { type: "err", desc: `${job.id}: ${err.message}` });
            setSync("error");
            ok = false;
            continue;
          }
          fail("Nie udało się zapisać", `${err.message} Zmiany zostaną wysłane przy następnej próbie.`);
          ok = false;
          break;
        }
      }
    } finally {
      busy.current = false;
    }
    if (ok) setSync("saved");
  }, [setOffers, needAuth, fail]);

  useEffect(() => {
    if (mode !== "api") return;
    const t = setTimeout(() => void flush(), 600);
    return () => clearTimeout(t);
  }, [offers, mode, flush]);

  /* --- Odświeżanie: otwarcia klientów i zmiany z innych urządzeń --- */
  const refresh = useCallback(async () => {
    if (modeRef.current !== "api" || busy.current) return;
    await flush();
    if (busy.current || syncRef.current === "error") return;
    let list: Offer[];
    try {
      list = await panelApi.list();
    } catch (e) {
      needAuth(asApiError(e));
      return; // ciche: spróbujemy przy następnym odświeżeniu
    }
    if (busy.current) return;
    const cur = latest.current;
    let changed = false;
    const known = new Set(cur.map((o) => o.id));
    const next = cur.map((o) => {
      const srv = list.find((x) => x.id === o.id);
      const prev = synced.current.get(o.id);
      if (!srv || !prev || prev !== JSON.stringify(o)) return o; // lokalne niezapisane zmiany mają pierwszeństwo
      const prevAt = (JSON.parse(prev) as Offer).updatedAt ?? "";
      if ((srv.updatedAt ?? "") <= prevAt) return o; // KV może chwilę oddawać starszą wersję
      synced.current.set(o.id, JSON.stringify(srv));
      changed = true;
      return srv;
    });
    const added = list.filter((x) => !known.has(x.id) && !synced.current.has(x.id) && !deleted.current.has(x.id));
    for (const a of added) synced.current.set(a.id, JSON.stringify(a));
    if (changed || added.length) {
      const result = [...added, ...next];
      latest.current = result;
      setOffers(result);
    }
  }, [flush, needAuth, setOffers]);

  useEffect(() => {
    if (mode !== "api") return;
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(onFocus, 30_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [mode, refresh]);

  /* --- Token panelu --- */
  const submitToken = useCallback(
    (token: string) => {
      setToken(token.trim());
      if (everLoaded.current) {
        // Sesja wygasła w trakcie pracy: nie nadpisujemy lokalnych zmian, tylko wznawiamy zapis.
        setError("");
        setSync("saving");
        setMode("api");
      } else {
        void load();
      }
    },
    [load],
  );

  return { mode, sync, error, retry: load, submitToken };
}
