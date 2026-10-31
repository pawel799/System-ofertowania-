import type { TypProjektu } from "@/lib/projekt";
import type { MaterialySnapshot } from "../katalogFirmy";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { ModulItem } from "@/lib/modul";
import type { CompanyData } from "./company";

/*
 * Dane panelu ofert. Zapisywane w Cloudflare KV przez API (/api/offers, patrz
 * offerApi.ts i functions/). localStorage i SAMPLE_OFFERS zostają tylko jako
 * tryb lokalny przy zwykłym `next dev`, gdzie API nie istnieje.
 */

export type Status =
  | "szkic"
  | "wyslany"
  | "otwarty"
  | "poprawki"
  | "zaakceptowany";

export const STATUS_ORDER: Status[] = [
  "szkic",
  "wyslany",
  "otwarty",
  "poprawki",
  "zaakceptowany",
];

export const STATUS_LABEL: Record<Status, string> = {
  szkic: "Szkic",
  wyslany: "Wysłana",
  otwarty: "Otwarta",
  poprawki: "Poprawki",
  zaakceptowany: "Zaakceptowana",
};

export type Channel = "email" | "sms" | "messenger";
export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "E-mail",
  sms: "SMS",
  messenger: "Messenger",
};

export type Layout = "I" | "L" | "U" | "wyspa";
export const LAYOUT_LABEL: Record<Layout, string> = {
  I: "Jednorzędowa (I)",
  L: "Narożna (L)",
  U: "Podkowa (U)",
  wyspa: "Z wyspą",
};

export type OfferLink = {
  slug: string;
  days: number;
  /** Data wygaśnięcia, już sformatowana do wyświetlenia (np. "15 paź"). */
  expires: string;
  /** Ta sama data w ISO; serwer po niej wyłącza link. */
  expiresAt?: string;
  pin: string | null;
  comments: boolean;
  showPrice: boolean;
  channel: Channel;
  views: number;
};

export type EventKind =
  | "create"
  | "send"
  | "open"
  | "comment"
  | "accept"
  | "revoke"
  | "edit";

export type OfferEvent = { t: string; k: EventKind; x: string };

export type ClientType = "private" | "company";

export type Offer = {
  id: string;
  title: string;
  /** Imię i nazwisko albo nazwa firmy – to widać na liście i w ofercie. */
  client: string;
  /** Brak = klient prywatny (starsze zapisy). */
  clientType?: ClientType;
  /** Dane firmy (tylko dla clientType = "company"). */
  company?: CompanyData;
  /** Osoba kontaktowa po stronie firmy. */
  contactPerson?: string;
  /** Imię do powitania w wiadomości; null = "Dzień dobry!". */
  greet: string | null;
  contact: string;
  layout: Layout;
  /** Cena bazowa zabudowy netto, bez dopłat za materiały. */
  base: number;
  front: string;
  countertop: string;
  hardware: string;
  /** Wgrany model 3D (id z /api/models); brak = kuchnia demo. */
  modelId?: string;
  /** Moduły na wymiar (szafki parametryczne); cenę liczy serwer z cennika firmy. */
  moduly?: ModulItem[];
  /** Układ z kreatora. Przy zapisie serwer nadpisuje base i moduly ceną z cennika. */
  kuchnia?: PlanKuchni;
  /** Co projektujemy – src/lib/projekt.ts. Brak = kuchnia. */
  projekt?: TypProjektu;
  /** Snapshot nazw i dopłat materiałów (liczy serwer przy zapisie). */
  materialy?: MaterialySnapshot;
  status: Status;
  link: OfferLink | null;
  comment?: string;
  events: OfferEvent[];
  /** Ustawiane przez serwer (ISO). */
  createdAt?: string;
  updatedAt?: string;
};

export const STORAGE_KEY = "studio-kuchnie:oferty:v1";

