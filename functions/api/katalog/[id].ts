/*
 * /api/katalog/:id  (panel)
 *   GET    – jedna pozycja
 *   PUT    – zmiana; wyłączenie albo zmiana rodzaju pozycji użytej w ofertach → 409
 *   DELETE – usunięcie; 409, gdy pozycja jest w jakiejś ofercie
 * Zmiana dopłaty nie zmienia ceny w wysłanych linkach – oferta trzyma snapshot (materialy) z chwili zapisu.
 */
import { getKatalogPozycja, katalogId, ofertyZPozycja, validateKatalog } from "../../_lib/katalog";
import { handle, HttpError, json, param, readJson } from "../../_lib/offers";
import { panel } from "../../_lib/auth";

const notFound = () => new HttpError(404, "not_found", "Nie ma takiej pozycji katalogu.");

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const p = await getKatalogPozycja(kv, katalogId(param(ctx, "id")));
  if (!p) throw notFound();
  return json({ pozycja: p });
});

export const onRequestPut = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const id = katalogId(param(ctx, "id"));
  const existing = await getKatalogPozycja(kv, id);
  if (!existing) throw notFound();
  const next = validateKatalog(await readJson(ctx.request), id);
  if ((existing.active && !next.active) || existing.kind !== next.kind) {
    const used = await ofertyZPozycja(kv, id);
    if (used.length) {
      throw new HttpError(
        409,
        "in_use",
        `Pozycja jest użyta w ofertach: ${used.join(", ")}. Zmień w nich materiał, zanim ją wyłączysz albo zmienisz rodzaj.`,
        { oferty: used },
      );
    }
  }
  const saved = { ...next, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  await kv.put(`catalog:${id}`, JSON.stringify(saved));
  return json({ pozycja: saved });
});

export const onRequestDelete = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const id = katalogId(param(ctx, "id"));
  if (!(await getKatalogPozycja(kv, id))) throw notFound();
  const used = await ofertyZPozycja(kv, id);
  if (used.length) {
    throw new HttpError(409, "in_use", `Pozycja jest użyta w ofertach: ${used.join(", ")}. Zmień w nich materiał.`, { oferty: used });
  }
  await kv.delete(`catalog:${id}`);
  return new Response(null, { status: 204 });
});
