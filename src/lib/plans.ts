/*
 * Plany abonamentu: ceny (strona /cennik) i limity (API). Wspólne dla functions/ i strony –
 * zmiana ceny albo limitu w jednym miejscu.
 * Firma ma zawsze jeden plan; nowa firma dostaje okres próbny na wybranym planie.
 */
export const PLAN_IDS = ["start", "pracownia", "producent"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);

/** Długość okresu próbnego po rejestracji. */
export const TRIAL_DAYS = 30;

/** null = bez limitu. */
export type PlanLimits = {
  /** Konta w firmie (z właścicielem). */
  users: number | null;
  /** Oferty w toku: bez zaakceptowanych i bez tych z wygasłym linkiem. */
  activeOffers: number | null;
  /** Wgrane modele 3D. */
  models: number | null;
  /** Własne pakiety kolorów RAL. */
  palettes: boolean;
  /** Własna domena linków (oferty.twojafirma.pl). */
  domain: boolean;
};

export type PlanInfo = {
  id: PlanId;
  name: string;
  /** Dla kogo – jedno zdanie na cennik. */
  audience: string;
  /** Cena netto za miesiąc (zł); przy planie z „od” – cena minimalna. */
  monthly: number;
  /** Cena netto za rok (zł); null = tylko indywidualnie. */
  yearly: number | null;
  /** „od 899 zł” – cena zależy od wdrożenia. */
  from?: boolean;
  /** Jednorazowa opłata, np. wdrożenie. */
  setup?: string;
  limits: PlanLimits;
  /** Punkty na cenniku – tylko to, co system naprawdę robi. */
  features: string[];
};

export const PLANS: Record<PlanId, PlanInfo> = {
  start: {
    id: "start",
    name: "Start",
    audience: "Dla stolarza lub projektanta, który sam przygotowuje oferty.",
    monthly: 149,
    yearly: 1490,
    limits: { users: 1, activeOffers: 20, models: 20, palettes: false, domain: false },
    features: [
      "1 konto",
      "Do 20 ofert w toku",
      "Do 20 własnych modeli 3D",
      "Link z PIN-em i datą ważności",
      "Uwagi klienta, historia otwarć i zgłoszenia",
      "Nazwa i logo stolarni w ofercie",
    ],
  },
  pracownia: {
    id: "pracownia",
    name: "Pracownia",
    audience: "Dla pracowni, w których oferty przygotowuje kilka osób.",
    monthly: 349,
    yearly: 3490,
    limits: { users: 5, activeOffers: null, models: 200, palettes: true, domain: false },
    features: [
      "Do 5 kont w zespole",
      "Bez limitu ofert",
      "Do 200 własnych modeli 3D",
      "Własne pakiety kolorów RAL",
      "Dane klienta firmowego po NIP-ie",
      "Wszystko z planu Start",
    ],
  },
  producent: {
    id: "producent",
    name: "Producent",
    audience: "Dla producentów i sieci salonów z własną kolekcją.",
    monthly: 899,
    yearly: null,
    from: true,
    setup: "wdrożenie od 2 000 zł",
    limits: { users: null, activeOffers: null, models: null, palettes: true, domain: true },
    features: [
      "Bez limitu kont, ofert i modeli",
      "Własna domena linków dla klientów",
      "Pomoc przy przygotowaniu modeli",
      "Wszystko z planu Pracownia",
    ],
  },
};

export const PLAN_NAMES: Record<PlanId, string> = {
  start: PLANS.start.name,
  pracownia: PLANS.pracownia.name,
  producent: PLANS.producent.name,
};

/** Usługa poza abonamentem (cennik). */
export const MODEL_SERVICE = "Przygotowanie modelu przez nas: 150–400 zł za model.";

/** 1490 -> "1 490 zł" (twarda spacja; toLocaleString w pl nie grupuje liczb czterocyfrowych). */
export const formatZl = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")}\u00a0zł`;
