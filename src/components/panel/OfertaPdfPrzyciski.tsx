"use client";

import { slowaProjektu, type TypProjektu } from "@/lib/projekt";
import { useRef, useState } from "react";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { Palette } from "../palettes";
import type { KuchniaUjecie } from "../kuchnia/KuchniaTlo";
import { useBrand } from "@/lib/brand";
import { toast } from "./ui";
import { useCennik } from "./useCennik";
import { useKatalog } from "../katalogStore";
import type { MaterialySnapshot } from "../katalogFirmy";
import { danePdf, pdfHtml, pdfTekst } from "./ofertaPdf";
import { pobierzPdf } from "./pdfPlik";
import { rysunekTechnicznyDokument } from "../rysunek/rysunekTechniczny";

/** Link 3D do kodu QR w PDF (zawsze aktywny – w razie potrzeby utworzony przy generowaniu). */
export type LinkDoPdf = { id: string; url: string; wazny: string | null; pin: boolean };

/** Data wygaśnięcia do PDF: „10 listopada 2026”. */
export const waznyDo = (iso?: string) =>
  iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : null;

/** Link wygasł (albo wygaśnie w ciągu minuty) – do PDF trzeba nowego. */
export const linkWygasl = (expiresAt?: string) => !!expiresAt && Date.parse(expiresAt) < Date.now() + 60_000;

