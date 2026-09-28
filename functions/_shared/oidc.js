// Validação do id_token do Google sem bibliotecas externas.

import { base64UrlDecode, nowSeconds } from "./crypto.js";

const decoder = new TextDecoder();
const encoder = new TextEncoder();
const CLOCK_SKEW = 60;
const ACCEPTED_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

function decodeJson(part) {
  return JSON.parse(decoder.decode(base64UrlDecode(part)));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("fetch failed");
  return response.json();
}

export async function verifyGoogleIdToken(idToken, { issuer, discoveryUrl, clientId, nonce }) {
  // 1. Três partes, todas em Base64URL.
  if (typeof idToken !== "string") throw new Error("missing id_token");
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) {
    throw new Error("malformed id_token");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // 2. Cabeçalho com alg RS256 e kid.
  const header = decodeJson(encodedHeader);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("unexpected header");
  }

  // 3. Documento de descoberta do emissor esperado.
  const discovery = await fetchJson(discoveryUrl);
  if (discovery.issuer !== issuer || typeof discovery.jwks_uri !== "string") {
    throw new Error("unexpected discovery");
  }

  // 4 e 5. JWKS e seleção pelo kid.
  const jwks = await fetchJson(discovery.jwks_uri);
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) throw new Error("unknown kid");

  // 6 e 7. Importar a chave e verificar a assinatura RSASSA-PKCS1-v1_5.
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlDecode(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!valid) throw new Error("bad signature");

  // 8. Declarações iss, aud, exp, iat e nonce.
  const claims = decodeJson(encodedPayload);
  const now = nowSeconds();
  if (!ACCEPTED_ISSUERS.includes(claims.iss)) throw new Error("bad iss");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(clientId)) throw new Error("bad aud");
  if (audiences.length > 1 && claims.azp !== clientId) throw new Error("bad azp");
  if (typeof claims.exp !== "number" || claims.exp <= now - CLOCK_SKEW) throw new Error("expired");
  if (typeof claims.iat !== "number" || claims.iat > now + CLOCK_SKEW) throw new Error("bad iat");
  if (typeof nonce !== "string" || claims.nonce !== nonce) throw new Error("bad nonce");
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new Error("missing sub");

  return {
    issuer,
    subject: claims.sub,
    email: claims.email_verified === true && typeof claims.email === "string" ? claims.email : null,
    displayName: typeof claims.name === "string" ? claims.name : null,
  };
}
