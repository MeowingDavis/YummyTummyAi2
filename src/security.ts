// src/security.ts
// Centralized security headers.

export const baseHeaders: HeadersInit = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "script-src 'self' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",
    "connect-src 'self' https://api.groq.com",
    "font-src 'self' https://cdn.jsdelivr.net",
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
