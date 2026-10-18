"use client";

import { useEffect, useState } from "react";
import { useBrand } from "@/lib/brand";
import { demoOfferEmail } from "@/lib/offerEmail";

/* Podgląd liczony w przeglądarce: aktualna data ważności i marka firmy z Ustawień. */
export default function MailPreview() {
  const brand = useBrand();
  const [html, setHtml] = useState("");
  useEffect(() => setHtml(demoOfferEmail(window.location.origin, brand)), [brand]);
  return (
    <iframe
      title="Podgląd maila z ofertą"
      srcDoc={html}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, background: "#f5f5f4" }}
    />
  );
}
