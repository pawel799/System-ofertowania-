"use client";

import { useRef } from "react";
import type { PlanKuchni } from "@/lib/kuchnia";
import type { Palette } from "../palettes";
import type { KuchniaUjecie } from "../kuchnia/KuchniaTlo";
import { useBrand } from "@/lib/brand";
import { toast } from "./ui";
import { useCennik } from "./useCennik";
import { danePdf, otworzPdf, pdfHtml, pdfTekst } from "./ofertaPdf";

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
  ujecie?: { current: KuchniaUjecie | null };
}) {
  const brand = useBrand();
  const { cennik, blad } = useCennik();
  const busy = useRef(false);

  const zloz = (zeZdjeciem: boolean) =>
    danePdf({
      id,
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
      link3d: linkUrl,
      zdjecie: zeZdjeciem ? (ujecie?.current?.jpeg() ?? null) : null,
    });

  const pobierz = () => {
    if (busy.current) return;
    busy.current = true;
    const ok = otworzPdf(pdfHtml(zloz(true)));
    busy.current = false;
    if (!ok) {
      toast("Przeglądarka zablokowała okno PDF", {
        type: "err",
        desc: "Zezwól na wyskakujące okna dla tej strony i kliknij „Pobierz PDF” jeszcze raz.",
      });
      return;
    }
    toast("Okno PDF otwarte", { desc: "W oknie drukowania wybierz „Zapisz jako PDF”." });
  };

  const wyslij = async () => {
    const tekst = pdfTekst(zloz(false));
    const addr = contact.includes("@") ? contact.trim() : "";
    const subject = `Oferta PDF ${id}: ${title.trim() || "Kuchnia"}`;
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
      <button type="button" className="btn btn-ink" onClick={pobierz}>
        Pobierz PDF
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => void wyslij()}>
        Wyślij ofertę PDF
      </button>
    </div>
  );
}
