# tech-002 — Extract shared domain module (LONG-HORIZON)

> **Tier:** long-horizon. Expected wall time: 6–16 hours.
> See [`evals/long-horizon-tier.md`](../long-horizon-tier.md).

## Setup

- Stack: kotlin-gradle, compose-multiplatform, opencode, routerai, security-baseline, clean-architecture.
- Pre-existing modules: `server` (Ktor) and `client` (Compose). Both currently duplicate domain entities (`User`, `Order`, `Money`) and validation rules.
- Build dependency graph: `client` does not depend on `server`; both depend on `:platform-stdlib`.

## Prompt to paste verbatim

```
/kit-new-feature

Tech task. Extract shared domain logic into a new :shared module so
server and client stop duplicating it.

In scope:
- Entity classes: User, Order, Money, OrderStatus enum.
- Validation rules: email format, money positive, order item count > 0.
- Currency conversion helpers (already exist, duplicated in both modules).

Out of scope:
- Persistence (server-side only, stays in :server).
- UI components (client-side only, stays in :client).
- Network DTOs (already in :shared, untouched).

Constraint: NO behaviour change. Existing tests in :server and :client
must pass without modification.

The :shared module is multiplatform (commonMain). It can use kotlinx.datetime
and kotlinx.serialization but NOT kotlinx.coroutines (yet — that decision
is deferred).

Modules: server, client, shared. TECH task — no business requirements doc needed.
```

## Why this is long-horizon

| Property | This task |
|---|---|
| Files touched | 30+ across two modules |
| Risk of behaviour change | very high — touches core domain model |
| Existing tests must keep passing | yes, unmodified |
| Sessions needed | 2–3 (per-entity migration is sequential) |
| Reversibility | poor — once entities move, callers in both modules must update; partial state breaks build |

## Acceptance for the eval

- `@Main` classifies as TECH, not FEATURE.
- No new requirements / spec docs created.
- Existing tests pass without modification (verify with `git diff tests/`).
- The :shared module compiles for all KMP targets.
- One `@TraceabilityChecker` dispatch confirms no orphans in either module.
- Plan was split into per-entity migration steps (not "do it all at once").
- At least one `/kit-resume` cycle.

## What to watch for

- **Step ordering discipline.** Does the plan migrate one entity at a time (Money first → Order → User), or does it try to migrate all at once and break the build mid-stream?
- **Build cascade.** Each step ends with full build green for both modules. If `:server` compiles but `:client` doesn't after a step, the step is incomplete.
- **Visibility leaks.** `clean-architecture` profile should catch any `internal` accidentally exposed when moving across modules.
- **Test files**: stay in their original module; only the SUT moves. Tests now import from `:shared`. `@Reviewer` Pass A1 should verify imports.
- **Multiplatform constraints.** Did the agent attempt to use a JVM-only library in commonMain? `@Reviewer` Pass A5 should catch.

## Long-horizon-specific metrics to record

| Metric | Value |
|---|---|
| Sessions used | |
| Replan events | |
| Steps in plan vs steps executed | |
| Build-green checkpoints per step (must be 100%) | |
| Cross-day continuity OK? | |
| Tests modified (must be 0 — this is acceptance) | |

## Pass threshold

- DoD PASS without waivers.
- Tests modified = 0.
- Each step ended with both `:server` and `:client` building green.
- ≤ 1 escalation event.
- No silent replanning (any deviation from original plan is documented in feature.md).
