# Deno Deployment Checklists

Use this file when producing concrete rollout plans.

## Pre-Deploy
- Confirm `deno.json` tasks exist for `dev`, `start`, and quality checks.
- Confirm `deno.lock` is present and committed.
- Confirm dependency imports are pinned and intentional.
- Confirm runtime permissions are least privilege.
- Confirm required environment variables are documented per environment.

## Runtime Security
- Restrict `--allow-net` to required hosts when feasible.
- Restrict filesystem permissions to needed paths only.
- Avoid broad `--allow-env`; enumerate required keys when possible.
- Run service process as non-root in containers/VMs.

## Observability
- Emit structured logs with severity and request context.
- Include deploy metadata (commit SHA/version) in logs or health output.
- Define health endpoint behavior for readiness and liveness.
- Capture upstream failures with clear status mapping and timeouts.

## Rollout
- Deploy to preview/staging first.
- Validate: startup success, health route, critical endpoint checks.
- Run smoke tests with production-like env vars.
- Promote to production with rollback command ready.

## Post-Deploy
- Verify error rate, latency, and memory for initial traffic window.
- Verify background jobs/cron triggers if used.
- Confirm alerts and dashboards are receiving telemetry.
- Record deployment timestamp and release notes.
