// Leitura e escrita dos cookies __Host- usados pelo laboratório.

export const TX_COOKIE = "__Host-oauth-tx";
export const SESSION_COOKIE = "__Host-session";
export const TX_MAX_AGE = 600;
export const SESSION_MAX_AGE = 28800;

export function readCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    }
  }
  return null;
}

// Prefixo __Host-: Secure, Path=/ e sem Domain.
function hostCookie(name, value, sameSite, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

export function transactionCookie(value) {
  return hostCookie(TX_COOKIE, value, "Lax", TX_MAX_AGE);
}

export function clearTransactionCookie() {
  return hostCookie(TX_COOKIE, "", "Lax", 0);
}

export function sessionCookie(value) {
  return hostCookie(SESSION_COOKIE, value, "Strict", SESSION_MAX_AGE);
}

export function clearSessionCookie() {
  return hostCookie(SESSION_COOKIE, "", "Strict", 0);
}
