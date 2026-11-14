"use client";

/*
 * Panel → „Pierwsze kroki” dla nowego konta firmy: logo i dane, sposób wyceny, pierwsza oferta, link dla klienta.
 * Stan liczony z danych (marka, cennik, oferty), nie odhaczany ręcznie. Znika, gdy wszystko zrobione albo po „Ukryj”
 * (pamiętane w tej przeglądarce). Bez kodu administratora (to nie konto firmy).
 */
import { useEffect, useState } from "react";
import { useBrand } from "@/lib/brand";
import { DEFAULT_CENNIK } from "@/lib/modul";
import { getToken } from "./offerApi";
import type { Offer } from "./offers";
import { useCennik } from "./useCennik";

const KLUCZ = "oprzut:pierwsze-kroki-ukryte";

type Krok = { id: string; tytul: string; opis: string; href: string; akcja: string; zrobione: boolean };

export default function PierwszeKroki({ offers, onNowa }: { offers: readonly Offer[]; onNowa?: () => void }) {
  const brand = useBrand();
  const [ukryte, setUkryte] = useState(true);
  const [admin, setAdmin] = useState(true);
  const { cennik, gotowy } = useCennik(true);
  useEffect(() => {
    setAdmin(!!getToken());
    try {
      setUkryte(localStorage.getItem(KLUCZ) === "1");
    } catch {
      setUkryte(false);
    }
  }, []);

  const wlasneCeny = offers.some((o) => o.kuchnia?.ceny === "reczne" && (o.kuchnia.cenaOgolna !== undefined || o.kuchnia.elementy.some((e) => e.cena !== undefined)));
  const kroki: Krok[] = [
    { id: "firma", tytul: "Logo i dane firmy", opis: "Pojawią się w ofertach, PDF i mailach do klientów.", href: "/panel/ustawienia?tab=firma", akcja: "Dodaj logo", zrobione: !!brand.logo },
    {
      id: "ceny",
      tytul: "Twoje ceny",
      opis: "Własne kwoty w ofercie albo cennik modułów do gotowych wycen.",
      href: "/panel/ustawienia?tab=cennik",
      akcja: "Ustaw cennik",
      zrobione: wlasneCeny || (gotowy && JSON.stringify(cennik) !== JSON.stringify(DEFAULT_CENNIK)),
    },
    { id: "oferta", tytul: "Pierwsza oferta", opis: "Szybka oferta z opisu albo kreator krok po kroku.", href: "/panel/szybka", akcja: "Zrób ofertę", zrobione: offers.length > 0 },
    { id: "link", tytul: "Link 3D dla klienta", opis: "Klient obraca meble, zmienia kolory i akceptuje ofertę.", href: "/panel", akcja: "Wyślij link", zrobione: offers.some((o) => !!o.link) },
  ];
  const ile = kroki.filter((k) => k.zrobione).length;
  if (admin || ukryte || !gotowy || ile === kroki.length) return null;

  const ukryj = () => {
    setUkryte(true);
    try {
      localStorage.setItem(KLUCZ, "1");
    } catch {
      /* tylko do końca wizyty */
    }
  };

  return (
    <section className="pk" aria-label="Pierwsze kroki">
      <div className="pk-gora">
        <b>Pierwsze kroki</b>
        <span className="faint">
          {ile} z {kroki.length}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-plain pk-ukryj" onClick={ukryj}>
          Ukryj
        </button>
      </div>
      <div className="pk-pasek" aria-hidden>
        <i style={{ width: `${(ile / kroki.length) * 100}%` }} />
      </div>
      <ol className="pk-lista">
        {kroki.map((k) => (
          <li key={k.id} data-zrobione={k.zrobione ? "" : undefined}>
            <span className="pk-znak" aria-hidden>
              {k.zrobione ? "✓" : ""}
            </span>
            <span className="pk-tekst">
              <b>{k.tytul}</b>
              <span>{k.opis}</span>
            </span>
            {k.zrobione ? (
              <span className="sr-only">zrobione</span>
            ) : k.id === "oferta" && onNowa ? (
              <button type="button" className="btn btn-ghost pk-akcja" onClick={onNowa}>
                {k.akcja}
              </button>
            ) : (
              <a className="btn btn-ghost pk-akcja" href={k.href}>
                {k.akcja}
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
