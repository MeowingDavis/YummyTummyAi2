# Yummy Tummy AI

Yummy Tummy AI is a Deno web app for food-focused chat. It serves a static
frontend and a backend chat endpoint that calls the Groq Chat Completions API.

## Features

- Ingredient-aware recipe help and cooking Q&A
- Pantry search page backed by Spoonacular (`/recipes.html`)
- Off-topic guard that steers conversation back to food
- Session-based chat history persisted in Supabase
- Saved chats persisted in Supabase
- Optional account auth (register/login/logout) with profile fields
- Basic in-memory rate limiting (IP + session cooldown)
- Security headers and custom 404/500 pages

## Tech Stack

- Deno (TypeScript)
- Static HTML/CSS/JS frontend in `public/`
- Groq API (`/openai/v1/chat/completions`)

## Prerequisites

- Deno installed
- A Groq API key
- Supabase project (Auth enabled)

## Quick Start

1. Export environment variables:

```bash
export GROQ_API_KEY="your_groq_api_key"
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
# required for server-side Supabase data access (saved chats, account deletion)
export SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
export SPOONACULAR_API_KEY="your_spoonacular_api_key"
# optional
export MODEL="llama-3.1-8b-instant"
# optional: models shown in the UI picker (comma-separated)
export GROQ_MODELS="llama-3.1-8b-instant,llama-3.3-70b-versatile"
```

Production security env requirements:

```bash
export NODE_ENV="production"
export SESSION_SECRET="a_long_random_secret_value"
export COOKIE_SECURE="1"
export CANONICAL_ORIGIN="https://your-domain.example"
export ALLOWED_HOSTS="your-domain.example"
# optional if you run behind trusted proxies and use forwarded client IP
export TRUSTED_PROXY_IPS="127.0.0.1"
```

2. Run the app:

```bash
deno task dev
# or
deno task run
```

3. Open:

```text
http://localhost:8000
```

## Available Task

- `deno task run` -> starts the server with:
  - `--allow-net`
  - `--allow-read`
  - `--allow-write`
  - `--allow-env`
- `deno task dev` -> starts the server and loads variables from `.env` via
  `--env-file=.env`

## API Routes

- `GET /health` -> `{ "ok": true }`
- `GET /chat-models` -> allowed model list for UI picker
- `GET /me` -> current session user or `null`
- `POST /auth/register` -> `{ email, password, name? }`
- `POST /auth/login` -> `{ email, password }`
- `POST /auth/forgot-password` -> `{ email }` (always generic success unless
  rate-limited/hard failure)
- `POST /auth/delete-account` -> `{ password }` (requires logged-in session)
- `POST /auth/logout` -> clears the persistent auth cookie
- `GET /auth/client-config` -> browser-safe Supabase config for reset flow
  (`SUPABASE_URL`, anon key only)
- `PATCH /me/profile` -> updates `{ dietaryRequirements, allergies, dislikes }`
- `POST /chat` -> accepts JSON:

```json
{
  "message": "I have eggs and spinach",
  "newChat": false,
  "model": "llama-3.1-8b-instant"
}
```

- `POST /upload` -> currently a stub, returns `[]`
- `GET /api/pantry/search?q=<term>&number=<1..24>` -> pantry recipe search
- `GET /saved-chats` -> account saved chats
- `POST /saved-chats` -> save chat `{ title, history }`
- `GET /saved-chats/:id` -> fetch one saved chat
- `DELETE /saved-chats/:id` -> delete saved chat

## Project Layout

- `main.ts` -> app entrypoint
- `src/server.ts` -> HTTP routing and chat flow
- `src/chat/` -> prompt logic, mode detection, guard, history, Groq client
- `src/security.ts` -> security headers
- `src/rateLimit.ts` -> in-memory token bucket + session cooldown
- `src/chat/history.ts` -> Supabase-backed session and user chat history
- `src/auth.ts` -> Supabase auth + profile management
- `public/` -> static pages and chat UI scripts

## Notes

- `GROQ_API_KEY` is required at startup.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are required for auth flows.
- `SUPABASE_SERVICE_ROLE_KEY` is required for server-side app state access and
  secure account deletion. Never expose this key in browser code.
- If `MODEL` is unset, the app defaults to `llama-3.1-8b-instant`.
- Rate limit state remains in-memory; persistent app state is stored in
  Supabase.
- Run the SQL in `supabase/app_state.sql` and `supabase/saved_chats.sql` before
  using auth-backed chat features.
- The current MVP intentionally keeps recipe generation simple and does not
  store a local recipe database. Pantry search is powered by Spoonacular.

## Supabase Auth Settings

Configure these in Supabase Dashboard -> Authentication:

- Enable email confirmations (signup should not auto-login before confirmation).
- Add password recovery redirect URLs:
  - `http://localhost:8000/reset-password.html`
  - `https://<your-domain>/reset-password.html`
- If you use a different dev/preview port or domain, add that exact
  `/reset-password.html` URL too.
