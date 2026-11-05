"use client";

/*
 * /panel/rozkroj – formatki i rozkrój bez projektu w kreatorze: lista z KD Max, PRO100 albo Excela
 * (wklejona lub CSV) i formatki z modelu 3D (OBJ z PRO100, 3DS, GLB). Liczy się w przeglądarce, wymaga zalogowania.
 */
import { useEffect, useState } from "react";
import PrzelacznikMotywu from "../motyw/PrzelacznikMotywu";
import { useBrand } from "@/lib/brand";
import { hasLogin } from "../panel/offerApi";
import { LoginDialog, LogoutButton, PanelBrand } from "../panel/PanelGate";
import { Toaster, Tooltips } from "../panel/ui";
import Produkcja from "./Produkcja";

export default function RozkrojApp() {
  const brand = useBrand();
  const [auth, setAuth] = useState<{ need: boolean; error: string }>({ need: false, error: "" });
  useEffect(() => {
    if (!hasLogin()) setAuth({ need: true, error: "" });
  }, []);
  const data = new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="pnl set">
      <header className="top">
        <a className="btn btn-plain" href="/panel" aria-label="Wróć do ofert">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <PanelBrand />
        <div className="crumb">
          <span>/</span>
          <b>Formatki i rozkrój</b>
        </div>
        <span className="grow" />
        {!auth.need ? <LogoutButton /> : null}
        <a className="btn btn-ghost" href="/panel">
          Oferty
        </a>
        <PrzelacznikMotywu className="btn btn-plain" domyslny="system" />
      </header>
      <main className="surface set-main">
        {auth.need ? null : <Produkcja meta={{ firma: brand.name, tytul: "Lista formatek", kod: "ROZKROJ", data }} />}
      </main>
      {auth.need ? <LoginDialog error={auth.error} onLoggedIn={() => setAuth({ need: false, error: "" })} /> : null}
      <Toaster />
      <Tooltips />
    </div>
  );
}
