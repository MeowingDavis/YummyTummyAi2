# Yummy Tummy AI

Yummy Tummy AI is a food-first web assistant built as a single Deno service.
It serves a static frontend, runs chat orchestration on the server, uses Groq
for LLM responses, uses Spoonacular for pantry search, and stores account data
and app state in Supabase.

This README is intentionally written as a lightweight design doc rather than a
deployment guide. It explains what the product is, how the system is
structured, what exists today, and what the next upgrades should likely be.

## Product Summary

The core idea is simple: turn food questions, ingredient lists, cravings, and
dietary constraints into practical cooking help.

Today the product combines four main experiences:

- A food-focused chat assistant
- A pantry and recipe discovery surface
- Account-backed personalization and persistence
- A premium static site experience with minimal client complexity

The project is deliberately narrow in scope. It is not trying to be a general
purpose chatbot. It is trying to be a helpful cooking companion with a clean
web product around it.

## Product Goals

- Make meal decisions faster for everyday users
- Keep the assistant focused on food, recipes, and pantry workflows
- Personalize recommendations around stable preferences like allergies,
  dislikes, and dietary requirements
- Preserve important user state across sessions without making the frontend
  heavy or build-step dependent
- Keep the deployment model simple enough to run as one service
- Apply reasonable safety, privacy, and abuse controls for a public LLM app

## Current Feature Set

### User-facing product features

- Food-scoped chat assistant for recipe ideas, ingredient-driven suggestions,
  recipe expansion, and follow-up questions
- Public marketing and product pages for home, chat, pantry, about, auth, and
  account flows
- Pantry search powered by Spoonacular with filters for query size and prep
  time
- Recipe detail views and the ability to save recipes into a signed-in recipe
  book
- Custom recipe creation for user-authored recipe book entries
- Saved chats for signed-in users, including load, delete, and JSON export
- Profile management for dietary requirements, allergies, and dislikes
- Forgot-password, reset-password, password change, logout, and account
  deletion flows
- Configurable model selection surfaced to the chat UI from the server

### Assistant behavior features

- Chat mode detection for ingredient mode, idea mode, expansion mode, more
  ideas mode, and lightweight conversational mode
- Food-signal detection that keeps the assistant anchored to cooking and gently
  steers off-topic conversations back toward food
- Prompt-injection screening using heuristics with an optional model-backed
  confirmation step
- Profile memory extraction from user messages so stable diet preferences can
  inform future replies
- Session and account-backed chat history persistence with server-side
  truncation and expiry behavior

### Platform and trust features

- Security headers including CSP, frame denial, and restrictive permissions
- Same-origin protection on state-changing routes
- In-memory IP and session rate limiting for request bursts and auth abuse
- Daily chat quota enforcement backed by Supabase
- Redaction-aware logging for selected server warnings
- Custom 404 and 500 pages
- CSS linting task for authored styles in `public/`

## Core Design Decisions

### 1. Single deployable service

The project is structured as one Deno app that serves both the static frontend
and the JSON backend. This keeps deployment simple, reduces coordination
between services, and keeps all server-only secrets in one place.

### 2. Static-first frontend

The browser layer is plain HTML, CSS, and modular JavaScript under `public/`.
There is no frontend bundler or SPA framework in the current architecture. That
keeps page loads predictable and makes the product easy to inspect and deploy.

### 3. Server-owned orchestration

All sensitive orchestration lives on the server:

- model routing
- prompt construction
- request validation
- quota and abuse controls
- Supabase service-role access
- pantry provider integration

The browser is intentionally thin and mostly responsible for rendering UI and
sending requests.

### 4. Deterministic logic around generative output

The assistant is not a raw chat proxy. The server adds deterministic behavior
around the model:

- food-domain detection
- mode classification
- prompt-injection checks
- profile-memory extraction
- history management
- pantry-specific recipe lookup and grounding

This keeps product behavior more stable than a single free-form system prompt.

### 5. Simple persistence model

Persistent state is split by responsibility:

