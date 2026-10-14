/*
 * Nagłówki bezpieczeństwa dla wszystkich odpowiedzi /api/*.
 * (public/_headers działa tylko dla plików statycznych, nie dla Pages Functions.)
 * API zwraca JSON albo plik modelu, więc polityka może być najostrzejsza:
 * nic się tu nie wykonuje, odpowiedzi nie da się osadzić w ramce ani wczytać z innej domeny.
 */
type MiddlewareCtx = { next: () => Promise<Response> };

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
  return out;
};
