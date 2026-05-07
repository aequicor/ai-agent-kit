# bug-002 — Off-by-one day in timezone-aware date display

## Setup

- Stack: kotlin-gradle, compose-multiplatform, opencode, routerai, security-baseline.
- Pre-existing feature showing event dates from a UTC-stored timestamp.

## Prompt to paste verbatim

```
/kit-fix

Events created at 22:00 local (UTC+3) display as one day earlier in the list.
Expected: list shows the date the user picked when creating the event.
Reproduces when client TZ ≠ UTC.
Priority: medium.
```

## Acceptance for the eval

- Regression test uses fixed TZ + fixed clock (not the host's clock).
- Fix is in the formatter, not in the storage layer.
- Existing tests for events created at noon still pass.

## What to watch for

- Whether the agent first asks where the formatting happens (server response vs client display) before committing to a fix.
- Whether the fix handles the symmetric case (events created at 02:00 UTC+3 → 23:00 UTC the previous day).