export function OfertaPdfPrzyciski({
  id,
  title,
  client,
  contact,
  plan,
  front,
  countertop,
  hardware,
  palettes,
  materialy,
  linkUrl,
  zapewnijLink,
  ujecie,
  modele,
  projekt,
  bezCennikaFirmy = false,
}: {
  id: string;
  title: string;
  client: string;
  contact: string;
  plan: PlanKuchni;
  front: string;
  countertop: string;
  hardware: string;
  palettes: Palette[];
  /** Snapshot materiałów zapisanej oferty – PDF pokazuje te same nazwy i dopłaty co link klienta. */
  materialy?: MaterialySnapshot | null;
  linkUrl: string | null;
  /** Zwraca aktywny link 3D (tworzy go, gdy go nie ma albo wygasł); null = PDF bez kodu QR. */
  zapewnijLink?: () => Promise<LinkDoPdf | null>;
  ujecie?: { current: KuchniaUjecie | null };
  /** Modele w planie (oznaczenia ról) – PDF pokazuje tylko materiały, które projekt ma. */
  modele?: readonly { id: string; tags: Record<string, string> }[];
  projekt?: TypProjektu;
  /** Test kreatora bez konta: cennik domyślny, bez zapytania o cennik firmy. */
  bezCennikaFirmy?: boolean;
}) {
  const brand = useBrand();
  const { cennik, blad } = useCennik(!bezCennikaFirmy);
  const katalog = useKatalog();
  const busy = useRef(false);
  /** Który plik właśnie się składa (przycisk pokazuje postęp). */
  const [sklada, setSklada] = useState<"oferta" | "rysunek" | null>(null);
  const tytul = () => title.trim() || slowaProjektu(projekt).nazwa;

  const zloz = (zeZdjeciem: boolean, link: LinkDoPdf | null) =>
    danePdf({
      id: link?.id ?? id,
      title: tytul(),
      client: client.trim(),
      contact: contact.trim(),
      firma: brand.name,
      logo: brand.logo,
      plan,
      front,
      countertop,
      hardware,
      palettes,
      katalog,
      snapshot: materialy ?? null,
      cennik,
      cennikUwaga: blad ? "Nie pobrano cennika firmy. Kwoty liczone są cennikiem domyślnym i mogą różnić się od zapisu na serwerze." : null,
      link3d: link?.url ?? linkUrl,
      link3dWazny: link?.wazny ?? null,
      link3dPin: link?.pin ?? false,
      zdjecie: zeZdjeciem ? (ujecie?.current?.jpeg() ?? null) : null,
      // Ujęcia 3D (całość z kilku stron, każdy mebel osobno) – po bieżącym widoku, kamera wraca na miejsce.
      zdjecia: zeZdjeciem ? (ujecie?.current?.zdjecia?.() ?? null) : null,
      modele,
      projekt,
    });

  /** Link do kodu QR; błąd nie blokuje PDF – wtedy plik wychodzi bez kodu. */
  const link = async () => {
    if (!zapewnijLink) return null;
    try {
      return await zapewnijLink();
    } catch (e) {
      toast("PDF bez kodu QR", { type: "err", desc: e instanceof Error && e.message ? `Nie utworzono linku 3D: ${e.message}` : "Nie utworzono linku 3D." });
      return null;
    }
  };

  const pobierz = async () => {
    if (busy.current) return;
    busy.current = true;
    setSklada("oferta");
    try {
      const l = await link();
      const d = zloz(true, l);
      await pobierzPdf(pdfHtml(d), { nazwa: `Oferta ${d.id} ${d.title}`, margines: 14 });
      toast("PDF pobrany", { desc: l ? "Plik jest w folderze Pobrane. Kod QR w pliku prowadzi do projektu w 3D." : "Plik jest w folderze Pobrane." });
    } catch (e) {
      toast("Nie udało się zapisać PDF", { type: "err", desc: e instanceof Error && e.message ? e.message : "Spróbuj jeszcze raz." });
    } finally {
      busy.current = false;
      setSklada(null);
    }
  };

  const wyslij = async () => {
    if (busy.current) return;
    busy.current = true;
    const l = await link().finally(() => (busy.current = false));
    const tekst = pdfTekst(zloz(false, l));
    const addr = contact.includes("@") ? contact.trim() : "";
    const subject = `Oferta PDF ${l?.id ?? id}: ${title.trim() || "Kuchnia"}`;
    const href = `mailto:${encodeURIComponent(addr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(tekst)}`;
    if (href.length > 1800) {
      try {
        await navigator.clipboard.writeText(tekst);
        toast("Treść oferty skopiowana", { desc: "Wiadomość jest za długa na link mailto. Wklej ją w mailu i dołącz PDF." });
      } catch {
        toast("Nie skopiowano treści", { type: "err", desc: "Skopiuj pozycje z podglądu PDF." });
      }
      return;
    }
    window.location.href = href;
  };

  /** Rysunek techniczny (rzut, widoki ścian z wymiarami) jako osobny PDF (strony poziome). Jest też w PDF oferty. */
  const rysunek = async () => {
    if (busy.current) return;
    busy.current = true;
    setSklada("rysunek");
    try {
      const data = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
      await pobierzPdf(rysunekTechnicznyDokument(plan, { firma: brand.name, id, tytul: tytul(), data }), { nazwa: `Rysunek techniczny ${id}`, orientacja: "pozioma", margines: 10 });
      toast("Rysunek techniczny pobrany", { desc: "Plik PDF jest w folderze Pobrane." });
    } catch (e) {
      toast("Nie udało się zapisać PDF", { type: "err", desc: e instanceof Error && e.message ? e.message : "Spróbuj jeszcze raz." });
    } finally {
      busy.current = false;
      setSklada(null);
    }
  };

  return (
    <div className="actions">
      <button type="button" className="btn btn-ink" onClick={() => void pobierz()} disabled={!!sklada} aria-busy={sklada === "oferta"}>
        {sklada === "oferta" ? "Przygotowuję PDF…" : "Pobierz PDF"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => void wyslij()}>
        Wyślij ofertę PDF
      </button>
      {plan.elementy.length ? (
        <button type="button" className="btn btn-ghost" onClick={() => void rysunek()} disabled={!!sklada} aria-busy={sklada === "rysunek"}>
          {sklada === "rysunek" ? "Przygotowuję…" : "Rysunek techniczny"}
        </button>
      ) : null}
    </div>
  );
}
