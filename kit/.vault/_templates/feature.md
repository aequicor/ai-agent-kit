---
genre: feature
title: Feature Doc Template (single-file design)
topic: feature
triggers:
  - "feature doc"
  - "feature design"
  - "spec"
  - "requirements"
confidence: high
source: human
updated: {{ISO_TIMESTAMP_PLACEHOLDER}}
---

# <Feature title — plain English, no jargon>

> Status: DRAFT | APPROVED | DONE
> Module: <module>
> Owner: <PO>

## Why

2–3 sentences. The user-visible problem this solves. Plain language.
Skip if the feature is TECH (refactor / dependency update / no behaviour change).

## Acceptance Criteria

| ID | Given | When | Then |
|----|-------|------|------|
| AC-1 | <preconditions> | <action> | <observable outcome> |
| AC-2 | ... | ... | ... |

Skip if TECH.

## Edge Cases

| ID | Severity | Scenario | Expected behaviour |
|----|----------|----------|---------------------|
| EC-1 | Critical | <scenario> | <expected> |
| EC-2 | High | ... | ... |
| EC-3 | Medium | ... | ... |

**Severity ladder:**

- **Critical** — data loss, security hole, or system crash if mishandled.
- **High** — wrong result silently, or recovery requires manual intervention.
- **Medium** — visible but recoverable bug.
- **Low** — cosmetic.

Every Critical EC must have at least one PASS TC in the Test plan section.

## How it works

Technical specification: data models, API contracts, internal interfaces, error handling, security considerations. Sub-section as needed.

Reference public signatures (one line each, no method bodies). For example:

```
fun createOrder(req: CreateOrderRequest): Result<Order, OrderError>
class OrderRepository(private val db: Database) { fun save(o: Order): Long }
```

Endpoints (if any):

```
POST /api/v1/orders   → createOrderHandler
GET  /api/v1/orders/:id → getOrderHandler
```

## Test plan

| TC ID | Type | Description | Verifies |
|-------|------|-------------|----------|
| TC-1 | unit | <what + how> | AC-1, EC-1 |
| TC-2 | integration | ... | AC-2 |
| TC-3 | unit | ... | EC-1 |

**Type values:** `unit` | `integration` | `e2e` | `manual`.
**Verifies** lists AC/EC ids covered by this TC. Every Critical EC must appear at least once.

## Implementation plan

Filled by `@Main` via `superpowers:writing-plans` after Test plan is approved. Each step is a contract:

```
- [ ] Step 1: <goal>
      Owned ACs/ECs/TCs: AC-1, EC-1, TC-1, TC-3
      Files: src/orders/Service.kt, src/orders/Repository.kt
      Public signatures:
        - fun saveOrder(o: Order): Long
      Guidelines: [[guidelines/<module>/transactions]]

- [ ] Step 2: <goal>
      ...
```

Steps live as sections inside this file, not as separate stage-NN.md files.

## UI / UX

(Filled by `@Designer` for UI features only. Otherwise omit this section.)

## Open questions

(Delete this section before APPROVED. Items here block CONFIRM.)

## Definition of Done

(Filled by `@DoDGate` at CLOSE. Left empty until then.)
