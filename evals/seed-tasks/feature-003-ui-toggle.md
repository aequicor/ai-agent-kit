# feature-003 — Theme toggle (light / dark / system)

## Setup

- Stack: kotlin-gradle, compose-multiplatform, opencode, routerai, security-baseline.
- Pre-existing app with a Settings screen.

## Prompt to paste verbatim

```
/kit-new-feature

Add a theme toggle to Settings: Light / Dark / Follow system. Choice persists
across launches. Existing screens must respond without restart.

Module: client.
UI: yes.
```

## Acceptance for the eval

- DoD PASS without waivers.
- Persistence verified by a test that simulates app restart.
- "Follow system" option respects OS-level dark mode change at runtime.

## What to watch for

- Whether the agent correctly picks Compose's `MaterialTheme` integration vs inventing a custom theme system.
- Whether the spec captures that "responds without restart" excludes splash screen.