- Supabase Auth stores user identity
- Supabase tables store chat history, saved chats, quotas, profiles, and recipe
  book state
- short-lived anti-abuse state stays in memory inside the Deno process

This is enough for the current app shape while keeping the operational surface
small.

## System Architecture

```text
Browser (HTML/CSS/JS in public/)
        |
        v
Deno HTTP app
  - static asset serving
  - HTML page serving
  - JSON APIs
  - chat orchestration
  - security + rate limiting
        |
        +--> Groq Chat Completions API
        |
        +--> Spoonacular API
        |
        +--> Supabase Auth + PostgREST tables
```

### Frontend

The frontend is organized into:

- `public/*.html` for page shells
- `public/js/pages/` for page-level entrypoints
- `public/js/features/chat/` for chat-specific browser modules
- `public/js/shared/` for shared browser utilities
- `public/css/industrial/` for authored site styling

This split keeps page concerns simple and avoids coupling all browser behavior
into one file.

### Backend

The backend is organized into:

- `src/server/` for request handling, HTTP utilities, security headers, rate
  limits, and template serving
- `src/features/auth/` for authentication, sessions, profile updates, and
  account lifecycle behavior
- `src/features/chat/` for prompts, guardrails, mode detection, quotas,
  history, profile memory, and Groq integration
- `src/features/pantry/` for Spoonacular integration and recipe book storage
- `src/features/savedChats/` for saved chat sanitization and persistence
- `src/shared/` for reusable utilities such as redaction

### External dependencies

- Groq for LLM completions and optional prompt-injection confirmation
- Spoonacular for pantry search and recipe detail data
- Supabase for authentication and persistent application state
- Google Fonts for hosted font assets

## Chat Request Lifecycle

When a user sends a chat message, the current design is:

1. The browser posts JSON to `/chat`.
2. The server ensures the request is a same-origin write and establishes a
   session if needed.
3. The server applies IP and session throttling plus the daily quota rule.
4. The message is checked for prompt-injection patterns.
5. Existing chat history is loaded and updated for the session or signed-in
   user.
6. The server extracts stable profile signals from the new message and merges
   them with stored user preferences when available.
7. The message is classified into a chat mode such as idea generation or recipe
   expansion.
8. Pantry-specific helpers may infer recipe context or retrieve recipe details
   for more grounded replies.
9. The server calls Groq with the system prompt, mode steer, history, and user
   input.
10. The assistant reply is returned and persisted back into history.

This flow is intentionally hybrid: use model output for language generation,
but use product logic for routing, persistence, and constraints.

## Data Model

Current persistent state in Supabase is centered around the following tables:

| Table | Purpose |
| --- | --- |
| `profiles` | Stores dietary requirements, allergies, and dislikes for each user |
| `chat_histories` | Stores active chat history keyed by session or user owner key |
| `chat_quotas` | Stores rolling 24-hour chat timestamps for daily quota checks |
| `saved_chats` | Stores named chat snapshots for signed-in users |
| `pantry_recipes` | Stores normalized pantry recipe data, including Spoonacular-backed and custom recipes |
| `user_recipe_book` | Stores each user's saved recipe book entries |

Design notes:

- Chat history is persisted but treated as working memory, not long-term
  archival state.
- Saved chats are explicit user artifacts and can be exported from the UI.
- Profiles are modeled as structured arrays instead of free-form blobs so they
  can be merged and sanitized predictably.
- Daily quota data is stored separately from burst rate limiting because those
  solve different problems.

## Security and Privacy Model

The current system already includes several important protections.

### Server-side controls

- CSP with explicit `connect-src`, `img-src`, `script-src`, and `frame-ancestors`
- Same-origin enforcement for state-changing endpoints
- Session cookies and auth cookie handling on the server
- Password validation rules for account creation and updates
- Rate limiting on chat traffic and auth attempts
- Daily guest and signed-in chat quotas
- Prompt-injection detection before model invocation
- Sanitization of saved chat titles, histories, and user profile data

