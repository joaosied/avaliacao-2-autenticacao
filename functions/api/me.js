import { readCookie, SESSION_COOKIE } from "../_shared/cookies.js";
import { sha256, nowSeconds } from "../_shared/crypto.js";

function unauthorized() {
  return Response.json(
    { error: "unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

export async function onRequestGet({ request, env }) {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return unauthorized();

  const row = await env.DB.prepare(
    "SELECT issuer, email, display_name, expires_at FROM sessions WHERE id_hash = ?1 AND expires_at > ?2"
  )
    .bind(await sha256(raw), nowSeconds())
    .first();
  if (!row) return unauthorized();

  return Response.json(
    {
      provider: row.issuer === "https://github.com" ? "github" : "google",
      displayName: row.display_name,
      email: row.email,
      expiresAt: row.expires_at,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
