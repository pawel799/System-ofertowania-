/*
 * Nagłówki bezpieczeństwa dla wszystkich odpowiedzi /api/* i zadania w tle przy okazji ruchu (_lib/zadania.ts).
 * (public/_headers działa tylko dla plików statycznych, nie dla Pages Functions.)
 * API zwraca JSON albo plik modelu, więc polityka może być najostrzejsza:
 * nic się tu nie wykonuje, odpowiedzi nie da się osadzić w ramce ani wczytać z innej domeny.
 */
import { store, type Env } from "../_lib/offers";
import { uruchomZadania } from "../_lib/zadania";

type MiddlewareCtx = { next: () => Promise<Response>; request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void };

const HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export const onRequest = async (ctx: MiddlewareCtx) => {
  const res = await ctx.next();
  // Odpowiedź z handlera może mieć niezmienne nagłówki – kopiujemy ją.
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(HEADERS)) out.headers.set(k, v);
  // Zadania w tle (maile o końcu okresu próbnego) – przy okazji ruchu, najwyżej raz na godzinę (_lib/zadania.ts).
  if (ctx.waitUntil && ctx.env?.OFFERS) {
    ctx.waitUntil(uruchomZadania(ctx.env, store(ctx.env), new URL(ctx.request.url).origin).catch((e) => console.error("Zadania", e)));
  }
  return out;
};