### Privacy posture

- Browser code only receives public Supabase config, never service-role keys
- Saved chats and recipe book data are account scoped
- The UI surfaces privacy messaging and cookie consent
- The app is designed to keep critical persistence and secret-handling on the
  server rather than in browser-only flows

## Known Constraints and Tradeoffs

These are current realities of the implementation and should be treated as
intentional limitations until upgraded.

- The app is food-specific by design and intentionally steers away from
  unrelated topics
- `/upload` is currently a stub, so attachments are not a real product feature
  yet
- Pantry discovery depends on Spoonacular and does not use a local recipe index
- Burst rate limiting is in-memory, so it is not shared across multiple app
  instances
- The current architecture is request-response only; there is no streaming chat
  transport
- The frontend is static-first, which keeps complexity low but limits advanced
  client-side interaction patterns

## Future Upgrades

The most sensible next upgrades fall into three buckets.

### Product upgrades

- Full pantry collections, bookmarks, and smart groupings such as weeknight,
  high-protein, or family-meal sets
- Guided meal planning across multiple days rather than single-turn recipe
  suggestions
- Shopping-list generation from chat and recipe book selections
- Richer recipe book organization, search, tagging, and sharing
- Better saved chat organization and search

### AI and personalization upgrades

- Turn the upload stub into real image and attachment understanding for pantry
  photos, receipts, or ingredient labels
- Use explicit tool-calling patterns for pantry search and recipe detail
  retrieval instead of looser orchestration
- Add retrieval over saved recipes, prior chats, and user preferences for more
  consistent personalization
- Add evaluation suites for recipe quality, safety, and prompt-injection
  regression testing
- Expand profile memory so the assistant can distinguish temporary cravings
  from long-term user preferences

### Platform upgrades

- Move transient rate limiting from in-memory maps to a shared durable store
- Add streaming responses for faster perceived chat performance
- Add observability for model latency, quota pressure, and upstream failures
- Support multiple model providers or failover strategies beyond the current
  Groq-first path
- Introduce background jobs for cleanup, notifications, or indexing workflows

## Operational Context

This app is intended to be hosted as a public web product, not kept as a local
developer toy. Operationally, the current design assumes:

- a Deno-hosted web server serving both static pages and JSON routes
- Groq as the primary LLM provider
- Supabase as the identity and persistence layer
- Spoonacular as the pantry and recipe data provider
- canonical-origin and host validation in production
- secure cookie handling and server-owned secrets

Exact deployment and publishing steps are intentionally out of scope for this
README so it can stay focused on product and system design.

## Interface Summary

### Public pages

- `/`
- `/chat.html`
- `/recipes.html`
- `/about.html`
- `/auth.html`
- `/account.html`
- `/forgot-password.html`
- `/reset-password.html`

### JSON endpoints

- `/health`
- `/chat`
- `/chat-models`
- `/me`
- `/me/profile`
- `/auth/register`
- `/auth/login`
- `/auth/logout`
- `/auth/forgot-password`
- `/auth/change-password`
- `/auth/delete-account`
- `/auth/client-config`
- `/saved-chats`
- `/saved-chats/:id`
- `/api/pantry/search`
- `/api/pantry/book`
- `/api/pantry/book/custom`
- `/api/pantry/book/:id`
- `/upload` (stub)

## Project Layout

- `public/` contains the static site, browser modules, and assets
- `src/server/` contains HTTP routing and platform concerns
- `src/features/` contains domain logic grouped by auth, chat, pantry, and
  saved chats
- `src/shared/` contains shared server utilities
- `supabase/` contains SQL needed for app state tables and policies

## Summary

Yummy Tummy AI is currently best described as a focused food assistant with a
simple monolithic architecture, strong enough persistence for personalized use,
and enough guardrails to operate as a public web app. The next stage is not a
full rewrite. It is a series of targeted upgrades: better pantry workflows,
better personalization, real attachment handling, shared rate limiting, and
more observable AI orchestration.
