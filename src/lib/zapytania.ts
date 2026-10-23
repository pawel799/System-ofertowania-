/* Wysyłka formularzy (wycena, pomiar, kontakt) do Pages Function /api/zapytania. */
export type Zapytanie = {
  typ: "wycena" | "pomiar" | "kontakt";
  imie: string;
  telefon?: string;
  email?: string;
  uwagi?: string;
  oferta?: string;
  wybor?: string;
  firma?: string;
};

/*
 * Do której firmy trafia zgłoszenie: strona oferty z linku ustawia identyfikator linku
 * (serwer znajduje po nim firmę). Bez niego – do właściciela systemu (kontakt, oferta demo).
 */
let target: { link?: string } = {};
export function setRequestLink(link: string) {
  target = link ? { link } : {};
}

/** null = zapisane; tekst = komunikat błędu dla użytkownika. */
export async function wyslijZapytanie(z: Zapytanie): Promise<string | null> {
  try {
    const res = await fetch("/api/zapytania", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...z, ...target }),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    return data?.message || "Nie udało się wysłać zgłoszenia. Spróbuj ponownie za chwilę.";
  } catch {
    return "Brak połączenia. Sprawdź internet i spróbuj ponownie.";
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Telefon: co najmniej 9 cyfr (dopuszcza +48, spacje, myślniki). */
export const isPhone = (v: string) => /^[+\d][\d\s()-]*$/.test(v.trim()) && v.replace(/\D/g, "").length >= 9;
