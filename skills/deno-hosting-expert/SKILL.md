---
name: deno-hosting-expert
description: Expert guidance for deploying, hosting, and operating Deno applications with production best practices. Use when tasks involve Deno Deploy setup, server hosting, containerizing Deno services, configuring deno.json tasks/permissions, environment variable handling, CI/CD for Deno, performance tuning, observability, security hardening, or debugging deployment/runtime issues in Deno apps.
---

# Deno Hosting Expert

Audit the current Deno project, choose a hosting target, apply least-privilege runtime settings, and verify production readiness with repeatable deployment steps.

## Workflow

1. Inspect runtime and project shape
- Read `deno.json`/`deno.jsonc`, entrypoints, import style, task definitions, lockfile usage, and `.env` patterns.
- Identify app mode: HTTP API, worker-style function, static + API, cron/background job, or websocket service.

2. Select hosting model
- Prefer Deno Deploy for edge/serverless Deno-first workloads.
- Prefer container/VM targets when native binaries, private networking, or strict infra controls are required.
- State why the selected model fits latency, scale, cost, and operational constraints.

3. Enforce Deno runtime best practices
- Pin and maintain dependencies (`deno.lock`, stable imports, avoid ad-hoc URL drift).
- Use least privilege flags for runtime and tasks (`--allow-net` scoped hosts, minimal `--allow-read/--allow-write`, explicit env access).
- Keep secrets in environment variables; never hardcode credentials.
- Separate dev and prod tasks in `deno.json`.

4. Prepare deployment pipeline
- Add deterministic build/test/lint checks before deploy.
- Ensure startup command and health endpoint are explicit.
- Define rollback strategy and safe config migration steps when schema changes exist.

5. Validate production readiness
- Confirm logging, error handling, rate limiting, and timeouts.
- Confirm resource limits and memory behavior under expected concurrency.
- Confirm observability hooks and incident response basics.

## Hosting Patterns

### Deno Deploy
- Use project-level environment secrets and region-aware deployments.
- Keep handlers stateless; use durable storage/services externally when needed.
- Validate edge constraints (CPU time, external service latency, and request size assumptions).

### Container or VM Hosting
- Use a minimal Deno runtime image and run as non-root user.
- Start with explicit permission flags and read-only filesystem where possible.
- Expose a health route and configure readiness/liveness probes.
- Keep startup deterministic: `deno task start` or explicit `deno run ...`.

## CI/CD Expectations
- Run `deno fmt --check`, `deno lint`, and project tests before deployment.
- Cache dependencies and lockfile for reproducibility.
- Fail fast on permission changes that broaden runtime access.
- Surface deployment metadata (commit SHA, environment, timestamp).

## Output Requirements
- Provide concrete commands and exact files to change.
- Include a short risk section for security and operational tradeoffs.
- Include a verification checklist and rollback note for each deployment plan.
- Prefer minimal, reversible changes over broad refactors.

## References
- For deployment and production checklists, read [references/deployment-checklists.md](references/deployment-checklists.md).
