"use client";

/*
 * Ustawienia → Konto → „Kopia zapasowa”: wszystkie oferty firmy do pliku JSON (pełne dane – projekty z kreatora,
 * ceny, klienci, linki, historia) razem z cennikiem, katalogiem materiałów i pakietami RAL, oraz CSV z ofertami
 * do Excela (średnik, UTF-8 z BOM – polskie znaki). Wszystko składa się w przeglądarce z API panelu.
 */
import { useState } from "react";
import { bazaKuchni } from "@/lib/kuchnia";
import { bazaZModulami } from "@/lib/modul";
import { DEFAULT_CENNIK } from "@/lib/modul";
import { assetsApi, cennikApi, panelApi } from "./offerApi";
import { STATUS_LABEL, type Offer } from "./offers";
import { toast } from "./ui";

const dzis = () => new Date().toISOString().slice(0, 10);

function pobierz(nazwa: string, tresc: string, typ: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([tresc], { type: typ }));
  a.download = nazwa;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const pole = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV ofert: jeden wiersz na ofertę. */
export function csvOfert(oferty: readonly Offer[], cennik = DEFAULT_CENNIK) {
  const naglowek = ["Numer", "Tytuł", "Klient", "Kontakt", "Status", "Netto (zł)", "Pozycji", "Link dla klienta", "Utworzono", "Zmieniono"];
  const wiersze = oferty.map((o) => [
    o.id,
    o.title,
    o.client,
    o.contact,
    STATUS_LABEL[o.status] ?? o.status,
    o.kuchnia?.elementy.length ? bazaKuchni(o.kuchnia, cennik) : bazaZModulami(o.base, o.moduly, cennik),
    o.kuchnia?.elementy.length ?? o.moduly?.length ?? "",
    o.link ? `/oferta/${o.link.slug}` : "",
    o.createdAt?.slice(0, 10) ?? "",
    o.updatedAt?.slice(0, 10) ?? "",
  ]);
  return "﻿" + [naglowek, ...wiersze].map((w) => w.map(pole).join(";")).join("\r\n");
}

export function KopiaZapasowa({ onAuthError }: { onAuthError: (e: unknown) => boolean }) {
  const [busy, setBusy] = useState<"" | "json" | "csv">("");

  const dane = async () => {
    const [oferty, cennik, katalog, palettes] = await Promise.all([
      panelApi.list(),
      cennikApi.get().catch(() => DEFAULT_CENNIK),
      assetsApi.katalog().catch(() => []),
      assetsApi.palettes().catch(() => []),
    ]);
    return { oferty, cennik, katalog, palettes };
  };

  const zrob = async (rodzaj: "json" | "csv") => {
    setBusy(rodzaj);
    try {
      const d = await dane();
      if (rodzaj === "json") {
        pobierz(
          `oprzut-kopia-${dzis()}.json`,
          JSON.stringify({ wersja: 1, utworzono: new Date().toISOString(), ...d }, null, 2),
          "application/json",
        );
      } else pobierz(`oprzut-oferty-${dzis()}.csv`, csvOfert(d.oferty, d.cennik), "text/csv;charset=utf-8");
      toast("Kopia pobrana", { desc: `${d.oferty.length} ${d.oferty.length === 1 ? "oferta" : "ofert(y)"} – plik jest w folderze Pobrane.` });
    } catch (e) {
      if (!onAuthError(e)) toast("Nie udało się zrobić kopii", { type: "err", desc: e instanceof Error ? e.message : "" });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="set-card set-card-wide">
      <h2>Kopia zapasowa</h2>
      <p className="lede">
        Wszystkie oferty na dysk: <b>JSON</b> – pełne dane (projekty z kreatora, ceny, klienci, linki, historia) z cennikiem, katalogiem materiałów i
        kolorami RAL; <b>CSV</b> – lista ofert do Excela. Rób kopię np. raz w miesiącu.
      </p>
      <div className="actions">
        <button type="button" className="btn btn-ink" disabled={!!busy} onClick={() => void zrob("json")}>
          {busy === "json" ? "Przygotowuję…" : "Pobierz kopię (JSON)"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => void zrob("csv")}>
          {busy === "csv" ? "Przygotowuję…" : "Lista ofert (CSV)"}
        </button>
      </div>
    </section>
  );
}
