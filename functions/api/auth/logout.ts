/* POST /api/auth/logout – kończy sesję (usuwa ją z KV i kasuje ciasteczko). */
import { clearCookie, destroySession } from "../../_lib/auth";
import { handle } from "../../_lib/offers";

export const onRequestPost = handle(async (ctx) => {
  await destroySession(ctx);
  return new Response(null, { status: 204, headers: { "set-cookie": clearCookie(ctx.request), "cache-control": "no-store" } });
});
