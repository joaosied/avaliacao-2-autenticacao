import { getProvider, redirectUri, notFound } from "../../_shared/providers.js";
import { randomToken, sha256, nowSeconds } from "../../_shared/crypto.js";
import { transactionCookie, TX_MAX_AGE } from "../../_shared/cookies.js";

export async function onRequestGet({ params, env }) {
  const name = params.provider;
  const provider = getProvider(name);
  if (!provider) return notFound();

  const transactionId = randomToken();
  const state = randomToken();
  const codeVerifier = randomToken();
  const codeChallenge = await sha256(codeVerifier);
  const nonce = provider.usesNonce ? randomToken() : null;
  const now = nowSeconds();

  await env.DB.batch([
    env.DB.prepare("DELETE FROM oauth_transactions WHERE expires_at <= ?1").bind(now),
    env.DB.prepare(
      "INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    ).bind(await sha256(transactionId), name, await sha256(state), nonce, codeVerifier, now + TX_MAX_AGE),
  ]);

  const url = new URL(provider.authorizationEndpoint);
  url.searchParams.set("client_id", provider.clientId(env));
  url.searchParams.set("redirect_uri", redirectUri(env, name));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (provider.scope) url.searchParams.set("scope", provider.scope);
  if (nonce) url.searchParams.set("nonce", nonce);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": transactionCookie(transactionId),
      "Cache-Control": "no-store",
    },
  });
}
