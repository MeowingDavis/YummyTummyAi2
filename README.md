# Yummy Tummy AI

Yummy Tummy AI is a Deno web app for food-focused chat. It serves a static frontend and a backend chat endpoint that calls the Groq Chat Completions API.

## Features

- Ingredient-aware recipe help and cooking Q&A
- Local recipe RAG context (retrieves matching recipes from `data/recipes.json`)
- Off-topic guard that steers conversation back to food
- Session-based chat history on the server
- Local-only saved chats in the browser (after privacy acknowledgment)
- Basic in-memory rate limiting (IP + session cooldown)
- Security headers and custom 404/500 pages

## Tech Stack

- Deno (TypeScript)
- Static HTML/CSS/JS frontend in `public/`
- Groq API (`/openai/v1/chat/completions`)

## Prerequisites

- Deno installed
- A Groq API key

## Quick Start

1. Export environment variables:

```bash
export GROQ_API_KEY="your_groq_api_key"
# optional
export MODEL="llama-3.1-8b-instant"
# optional: models shown in the UI picker (comma-separated)
export GROQ_MODELS="llama-3.1-8b-instant,llama-3.3-70b-versatile"
# optional recipe corpus location
export RECIPES_DB_PATH="data/recipes.json"
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
  - `--allow-env`
- `deno task dev` -> starts the server and loads variables from `.env` via `--env-file=.env`
- `deno task ingest-recipes <path>` -> merges recipes into `data/recipes.json` (or `RECIPES_DB_PATH`) with:
  - `--allow-read`
  - `--allow-write`
  - `--allow-env`

## API Routes

- `GET /health` -> `{ "ok": true }`
- `POST /chat` -> accepts JSON:

```json
{ "message": "I have eggs and spinach", "newChat": false }
```

- `POST /upload` -> currently a stub, returns `[]`

## Project Layout

- `main.ts` -> app entrypoint
- `src/server.ts` -> HTTP routing and chat flow
- `src/chat/` -> prompt logic, mode detection, guard, history, Groq client
- `src/security.ts` -> security headers
- `src/rateLimit.ts` -> in-memory token bucket + session cooldown
- `public/` -> static pages and chat UI scripts

## Notes

- `GROQ_API_KEY` is required at startup.
- If `MODEL` is unset, the app defaults to `llama-3.1-8b-instant`.
- Rate limit state and chat history are in-memory and reset when the process restarts.
- If RAG finds strong recipe matches, the assistant uses those titles/details.
- If no strong RAG match exists, the assistant still generates a fresh recipe.

## Recipe RAG: Adding New Recipes

Recipe storage is a local JSON database:

- Default: `data/recipes.json`
- Override with `RECIPES_DB_PATH`

### Supported import formats

- `.json` as either:
  - an array of recipe objects, or
  - an object with `recipes: []`
- `.jsonl` with one recipe object per line

Each recipe object should include:

```json
{
  "id": "optional-unique-id",
  "title": "Crispy Chicken Tacos",
  "ingredients": ["1 lb chicken thighs", "8 tortillas", "1 lime"],
  "instructions": ["Season chicken", "Cook in skillet", "Assemble tacos"],
  "tags": ["tacos", "weeknight"],
  "cuisine": "Mexican-inspired",
  "source": "https://example.com/recipe"
}
```

### Add recipes to RAG

```bash
deno task ingest-recipes ./my_new_recipes.json
```

The script merges by `id` (or title fallback), updates duplicates, and rewrites the DB file.
