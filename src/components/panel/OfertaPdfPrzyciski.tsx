"use client";

import { useRef } from "react";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { Palette } from "../palettes";
import type { KuchniaUjecie } from "../kuchnia/KuchniaTlo";
import { useBrand } from "@/lib/brand";
import { toast } from "./ui";
import { useCennik } from "./useCennik";
import { danePdf, oknoPdf, pdfHtml, pdfTekst, wpiszPdf } from "./ofertaPdf";

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
  linkUrl,
  zapewnijLink,
  ujecie,
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
  linkUrl: string | null;
  /** Zwraca aktywny link 3D (tworzy go, gdy go nie ma albo wygasł); null = PDF bez kodu QR. */
  zapewnijLink?: () => Promise<LinkDoPdf | null>;
  ujecie?: { current: KuchniaUjecie | null };
}) {
  const brand = useBrand();
  const { cennik, blad } = useCennik();
  const busy = useRef(false);

  const zloz = (zeZdjeciem: boolean, link: LinkDoPdf | null) =>
    danePdf({
      id: link?.id ?? id,
      title: title.trim() || "Kuchnia",
      client: client.trim(),
      contact: contact.trim(),
      firma: brand.name,
      logo: brand.logo,
      plan,
      front,
      countertop,
      hardware,
      palettes,
      cennik,
      cennikUwaga: blad ? "Nie pobrano cennika firmy. Kwoty liczone są cennikiem domyślnym i mogą różnić się od zapisu na serwerze." : null,
      link3d: link?.url ?? linkUrl,
      link3dWazny: link?.wazny ?? null,
      link3dPin: link?.pin ?? false,
      zdjecie: zeZdjeciem ? (ujecie?.current?.jpeg() ?? null) : null,
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
    // Okno od razu po kliknięciu – po await przeglądarka uznałaby je za wyskakujące.
    const w = oknoPdf();
    if (!w) {
      busy.current = false;
      toast("Przeglądarka zablokowała okno PDF", {
        type: "err",
        desc: "Zezwól na wyskakujące okna dla tej strony i kliknij „Pobierz PDF” jeszcze raz.",
      });
      return;
    }
    try {
      const l = await link();
      if (!wpiszPdf(w, pdfHtml(zloz(true, l)))) return;
      toast("Okno PDF otwarte", {
        desc: l ? "Kod QR prowadzi do kuchni w 3D. W oknie drukowania wybierz „Zapisz jako PDF”." : "W oknie drukowania wybierz „Zapisz jako PDF”.",
      });
    } finally {
      busy.current = false;
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

  return (
    <div className="actions">
      <button type="button" className="btn btn-ink" onClick={() => void pobierz()}>
        Pobierz PDF
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => void wyslij()}>
        Wyślij ofertę PDF
      </button>
    </div>
  );
}
