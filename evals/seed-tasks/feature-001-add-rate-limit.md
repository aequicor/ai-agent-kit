# feature-001 — Add rate limiting to a public endpoint

## Setup

- Stack: kotlin-gradle, opencode, routerai, security-baseline.
- Pre-existing module `server` with one endpoint `POST /api/v1/login`.

## Prompt to paste verbatim

```
/kit-new-feature

We need rate limiting on /api/v1/login: max 5 requests per minute per source IP.
Over the limit returns 429 with Retry-After header. Limit state is in-memory for
now (single instance, sliding window 60 s). Add tests for: under limit, exact
limit, over limit, header present, window reset after 60 s.

Module: server.
No UI changes.
```

## Acceptance for the eval

- DoD PASS without waivers.
- Tests cover all five scenarios listed.
- No more than 8 stages in the plan.
- One Reviewer dispatch flags or clears (no fragmented review across multiple agents).

## What to watch for

- Coverage of the "exact-limit" boundary case (off-by-one on the 5th request).
- Whether the PO had to remind the agent about the Retry-After header (it's in the prompt).
- Whether tests use deterministic clock or real `Thread.sleep`.
