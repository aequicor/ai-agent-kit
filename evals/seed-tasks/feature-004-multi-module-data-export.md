# feature-004 — Multi-module data export pipeline (LONG-HORIZON)

> **Tier:** long-horizon. Expected wall time: 4–12 hours of focused work.
> See [`evals/long-horizon-tier.md`](../long-horizon-tier.md) for what makes a long-horizon task different and which extra metrics to record.

## Setup

- Stack: kotlin-gradle, compose-multiplatform, opencode, routerai, security-baseline, clean-architecture.
- Pre-existing modules: `server` (Ktor + Postgres), `client` (Compose Multiplatform), `shared` (DTOs).
- Pre-existing entities: `User`, `Order`, `Invoice` in `server`.

## Prompt to paste verbatim

```
/kit-new-feature

Add a data export pipeline that lets a user export all their data
(profile, orders, invoices) as a downloadable ZIP. GDPR-style
"download my data" feature.

Server:
- POST /api/v1/exports → creates an export job (returns job_id).
- GET /api/v1/exports/{job_id} → returns status (queued|running|done|failed)
  and a signed download URL when done.
- Job runs async. Bundles JSON of profile + orders + invoices + a CSV
  per entity (3 CSV files) into a ZIP. Stored on local disk for now,
  retention 7 days.
- Idempotency: same user cannot have two pending jobs at once.

Client:
- Settings screen: "Export my data" button.
- After click → poll the job status, show progress (queued → running → done).
- When done → trigger download via the signed URL.
- If job is still running on screen reopen → resume polling.

Cross-cutting:
- Job state in DB (new table `export_jobs`).
- Background worker: pick up queued jobs, run, mark done.
- Cleanup job: delete files older than 7 days, mark job status as expired.

Modules: server, client, shared (new DTO ExportJobStatus).
UI: yes — Settings screen button + progress UI.
```

## Why this is long-horizon

| Property | This task |
|---|---|
| Modules touched | 3 (server + client + shared) |
| New endpoints | 2 |
| New DB tables | 1 (with migration) |
| New cross-cutting concerns | async job worker, retention/cleanup, idempotency |
| Steps in plan | expected 8–12 |
| Cannot be done in one sitting | yes — would take > 4 hours wall, likely needs >1 session resume |
| Replanning expected | yes — at least one Edge Case will surface during EXECUTE that requires plan adjustment |

## Acceptance for the eval

- DoD PASS without waivers.
- All three modules build and lint clean.
- E2E test: client clicks button → server creates job → worker runs → file appears on disk → client downloads.
- Idempotency test: two POST /exports from same user with first still pending → second returns 409 with existing job_id.
- Cleanup test: jobs older than 7 days are deleted (use injected clock).
- DB migration is reversible.
- Plan was split into ≤ 12 steps.
- At least one `/kit-resume` cycle was used (multi-session).

## What to watch for

- **Replanning behaviour.** If `@Main` discovers in step 4 that the file storage interface needs a method nobody planned, does it surface the gap to PO and update `feature.md` § Implementation plan? Or does it silently extend the step?
- **Cross-session continuity.** Stop after step 3, run `/kit-resume` next day. Does `@Main` reconstruct context correctly without re-asking clarifying questions?
- **Module boundary discipline.** With `clean-architecture` profile active, does `@Reviewer` catch any direct DB access from the controller layer?
- **Edge cases at scale.** Did `@Analyst` enumerate: empty user (no orders), giant user (10k orders → ZIP > 100MB), concurrent exports, mid-export user deletion?
- **Long-running test discipline.** Does the test suite use a fake clock and in-memory filesystem? Real disk I/O in tests is a smell.

## Long-horizon-specific metrics to record

In addition to the standard metrics from `evals/metrics.md`, record:

| Metric | Value |
|---|---|
| Sessions used (count of `/kit-resume` cycles) | |
| Replan events (changes to feature.md § Implementation plan after CONFIRM) | |
| Steps actually executed vs steps in original plan | |
| Cross-day continuity OK? (yes/partial/no — did resume preserve full context?) | |
| Edge cases discovered during EXECUTE (not in original feature.md) | |

## Pass threshold for long-horizon eval

A long-horizon task passes the eval if:

- DoD PASS = ✅
- ≤ 2 PO interventions per session
- ≤ 1 escalation (anti-loop or DoD-fix cap exceeded)
- Cross-day continuity OK
- Replan events documented in feature.md (not silent)
