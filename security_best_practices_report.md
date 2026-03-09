# Security Best Practices Report

## Executive Summary

This report has been updated after remediation work.

The previously reported high and medium findings have been addressed in code:

- Auth-sensitive routes now have app-side throttling.
- Password policy is enforced server-side for registration, password change, and password recovery completion.
- Cookie-authenticated write routes now reject cross-origin writes.
- Runtime browser dependencies were vendored locally and the CSP was tightened to stop allowing the prior CDN script origins.

Current residual risk is lower. One notable non-blocking observation remains: the app still imports Google Fonts in `public/css/industrial/01-base.css`, so font delivery is still partially external even though the runtime script and stylesheet dependencies from the prior report are now local.

Report written to `security_best_practices_report.md`.

## Remediated Findings

### SBP-001

- Status: Remediated
- Original issue: Missing app-side brute-force throttling on auth-sensitive routes.
- Evidence:
  - [src/rateLimit.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/rateLimit.ts#L17)
  - [src/rateLimit.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/rateLimit.ts#L111)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L101)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L489)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L565)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L689)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L803)
- Notes:
  - The server now uses dedicated auth rate limits with separate IP and identifier buckets.
  - Responses now include `Retry-After` through the shared `rateLimitedResponse()` path.

### SBP-002

- Status: Remediated
- Original issue: Strong password rules existed in the browser but not on the server.
- Evidence:
  - [src/auth.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/auth.ts#L192)
  - [src/auth.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/auth.ts#L208)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L597)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L727)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L565)
  - [public/js/reset-password-page.js](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/js/reset-password-page.js#L81)
  - [public/js/reset-password-page.js](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/js/reset-password-page.js#L99)
- Notes:
  - Password validation is centralized in `validatePassword()`.
  - Password recovery completion now posts through the server endpoint `POST /auth/reset-password/complete`, allowing backend policy enforcement instead of relying on direct browser-only password updates.

### SBP-003

- Status: Remediated
- Original issue: Cookie-authenticated write routes had no visible CSRF or origin validation.
- Evidence:
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L191)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L197)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L208)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L216)
  - [src/server.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/server.ts#L266)
- Notes:
  - The server now blocks cross-origin writes for cookie-authenticated state-changing routes using exact-origin checks plus `Sec-Fetch-Site` fallback logic.
  - Protected routes include `/chat`, `/me/profile`, `/auth/logout`, `/auth/change-password`, `/auth/delete-account`, and `/saved-chats` writes.

### SBP-004

- Status: Remediated
- Original issue: Runtime browser dependencies were loaded from third-party CDNs.
- Evidence:
  - [public/chat.html](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/chat.html#L10)
  - [public/reset-password.html](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/reset-password.html#L9)
  - [public/vendor/tailwindcss-browser.js](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/vendor/tailwindcss-browser.js)
  - [public/vendor/dompurify.min.js](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/vendor/dompurify.min.js)
  - [public/vendor/marked.min.js](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/vendor/marked.min.js)
  - [public/vendor/highlight.min.js](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/vendor/highlight.min.js)
  - [public/vendor/supabase.min.js](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/vendor/supabase.min.js)
  - [src/security.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/security.ts#L18)
- Notes:
  - The reviewed runtime dependencies are now served locally from `public/vendor/`.
  - CSP `script-src` is now reduced to `'self'`, and `connect-src` no longer allows jsDelivr.

## Residual Observation

### RES-001

- Severity: Low
- Location:
  - [public/css/industrial/01-base.css](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/public/css/industrial/01-base.css#L1)
  - [src/security.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/security.ts#L23)
  - [src/security.ts](/mnt/c/Users/RadiumPCs/Documents/GitHub/YummyTummyAi2/src/security.ts#L25)
- Evidence:

```css
@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap");
```

- Impact: Font assets still depend on third-party delivery, which keeps a small external supply-chain and privacy surface.
- Fix: Self-host the font CSS and `woff2` files or replace them with local/system fonts.
- Notes: This was not one of the original four report findings, but it is the main remaining externally hosted frontend asset path.

## Verification

- `deno fmt src/auth.ts src/server.ts src/security.ts public/js/reset-password-page.js`
- `deno check main.ts`
