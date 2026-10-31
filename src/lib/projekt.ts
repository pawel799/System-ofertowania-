/*
 * Co projektujemy: kuchnia, szafa, komoda… Wybór na początku nowej oferty (panel → Nowa oferta)
 * i w kreatorze. Od niego zależy, które grupy elementów kreator pokazuje najpierw i o co pyta w krokach.
 * Zapis: offer.projekt (pole opcjonalne – stare oferty to kuchnie).
 */
import type { GrupaBiblioteki } from "./bibliotekaModeli";
import type { GrupaPresetu } from "./kuchnia";

export type TypProjektu = "kuchnia" | "szafa" | "komoda" | "lazienka" | "inne";

export const TYPY_PROJEKTU: readonly TypProjektu[] = ["kuchnia", "szafa", "komoda", "lazienka", "inne"];

export const TYP_PROJEKTU: Record<TypProjektu, { label: string; opis: string; kreator: string }> = {
  kuchnia: { label: "Kuchnia", opis: "Ciąg albo L, szafki, AGD i blat", kreator: "Kreator kuchni" },
  szafa: { label: "Szafa / garderoba", opis: "Wnęka, drzwi przesuwne albo uchylne, wnętrze", kreator: "Kreator szafy" },
  komoda: { label: "Komoda, RTV, regał", opis: "Meble do salonu, sypialni i przedpokoju", kreator: "Kreator mebla" },
  lazienka: { label: "Łazienka", opis: "Szafka pod umywalkę, słupek, szafka wisząca", kreator: "Kreator łazienki" },
  inne: { label: "Inny mebel", opis: "Biuro, pokój dziecka, przedpokój – wszystkie elementy", kreator: "Kreator mebli" },
};

export function parseTypProjektu(v: unknown): TypProjektu | undefined {
  return typeof v === "string" && (TYPY_PROJEKTU as readonly string[]).includes(v) ? (v as TypProjektu) : undefined;
}

/** Grupy katalogu pokazywane najpierw dla danego projektu (reszta po „Pokaż wszystkie”). */
export const GRUPY_TYPU: Record<TypProjektu, { presety: readonly GrupaPresetu[]; biblioteka: readonly GrupaBiblioteki[] }> = {
  kuchnia: { presety: ["dolne", "gorne", "polki", "slupki", "agd"], biblioteka: ["dolne", "gorne", "slupki", "blaty", "agd", "dodatki"] },
  szafa: { presety: ["szafy", "regaly"], biblioteka: ["szafy", "szafki"] },
  komoda: { presety: ["komody", "regaly"], biblioteka: ["komody", "szafki"] },
  lazienka: { presety: ["lazienka"], biblioteka: ["szafki"] },
  inne: { presety: ["szafy", "komody", "regaly", "lazienka", "dolne", "gorne", "polki", "slupki", "agd"], biblioteka: ["szafy", "szafki", "komody", "dolne", "gorne", "slupki", "blaty", "agd", "dodatki"] },
};

/**
 * Jak nazywać projekt w tekstach dla klienta (strona, mail, PDF) – żeby szafa nie była „kuchnią”.
 * Komoda, łazienka i „inne” to po prostu projekt / meble.
 */
export type SlowaProjektu = {
  /** „Kuchnia w 3D”, „Szafa w 3D”, „Projekt w 3D”. */
  nazwa: string;
  /** „Twoja kuchnia”, „Twój projekt”. */
  twoj: string;
  /** Biernik: „zobacz kuchnię”, „zobacz projekt”. */
  biernik: string;
  /** „projekt Twojej kuchni”, „projekt Twoich mebli”. */
  czego: string;
  /** „obróć ją / go”. */
  zaimek: "ją" | "go";
  /** „Pozycje kuchni”, „Pozycje projektu”. */
  pozycje: string;
};

export function slowaProjektu(typ: TypProjektu | undefined): SlowaProjektu {
  if (!typ || typ === "kuchnia") return { nazwa: "Kuchnia", twoj: "Twoja kuchnia", biernik: "kuchnię", czego: "Twojej kuchni", zaimek: "ją", pozycje: "Pozycje kuchni" };
  if (typ === "szafa") return { nazwa: "Szafa", twoj: "Twoja szafa", biernik: "szafę", czego: "Twojej szafy", zaimek: "ją", pozycje: "Pozycje projektu" };
  return { nazwa: "Projekt", twoj: "Twój projekt", biernik: "projekt", czego: "Twoich mebli", zaimek: "go", pozycje: "Pozycje projektu" };
}
