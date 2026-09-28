import {
  getProvider,
  redirectUri,
  notFound,
  GITHUB_API_VERSION,
  USER_AGENT,
} from "../../_shared/providers.js";
import { randomToken, sha256, safeEqual, nowSeconds } from "../../_shared/crypto.js";
import {
  readCookie,
  TX_COOKIE,
  clearTransactionCookie,
  sessionCookie,
  SESSION_MAX_AGE,
} from "../../_shared/cookies.js";
import { verifyGoogleIdToken } from "../../_shared/oidc.js";

// Resposta genérica: não revela em qual etapa a validação falhou.
function fail() {
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", clearTransactionCookie());
  return new Response("Authentication failed", { status: 400, headers });
}

async function exchangeCode(provider, name, env, code, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(env, name),
    client_id: provider.clientId(env),
    client_secret: provider.clientSecret(env),
    code_verifier: codeVerifier,
  });
  const response = await fetch(provider.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body,
  });
  if (!response.ok) throw new Error("token exchange failed");
  const tokens = await response.json();
  if (tokens.error) throw new Error("token exchange failed");
  return tokens;
}

async function identifyGoogle(provider, env, tokens, transaction) {
  return verifyGoogleIdToken(tokens.id_token, {
    issuer: provider.issuer,
    discoveryUrl: provider.discoveryUrl,
    clientId: provider.clientId(env),
    nonce: transaction.nonce,
  });
}

async function identifyGithub(provider, env, tokens) {
  const accessToken = tokens.access_token;
  if (typeof accessToken !== "string" || !accessToken) throw new Error("missing access_token");
  if (typeof tokens.token_type !== "string" || tokens.token_type.toLowerCase() !== "bearer") {
    throw new Error("unexpected token_type");
  }

  // O token serve somente para consultar /user.
  const userResponse = await fetch(provider.userEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": USER_AGENT,
    },
  });
  if (userResponse.status !== 200) throw new Error("user lookup failed");
  const user = await userResponse.json();
  if (!Number.isInteger(user.id)) throw new Error("missing id");

  // Revoga a autorização da OAuth App antes de criar a sessão local.
  const clientId = provider.clientId(env);
  const basic = btoa(`${clientId}:${provider.clientSecret(env)}`);
  const revokeResponse = await fetch(
    `https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ access_token: accessToken }),
    }
  );
  if (revokeResponse.status !== 204) throw new Error("revocation failed");

  return {
    issuer: provider.issuer,
    subject: String(user.id),
    email: typeof user.email === "string" ? user.email : null,
    displayName: typeof user.name === "string" && user.name ? user.name : user.login ?? null,
  };
}

export async function onRequestGet({ request, params, env }) {
  const name = params.provider;
  const provider = getProvider(name);
  if (!provider) return notFound();

  // 1. Recusa error e a ausência de code e state.
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.has("error") || !code || !state) return fail();

  // 2. Exige o cookie temporário.
  const transactionId = readCookie(request, TX_COOKIE);
  if (!transactionId) return fail();

  // 3 e 5. Localiza e consome a transação em uma única operação (uso único).
  const now = nowSeconds();
  const transaction = await env.DB.prepare(
    "DELETE FROM oauth_transactions WHERE id_hash = ?1 RETURNING provider, state_hash, nonce, code_verifier, expires_at"
  )
    .bind(await sha256(transactionId))
    .first();
  if (!transaction || transaction.expires_at <= now || transaction.provider !== name) return fail();

  // 4. Compara o resumo de state.
  if (!safeEqual(await sha256(state), transaction.state_hash)) return fail();

  // 6 e 7. Troca o código e confirma a identidade.
  let identity;
  try {
    const tokens = await exchangeCode(provider, name, env, code, transaction.code_verifier);
    identity =
      name === "google"
        ? await identifyGoogle(provider, env, tokens, transaction)
        : await identifyGithub(provider, env, tokens);
  } catch {
    return fail();
  }

  // 8. Cria a sessão opaca; o D1 guarda apenas o resumo.
  const sessionId = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(now),
    env.DB.prepare(
      "INSERT INTO sessions (id_hash, issuer, subject, email, display_name, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    ).bind(
      await sha256(sessionId),
      identity.issuer,
      identity.subject,
      identity.email,
      identity.displayName,
      now + SESSION_MAX_AGE,
      now
    ),
  ]);

  // 9 e 10. Limpa o cookie temporário e volta para a página.
  const headers = new Headers({ Location: `${env.PUBLIC_BASE_URL}/`, "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearTransactionCookie());
  headers.append("Set-Cookie", sessionCookie(sessionId));
  return new Response(null, { status: 302, headers });
}
