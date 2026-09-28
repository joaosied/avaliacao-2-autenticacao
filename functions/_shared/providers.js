// Contratos de cada provedor. Os segredos são lidos de env apenas na troca do código.

export const GITHUB_API_VERSION = "2026-03-10";
export const USER_AGENT = "avaliacao-2-autenticacao";

export const PROVIDERS = {
  google: {
    issuer: "https://accounts.google.com",
    discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    usesNonce: true,
    clientId: (env) => env.GOOGLE_CLIENT_ID,
    clientSecret: (env) => env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    issuer: "https://github.com",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userEndpoint: "https://api.github.com/user",
    scope: null,
    usesNonce: false,
    clientId: (env) => env.GITHUB_CLIENT_ID,
    clientSecret: (env) => env.GITHUB_CLIENT_SECRET,
  },
};

export function getProvider(name) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name) ? PROVIDERS[name] : null;
}

export function redirectUri(env, name) {
  return `${env.PUBLIC_BASE_URL}/oauth/callback/${name}`;
}

export function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
