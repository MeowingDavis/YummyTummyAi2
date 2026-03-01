# Security Best Practices Report

## Executive Summary
This Deno TypeScript web app already has several solid controls in place (input size limits, CSP, HttpOnly/SameSite cookies, server-side error redaction, and DOMPurify for markdown rendering). The main security gaps are insecure-by-default session integrity, host-header-derived origin generation, proxy/TLS cookie hardening ambiguity, and third-party script supply-chain hardening.

Overall risk is **moderate**. There are no obvious critical remote-code-execution paths in the current code, but the top two findings can enable session manipulation and origin poisoning behaviors in common deployments.

## Severity: High

### [SBP-001] Session integrity is optional (unsigned session IDs accepted when `SESSION_SECRET` is unset)
- Rule ID: `EXPRESS-SESS-002` (adapted to this Deno server’s cookie/session model)
- Severity: High
- Location: `src/session.ts:5`, `src/session.ts:46`, `src/session.ts:61`, `src/session.ts:77`
- Evidence:
  - `const SESSION_SECRET = Deno.env.get("SESSION_SECRET")?.trim() ?? "";`
  - `if (!SESSION_SECRET) return null;`
  - `if (!key || await hasValidSignature(parsed.id, parsed.sig)) { return { id: parsed.id, setCookie: null }; }`
- Impact:
  - If `SESSION_SECRET` is not configured, clients can self-choose valid UUID session IDs and the server will accept them, enabling session fixation-style behavior and reducing confidence in per-session abuse controls.
- Fix:
  - Make signing mandatory in production and fail startup if `SESSION_SECRET` is missing.
  - Reject unsigned/invalid session cookies unconditionally and issue a fresh signed cookie.
- Mitigation:
  - At minimum, emit a startup warning and force signed mode via env (for example `REQUIRE_SIGNED_SESSION=1`) until full enforcement is deployed.
- False positive notes:
  - Risk is reduced if this service is strictly internal and session ID is never used for anything meaningful; current code uses it for history and rate-control state, so integrity still matters.

## Severity: Medium

### [SBP-002] Host header can influence public origin output (origin poisoning risk for sitemap/robots)
- Rule ID: `NEXT-HOST-001` / host allowlisting best practice (framework-agnostic)
- Severity: Medium
- Location: `src/server.ts:15`, `src/server.ts:16`, `src/server.ts:26`, `src/server.ts:53`, `src/server.ts:74`, `src/server.ts:79`, `src/templates.ts:19`
- Evidence:
  - `const CANONICAL_ORIGIN = ... ?? "";`
  - `if (!ALLOWED_HOSTS.size) return true;`
  - `return CANONICAL_ORIGIN || url.origin;`
  - Templated replacement into `sitemap.xml`/`robots.txt`: `replaceAll("{{ORIGIN}}", origin)`
- Impact:
  - With default envs, attacker-controlled `Host` headers can alter generated absolute URLs, enabling cache/SEO poisoning and confusing crawlers/clients behind some proxy/CDN setups.
- Fix:
  - Require `CANONICAL_ORIGIN` in production and always render sitemap/robots from that fixed value.
  - Require non-empty `ALLOWED_HOSTS` in production and reject unknown hosts.
- Mitigation:
  - Enforce host/scheme normalization at edge proxy/CDN and strip untrusted forwarded host headers.
- False positive notes:
  - If the edge already strictly rewrites host and blocks unknown domains, exploitability drops; this control is not visible in repo code and should be verified at runtime.

### [SBP-003] Secure cookie detection may fail behind TLS-terminating proxies
- Rule ID: `EXPRESS-COOKIE-001` / cookie security baseline
- Severity: Medium
- Location: `src/session.ts:6`, `src/session.ts:40`, `src/session.ts:42`, `src/session.ts:85`
- Evidence:
  - `const COOKIE_SECURE = Deno.env.get("COOKIE_SECURE") === "1";`
  - `const proto = new URL(req.url).protocol;`
  - `return COOKIE_SECURE || proto === "https:";`
- Impact:
  - In common reverse-proxy deployments where upstream-to-app is HTTP, cookies may be set without `Secure` unless operators remember explicit env configuration.
- Fix:
  - Make production cookie behavior explicit: require `COOKIE_SECURE=1` in production and fail startup if missing.
  - Optionally support trusted `X-Forwarded-Proto` only from known proxy IPs (similar to the existing trusted proxy IP pattern).
- Mitigation:
  - Add deployment checks/health diagnostics to confirm `Set-Cookie` includes `Secure` in production responses.
- False positive notes:
  - If traffic reaches this app directly over HTTPS or envs are already set correctly in production, practical risk is reduced.

## Severity: Low

### [SBP-004] Third-party CDN scripts/styles are loaded without Subresource Integrity (SRI)
- Rule ID: `JS-SRI-001`, `JS-SUPPLY-001`
- Severity: Low
- Location: `public/chat.html:12`, `public/chat.html:15`, `public/chat.html:16`, `public/chat.html:19`, `public/chat.html:20`, `public/index.html:17`, `public/about.html:10`
- Evidence:
  - External scripts/styles from `cdn.tailwindcss.com` and `cdn.jsdelivr.net` are included without `integrity="..."`.
- Impact:
  - If a CDN asset is tampered with or unexpectedly changed, malicious script/style can execute in the app origin.
- Fix:
  - Pin versions and add SRI hashes to third-party resources, or self-host critical JS/CSS assets.
  - Keep CSP script/style allowlists as narrow as possible.
- Mitigation:
  - Prefer build-time bundling and local hosting for Tailwind/marked/DOMPurify/highlight assets.
- False positive notes:
  - This is defense-in-depth; risk depends on your threat model and supply-chain assumptions.

## Positive Controls Observed
- Request body size limits and JSON parse handling: `src/http.ts:14-60`
- Security headers including CSP/frame restrictions: `src/security.ts:4-20`
- Message rendering sanitization path via DOMPurify: `public/js/chat/markdown.js:3-6`
- Error redaction before logging model API errors: `src/server.ts:144-146`

## Suggested Fix Order
1. Enforce signed session cookies and mandatory `SESSION_SECRET` (`SBP-001`).
2. Lock origin/host handling with required canonical origin + host allowlist (`SBP-002`).
3. Harden production cookie secure behavior for proxy/TLS deployments (`SBP-003`).
4. Add SRI or self-host third-party static assets (`SBP-004`).