export const SAMPLE_OFFERS: Offer[] = [
  {
    id: "KUCH-2026/12",
    title: "Linia dębowa, układ L",
    client: "Kuba Nowicki",
    greet: "Kuba",
    contact: "kuba.nowicki@example.pl",
    layout: "L",
    base: 24_900,
    front: "dab-naturalny",
    countertop: "kwarcyt-calacatta",
    hardware: "mosiadz",
    status: "otwarty",
    link: { slug: "k7rp2x", days: 7, expires: "15 paź", pin: null, comments: true, showPrice: true, channel: "email", views: 2 },
    events: [
      { t: "7 paź 10:12", k: "create", x: "Oferta przygotowana" },
      { t: "8 paź 16:40", k: "send", x: "Link utworzony · e-mail · 7 dni" },
      { t: "dziś 08:05", k: "open", x: "Klient otworzył ofertę" },
      { t: "dziś 11:31", k: "open", x: "Klient otworzył ofertę ponownie" },
    ],
  },
  {
    id: "KUCH-2026/15",
    title: "Grafit z wyspą",
    client: "Marta Kowalczyk",
    greet: "Marta",
    contact: "+48 600 100 200",
    layout: "wyspa",
    base: 38_400,
    front: "grafit",
    countertop: "granit-absolute-black",
    hardware: "czarny-mat",
    status: "poprawki",
    comment: "Czy wyspa może być 20 cm krótsza? I wolałabym jaśniejszy blat.",
    link: { slug: "w2v9qa", days: 7, expires: "14 paź", pin: "4821", comments: true, showPrice: false, channel: "sms", views: 3 },
    events: [
      { t: "6 paź 14:20", k: "create", x: "Oferta przygotowana" },
      { t: "7 paź 09:20", k: "send", x: "Link utworzony · SMS · 7 dni · PIN" },
      { t: "7 paź 13:02", k: "open", x: "Klient otworzył ofertę" },
      { t: "wczoraj 19:47", k: "comment", x: "Klient prosi o poprawki" },
    ],
  },
  {
    id: "KUCH-2026/14",
    title: "Kaszmir w zabudowie I",
    client: "Tomasz Wrona",
    greet: "Tomasz",
    contact: "t.wrona@example.pl",
    layout: "I",
    base: 17_900,
    front: "kaszmir",
    countertop: "laminat-dab",
    hardware: "push-to-open",
    status: "wyslany",
    link: { slug: "z9b3tq", days: 7, expires: "16 paź", pin: null, comments: true, showPrice: true, channel: "messenger", views: 0 },
    events: [
      { t: "7 paź 12:30", k: "create", x: "Oferta przygotowana" },
      { t: "dziś 09:44", k: "send", x: "Link utworzony · Messenger · 7 dni" },
    ],
  },
  {
    id: "KUCH-2026/16",
    title: "Dąb bielony do kawalerki",
    client: "Ola Wiśniewska",
    greet: "Ola",
    contact: "ola.w@example.pl",
    layout: "I",
    base: 14_500,
    front: "dab-bielony",
    countertop: "laminat-dab",
    hardware: "push-to-open",
    status: "szkic",
    link: null,
    events: [{ t: "wczoraj 17:05", k: "create", x: "Oferta przygotowana" }],
  },
  {
    id: "KUCH-2026/13",
    title: "Dąb wędzony, podkowa",
    client: "Apartamenty Nadwiślańskie",
    clientType: "company",
    company: {
      name: "Apartamenty Nadwiślańskie",
      nip: "",
      regon: "",
      krs: "",
      legalForm: "",
      street: "ul. Wioślarska 4",
      postalCode: "00-001",
      city: "Warszawa",
      vatStatus: "",
    },
    contactPerson: "Joanna Lis",
    greet: "Joanna",
    contact: "biuro@nadwislanskie.example.pl",
    layout: "U",
    base: 52_000,
    front: "dab-wedzony",
    countertop: "granit-absolute-black",
    hardware: "mosiadz",
    status: "zaakceptowany",
    link: { slug: "p0wq7k", days: 30, expires: "2 lis", pin: null, comments: true, showPrice: true, channel: "email", views: 4 },
    events: [
      { t: "1 paź 10:00", k: "create", x: "Oferta przygotowana" },
      { t: "3 paź 08:50", k: "send", x: "Link utworzony · e-mail · 30 dni" },
      { t: "3 paź 12:15", k: "open", x: "Klient otworzył ofertę" },
      { t: "4 paź 18:22", k: "accept", x: "Klient zaakceptował ofertę" },
    ],
  },
];

/* ---------- Kolory do miniatur (karta linku, lista) ---------- */

export const COUNTERTOP_COLOR: Record<string, string> = {
  "kwarcyt-calacatta": "#ECE8E1",
  "granit-absolute-black": "#1F1F21",
  "laminat-dab": "#B48A5E",
};

export const HARDWARE_COLOR: Record<string, string | null> = {
  mosiadz: "#B89552",
  "czarny-mat": "#1B1B1B",
  "push-to-open": null,
};

/* ---------- Zapis w przeglądarce ---------- */

export function loadOffers(): Offer[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Offer[]) : null;
  } catch {
    return null;
  }
}

