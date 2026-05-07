# feature-002 — CSV export of a list view

## Setup

- Stack: kotlin-gradle, compose-multiplatform, opencode, routerai, security-baseline.
- Pre-existing screen showing a paginated list of records.

## Prompt to paste verbatim

```
/kit-new-feature

Add a "Export CSV" button to the records list screen. Exports the currently
filtered+sorted set, not just the visible page. Columns match what is on screen.
Quoted values, comma delimiter, UTF-8 BOM. File saves to user-picked location.

Module: client.
UI: yes — button in the toolbar.
```

## Acceptance for the eval

- DoD PASS without waivers.
- File-pick path uses platform API (no hard-coded path).
- BOM byte sequence (`EF BB BF`) verified by a test.
- Quoting correct for values containing comma, quote, newline.

## What to watch for

- Designer agent dispatched (this is UI).
- Whether the eval surfaces large-dataset edge case (10k+ rows) without prompting.
