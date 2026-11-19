/*
 * /api/settings/plyty (panel) – własna baza płyt i blatów stolarni (import z CSV), KV firmy: boards:csv.
 *   GET – { plyty, at } (każdy w zespole: kreator pokazuje je przy wyborze płyty)
 *   PUT – { plyty: Board[] } (tylko właściciel konta); pusta lista = usunięcie bazy
 * Walidacja jak przy imporcie CSV (src/lib/plyty.ts). Ceny są opcjonalne (tryb „bez cen”).
 */
import { panel, requireOwner } from "../../_lib/auth";
import { HttpError, handle, json, readJson } from "../../_lib/offers";
import { MAX_PLYT_CSV, walidujPlyte, type Board } from "../../../src/lib/plyty";

const KEY = "boards:csv";

export const onRequestGet = handle(async (ctx) => {
  const { kv } = await panel(ctx);
  const raw = await kv.get(KEY);
  const v = raw ? (JSON.parse(raw) as { plyty: Board[]; at?: string }) : { plyty: [] };
  return json({ plyty: v.plyty ?? [], at: v.at ?? null });
});

export const onRequestPut = handle(async (ctx) => {
  const { session, kv } = await panel(ctx);
  requireOwner(session);
  const body = (await readJson(ctx.request, 1_500_000)) as { plyty?: unknown };
  if (!body || !Array.isArray(body.plyty)) throw new HttpError(400, "bad_request", "Brak listy płyt.");
  if (body.plyty.length > MAX_PLYT_CSV) throw new HttpError(400, "bad_request", `Maksymalnie ${MAX_PLYT_CSV} płyt.`);
  const ids = new Set<string>();
  const plyty: Board[] = [];
  for (const p of body.plyty) {
    let b: Board;
    try {
      b = walidujPlyte(p, "csv");
    } catch (e) {
      throw new HttpError(400, "bad_request", e instanceof Error ? e.message : "Zła płyta.");
    }
    if (ids.has(b.id)) throw new HttpError(400, "bad_request", `Płyta ${b.code} jest na liście dwa razy.`);
    ids.add(b.id);
    plyty.push(b);
  }
  const at = new Date().toISOString();
  if (plyty.length) await kv.put(KEY, JSON.stringify({ plyty, at }));
  else await kv.delete(KEY);
  return json({ plyty, at: plyty.length ? at : null });
});
