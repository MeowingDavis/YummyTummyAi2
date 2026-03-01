// src/security.ts
// Centralized security headers.

export const baseHeaders: HeadersInit = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    [
      "script-src",
      "'self'",
      "https://cdn.tailwindcss.com",
      "https://cdn.jsdelivr.net/npm/dompurify@3.1.7/dist/purify.min.js",
      "https://cdn.jsdelivr.net/npm/marked@13.0.3/marked.min.js",
      "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.10.0/highlight.min.js",
    ].join(" "),
    [
      "style-src",
      "'self'",
      "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.10.0/styles/github-dark.min.css",
      "'unsafe-inline'",
    ].join(" "),
    "connect-src 'self' https://api.groq.com",
    "font-src 'self'",
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
