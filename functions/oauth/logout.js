import { readCookie, SESSION_COOKIE, clearSessionCookie } from "../_shared/cookies.js";
import { sha256 } from "../_shared/crypto.js";

function plain(status, text, extra = {}) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

export async function onRequest({ request, env }) {
  // 1. Somente POST.
  if (request.method !== "POST") return plain(405, "Method Not Allowed", { Allow: "POST" });

  // 2. Origin exatamente igual a PUBLIC_BASE_URL.
  const origin = request.headers.get("Origin");
  if (!origin || origin !== env.PUBLIC_BASE_URL) return plain(403, "Forbidden");

  // 3. Remove a sessão no D1.
  const raw = readCookie(request, SESSION_COOKIE);
  if (raw) {
    await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(await sha256(raw)).run();
  }

  // 4 e 5. Expira o cookie e volta para a página.
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${env.PUBLIC_BASE_URL}/`,
      "Set-Cookie": clearSessionCookie(),
      "Cache-Control": "no-store",
    },
  });
}
