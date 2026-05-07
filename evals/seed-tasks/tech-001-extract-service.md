# tech-001 — Extract a service from a controller

## Setup

- Stack: kotlin-gradle, opencode, routerai, security-baseline, clean-architecture.
- Pre-existing `UserController.kt` (~250 lines) mixing HTTP concerns with business rules.

## Prompt to paste verbatim

```
/kit-new-feature

Refactor: extract business logic from UserController into UserService. Controller
keeps only request/response shaping. No behaviour change. Existing tests must
pass unchanged.

Module: server.
TECH task — no business requirements doc needed.
```

## Acceptance for the eval

- @Main classifies this as TECH, not FEATURE.
- No new requirements / spec docs created (TECH skips that phase).
- Existing tests pass without modification.
- One TraceabilityChecker dispatch (since public surface of the controller may shift).

## What to watch for

- Whether the agent creates a new spec doc anyway ("just in case") — this is the symptom of artifact bloat we want to avoid.
- Whether the refactor preserves transactional boundaries.
