// src/security.ts
// Centralized security headers.

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim();

function buildConnectSrc() {
  const values = new Set(["'self'", "https://api.groq.com", "https://cdn.jsdelivr.net"]);
  if (SUPABASE_URL) {
    try {
      values.add(new URL(SUPABASE_URL).origin);
    } catch {
      // ignore invalid env value; startup validation happens elsewhere
    }
  }
  return Array.from(values).join(" ");
}

export const baseHeaders: HeadersInit = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
    "style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline'",
    `connect-src ${buildConnectSrc()}`,
    "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function withSecurity(extra: HeadersInit = {}) {
  return { ...baseHeaders, ...extra };
}

export function applySecurityHeaders(headers: Headers) {
  for (const [k, v] of Object.entries(baseHeaders)) headers.set(k, v as string);
}
