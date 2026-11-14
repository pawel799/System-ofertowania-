"use client";

/*
 * Panel → oferta → „Edytuj ofertę”: poprawki po utworzeniu oferty.
 * Dane (tytuł, klient, kontakt, powitanie) zmieniają się w tym oknie, a układ, meble, materiały i dodatki w kreatorze.
 * Zapis jak każda zmiana w panelu (serwer, wersja dla klienta, jeśli ma link). Reguły pól jak na serwerze (functions/_lib/offers.ts).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { offerKey } from "./offerApi";
import type { Offer } from "./offers";

export type ZmianyDanych = Pick<Offer, "title" | "client" | "contact" | "greet" | "contactPerson">;

const MAX = 200;

export default function EdycjaOferty({ offer, onZapisz, onClose }: { offer: Offer; onZapisz: (z: ZmianyDanych, opis: string) => void; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: offer.title, client: offer.client, contact: offer.contact, greet: offer.greet ?? "", contactPerson: offer.contactPerson ?? "" });
  const [ruszone, setRuszone] = useState<Record<string, boolean>>({});
  const pierwsze = useRef<HTMLInputElement>(null);
  const firma = offer.clientType === "company";

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    pierwsze.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const bledy: Partial<Record<keyof typeof f, string>> = {};
  if (!f.title.trim()) bledy.title = "Podaj tytuł oferty.";
  if (!f.client.trim()) bledy.client = firma ? "Podaj nazwę firmy." : "Podaj imię i nazwisko klienta.";
  if (f.greet.trim().length > 60) bledy.greet = "Imię do powitania do 60 znaków.";
  const blad = (k: keyof typeof f) => (ruszone[k] ? bledy[k] : undefined);

  const zapisz = (e: FormEvent) => {
    e.preventDefault();
    if (Object.keys(bledy).length) return setRuszone({ title: true, client: true, greet: true });
    const z: ZmianyDanych = {
      title: f.title.trim(),
      client: f.client.trim(),
      contact: f.contact.trim(),
      greet: f.greet.trim() || null,
      ...(firma ? { contactPerson: f.contactPerson.trim() || undefined } : {}),
    };
    const zmienione = [
      z.title !== offer.title && "tytuł",
      z.client !== offer.client && (firma ? "firma" : "klient"),
      z.contact !== offer.contact && "kontakt",
      z.greet !== (offer.greet ?? null) && "powitanie",
      firma && (z.contactPerson ?? "") !== (offer.contactPerson ?? "") && "osoba kontaktowa",
    ].filter(Boolean) as string[];
    if (zmienione.length) onZapisz(z, `Poprawiono: ${zmienione.join(", ")}`);
    onClose();
  };

  const pole = (k: keyof typeof f, label: string, opcje: { placeholder?: string; max?: number; ref?: boolean; typ?: string } = {}) => (
    <div className="field">
      <label htmlFor={`ed-${k}`}>{label}</label>
      <input
        id={`ed-${k}`}
        ref={opcje.ref ? pierwsze : undefined}
        className="input"
        autoComplete="off"
        maxLength={opcje.max ?? MAX}
        placeholder={opcje.placeholder}
        inputMode={opcje.typ === "kontakt" ? "email" : undefined}
        value={f[k]}
        aria-invalid={blad(k) ? true : undefined}
        aria-describedby={blad(k) ? `ed-${k}-blad` : undefined}
        onChange={(e) => {
          setF((s) => ({ ...s, [k]: e.target.value }));
          setRuszone((r) => ({ ...r, [k]: true }));
        }}
      />
      {blad(k) ? (
        <p id={`ed-${k}-blad`} className="err" role="alert">
          {blad(k)}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="overlay" data-open={open ? "" : undefined}>
      <div className="backdrop" onClick={onClose} />
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ed-tytul" onSubmit={zapisz} noValidate>
        <div className="m-pad">
          <div className="m-top">
            <h2 id="ed-tytul" style={{ fontSize: 15 }}>
              Edytuj ofertę <span className="mono faint">{offer.id}</span>
            </h2>
          </div>
          {pole("title", "Tytuł oferty", { ref: true, placeholder: "Np. Kuchnia w L – dąb i grafit" })}
          {pole("client", firma ? "Firma" : "Imię i nazwisko klienta")}
          {firma ? pole("contactPerson", "Osoba kontaktowa") : null}
          <div className="grid2">
            {pole("contact", "E-mail lub telefon", { typ: "kontakt" })}
            {pole("greet", "Imię do powitania", { max: 60, placeholder: "puste = „Dzień dobry!”" })}
          </div>
          {offer.kuchnia ? (
            <p className="lede">
              Układ, meble, materiały i dodatki poprawisz w kreatorze:{" "}
              <a href={`/panel/kreator?id=${offerKey(offer.id)}`}>otwórz ofertę w kreatorze</a>. {offer.link ? "Klient z linkiem zobaczy nową wersję oferty." : ""}
            </p>
          ) : (
            <p className="lede">Pozycje i ceny poprawisz niżej, w sekcji z modułami oferty.</p>
          )}
          <div className="actions" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-plain" onClick={onClose}>
              Anuluj
            </button>
            <button type="submit" className="btn btn-ink">
              Zapisz zmiany
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