export function saveOffers(offers: Offer[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
  } catch {
    // Brak miejsca albo tryb prywatny: panel działa dalej w pamięci.
  }
}

/* ---------- Daty ---------- */

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const pad = (n: number) => String(n).padStart(2, "0");

export function stamp() {
  const d = new Date();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysFromNowIso(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function dayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Przedrostek numeru oferty według tego, co projektujemy (szafa nie dostaje „KUCH-…”). */
const PRZEDROSTEK: Record<TypProjektu, string> = { kuchnia: "KUCH", szafa: "SZAF", komoda: "MEBL", lazienka: "LAZ", inne: "MEBL" };

/** Kolejny numer w roku – jedna numeracja dla wszystkich przedrostków (KUCH-2026/3, SZAF-2026/4…). */
export function nextOfferId(offers: Offer[], typ: TypProjektu = "kuchnia") {
  const year = new Date().getFullYear();
  const max = offers.reduce((m, o) => {
    const match = /^[A-Z]{2,5}-(\d{4})\/(\d+)$/.exec(o.id);
    return match && Number(match[1]) === year ? Math.max(m, Number(match[2])) : m;
  }, 0);
  return `${PRZEDROSTEK[typ]}-${year}/${max + 1}`;
}

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Losowy, nie do zgadnięcia identyfikator linku: 12 znaków base62 (crypto). */
export function newSlug(length = 12) {
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && out.length < length; i++) if (buf[i] < 248) out.push(BASE62[buf[i] % 62]);
  }
  return out.join("");
}

/** PIN do oferty: 4 cyfry z crypto. */
export function newPin() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(1000 + (buf[0] % 9000));
}

/** Temat maila z ofertą. */
export const offerSubject = (offer: Offer) => `Oferta ${offer.id}: ${offer.title}`;

/**
 * Wiadomość z linkiem, dopasowana do kanału: SMS krótki, Messenger luźniejszy, e-mail pełniejszy.
 * PIN NIE trafia do tej wiadomości – idzie osobno (pinMessage), najlepiej inną drogą.
 */
export function offerMessage(offer: Offer, origin: string, channel: Channel = offer.link?.channel ?? "email") {
  const url = offer.link ? `${origin}/oferta/${offer.link.slug}` : "[link pojawi się po utworzeniu]";
  const pinNote = offer.link?.pin ? " PIN do oferty wyślemy osobno." : "";
  if (channel === "sms") {
    return `${offer.greet ? `${offer.greet}, ` : ""}Twoja oferta kuchni ${offer.id} w 3D: ${url}${pinNote}`;
  }
  if (channel === "messenger") {
    const hi = offer.greet ? `Cześć ${offer.greet}!` : "Dzień dobry!";
    return `${hi} Mamy gotowy projekt Twojej kuchni (${offer.title}). Możesz ją obejrzeć w 3D, pozmieniać fronty i blat i od razu zobaczyć cenę:\n${url}${pinNote}\nDaj znać, co myślisz!`;
  }
  const hi = offer.greet ? `Dzień dobry, ${offer.greet}!` : "Dzień dobry!";
  return [
    hi,
    "",
    `Przygotowaliśmy ofertę ${offer.id}: ${offer.title}.`,
    "Pod linkiem obejrzysz kuchnię w 3D, zmienisz fronty, blat i uchwyty oraz sprawdzisz wycenę:",
    url,
    ...(offer.link?.pin ? ["", "Link jest zabezpieczony PIN-em – prześlemy go w osobnej wiadomości."] : []),
    "",
    "W razie pytań odpisz na tego maila albo zadzwoń.",
    "Pozdrawiamy",
  ].join("\n");
}

/** Osobna wiadomość z samym PIN-em (wysyłana inną drogą niż link). */
export function pinMessage(offer: Offer) {
  return offer.link?.pin ? `PIN do oferty ${offer.id}: ${offer.link.pin}` : "";
}

/** Link do aplikacji pocztowej / SMS z gotową treścią (null = kanał bez takiego linku). */
export function sendHref(offer: Offer, channel: Channel, text: string) {
  const to = offer.contact.trim();
  if (channel === "email") {
    const addr = to.includes("@") ? to : "";
    return `mailto:${encodeURIComponent(addr)}?subject=${encodeURIComponent(offerSubject(offer))}&body=${encodeURIComponent(text)}`;
  }
  if (channel === "sms") {
    const num = /\d{6,}/.test(to.replace(/\D/g, "")) ? to.replace(/[^\d+]/g, "") : "";
    return `sms:${num}?body=${encodeURIComponent(text)}`;
  }
  return null;
}
