---
name: corner-case-refinement
description: Systematic corner case discovery during business requirements phase. Runs BEFORE spec and design — surfaces domain invariants, boundary conditions, failure modes, and concurrency scenarios at the business planning level. Corner cases found during implementation are a planning failure.
---

# Corner Case Refinement Skill

Business-level corner case analysis. Runs during the requirements phase — after clarifying questions with PO, before spec, design, or implementation plan. The goal is to surface every meaningful "what if" at the business domain level so the spec can address them proactively.

## Invocation Interface

Called by `@Main` via the `requirements-pipeline` skill (Step 2.5) or directly with:

```
Feature: [feature-name, snake_case]
Module: [module name from manifest]
Requirements file: [path to .vault/concepts/[module]/requirements/[feature].md]
```

The skill reads the requirements file, runs the 6-category analysis, and writes the corner case register to:
`.vault/concepts/[module]/plans/[feature]-corner-cases.md`

where `[module]` and `[feature]` are substituted from the input fields above.

**Important:** The `Requirements file` input must point to the **final version** of the requirements — after all BA update iterations are complete. The skill reads whatever is currently in that file; it does not track history.

## When to Use

**Primary trigger — REQUIRED before every FEATURE spec:**
- Immediately after PO answers clarifying questions (Main step 0)
- Before any spec, design document, or implementation plan is written

**Secondary triggers:**
- Bug retrospective identifies systematic gaps in corner case analysis
- A feature delivered with surprise edge cases (process failure — run retro)

**Do NOT activate:**
- During implementation — corner case discovery during coding = planning failure
- As a gate on already-written plans — by then it's too late; start over

## Business Corner Case Taxonomy

These 6 categories are designed for the **business requirements** phase. Each question is framed at the domain level, not the code level.

### 1. Input Integrity Boundaries

For every piece of data entering the system, ask at the business level:

| Business question | Why it matters |
|-------------------|----------------|
| What if the mandatory field is left blank by the user? | Form state, UX flow |
| What if the value is technically in range but nonsensical (e.g. birth date in 2099)? | Data quality |
| What if international characters break formatting assumptions? | Globalization |
| What if the user pastes formatted text where plain text is expected? | Data sanitization |
| What if two input fields contradict each other (e.g. startDate > endDate)? | Business rule enforcement |

### 2. Business Process Integrity

For every business operation, ask:

| Business question | Why it matters |
|-------------------|----------------|
| What if the user submits the same order twice by double-clicking? | Idempotency |
| What if a required prerequisite step was skipped? | Process ordering |
| What if the system crashes between step 2 and step 3 of a 5-step workflow? | Atomicity, recovery |
| What if the user reverses a decision (cancel order, undo approval)? | Reversibility |
| What if the same entity is modified by two users simultaneously? | Conflict resolution |
| What if the entity is in the wrong state for this operation? | State machine enforcement |

### 3. Business Rule Violations & Domain Invariants

For every business rule, ask:

| Business question | Why it matters |
|-------------------|----------------|
| What if the quantity goes negative? | Invariant enforcement |
| What if the balance falls below zero after an operation? | Financial integrity |
| What if a user tries to access another user's private data? | Authorization boundaries |
| What if a parent entity is deleted while children still exist? | Referential integrity |
| What if a unique constraint is violated (duplicate email, duplicate order ID)? | Identity enforcement |
| What if circular references form (manager → manager, folder → parent)? | Data integrity |
| What if a time-limited operation outlives its window? | Temporal constraints |

### 4. External Dependency Failure Modes

For every external system the feature depends on, ask:

| Business question | Why it matters |
|-------------------|----------------|
| What if the payment gateway is down for 30 minutes? | Business continuity |
| What if the external API returns an unexpected response format? | Defensive design |
| What if the rate limit is hit at peak traffic? | Graceful degradation |
| What if the external service responds but with wrong data? | Trust boundaries |
| What if the auth token expires mid-batch operation? | Session continuity |
| What if the third-party library has a breaking change? | Version lock strategy |

### 5. Scale & Capacity Boundaries

For every data flow, ask:

| Business question | Why it matters |
|-------------------|----------------|
| What is the business-expected max? The technical max? The pathological max? | Capacity planning |
| What if the user uploads a 2 GB file where 10 MB was expected? | Resource limits |
| What happens with zero results? One result? | Boundary UX |
| What if the batch size doesn't evenly divide total items? | Off-by-one logic |
| What if 10,000 concurrent users trigger this flow simultaneously? | Concurrency limit |
| Does degradation preserve core business function? | Graceful failure |

### 6. Temporal & Concurrency Scenarios

For every shared resource or time-sensitive operation:

| Business question | Why it matters |
|-------------------|----------------|
| What if two cashiers process the last item in inventory simultaneously? | Inventory integrity |
| What if a scheduled report runs while data is being updated? | Read consistency |
| What if a user's clock is significantly wrong? | Time-based business logic |
| What if the operation completes on the server but the confirmation never reaches the client? | Delivery guarantees |
| What if an operation succeeds in one region but fails in another? | Distributed consistency |

## Discovery Process (Business Phase)

### Step 1: Extract business invariants from PO answers

From the PO's clarifying question answers, extract:
- All "must always be true" statements
- All "must never happen" statements
- All numerical limits mentioned (timeouts, sizes, counts)
- All state transitions described in the user story

### Step 2: Run the 6-category scan

For each category above, list every applicable business question. Answer each one to the best of your knowledge. Flag questions you can't answer — ask PO.

### Step 3: Classify by severity (BUSINESS impact)

| Severity | Definition | Example |
|----------|-----------|---------|
| **Critical** | Data loss, financial loss, security breach, regulatory violation | Double-charging a customer's card |
| **High** | User-visible incorrect result, broken business process | Order status stuck in "processing" forever |
| **Medium** | Degraded experience, workaround exists | Search returns no results when one was expected |
| **Low** | Cosmetic, edge of edge | Off-by-one pixel in a 1-in-10k scenario |

**Calibration rule:** If a corner case wouldn't make a business stakeholder care, it's Low. If they'd call an emergency meeting, it's Critical.

### Step 4: Define expected business behavior

For each corner case, write the **business decision** — not the technical implementation:

- "Return 400" → `BAD` (implementation, not business)
- "Notify user that order cannot be placed because inventory is depleted; offer waitlist" → `GOOD` (business behavior)

### Step 5: Produce the corner case register

Save to `.vault/concepts/<module>/plans/<feature>-corner-cases.md`.

## Output Format

```markdown
## Corner Case Register — [Feature Name]

> **Generated during business requirements phase.**
> Critical and High items are mandatory inputs for spec and implementation plan.

### Critical (data loss, financial loss, security, legal)

| # | Category | Condition | Expected Business Behavior | Spec Addressed |
|---|----------|-----------|---------------------------|----------------|
| 1 | Business Integrity | Double-click submits duplicate order | Detect duplicate + confirm intent with user | ❌ |
| 2 | External Dependency | Payment gateway timeout > 30s | Notify user of delay, hold order in "pending payment" state, automatic retry | ❌ |

### High (user-visible incorrect behavior)

| # | Category | Condition | Expected Business Behavior | Spec Addressed |
|---|----------|-----------|---------------------------|----------------|
| 3 | Invariants | Inventory goes to 0 between add-to-cart and checkout | Reserve inventory at add-to-cart; release on timeout | ❌ |

### Medium (degraded experience, workaround exists)

| # | Category | Condition | Expected Business Behavior | Spec Addressed |
|---|----------|-----------|---------------------------|----------------|

### Low (cosmetic, extreme edge)

| # | Category | Condition | Expected Business Behavior | Spec Addressed |
|---|----------|-----------|---------------------------|----------------|
```

## Handoff to Spec & Plan

The corner case register IS the handoff contract:

1. **Spec MUST reference every Critical and High item.** If a Critical corner case has no corresponding section in the spec, the spec is incomplete — reject.
2. **Plan MUST include a test task for every Critical item.** No exceptions. High items get explicit decisions (test now or defer to backlog) — but decisions are documented.
3. **Medium and Low** items are listed for awareness; PO may promote them.

This is the only integration point. Writing-plans reads the register as input. Implementation never discovers corner cases — it only implements what was discovered in planning.

## Principles

- **Business phase, not spec phase.** This runs BEFORE the spec exists. Corner cases feed INTO the spec.
- **Domain language, not code.** "Reserve inventory atomically" → `BAD`. "Prevent oversell when multiple customers check out simultaneously" → `GOOD`.
- **Decisions, not details.** Expected business behavior is what the business decides, not how the code implements it.
- **Severity = stakeholder impact.** Not technical difficulty. Not implementation complexity.
- **No spec without corners.** A spec written without a corner case register is speculation written without due diligence.
- **YAGNI for corners.** Don't plan for scale-5 problems on a scale-1 system. But DO document the assumed scale.

## Error Handling

| Situation | Action |
|-----------|--------|
| Requirements file does not exist or is empty | STOP. Report: `Requirements file not found at [path] — BA must produce it first.` |
| 6-category scan produces zero corner cases | WARNING. Write register with 0 rows + a note explaining why: `No corner cases identified because [reason]. PO review recommended — every feature accepting input has at least input boundary corner cases.` |
| Cannot answer a category question | Flag it in the register row as `NEEDS_PO_DECISION`. Do not silently skip — PO must confirm or provide the answer. |
| Register file cannot be written (path invalid) | Fallback to `.vault/concepts/[module]/plans/[feature]-corner-cases.md`. If that also fails, STOP and report the path error. |
| Previous corner case register exists for same feature | Overwrite only if PO confirmed rejection of previous version. Otherwise, append new findings with a `## Supplement — [date]` section. |

## Red Flags

- **Corner case register produced after spec is written** — Process failure. Spec was written blind.
- **"This feature has no corner cases"** — Every feature that accepts input has corner cases. Minimum: run input boundaries.
- **All items Medium or Low** — Calibration failure. At least one Critical or High exists for any non-trivial feature.
- **Technical implementation in Expected Behavior column** — Domain language only. Implementation decisions live in the plan, not the register.
- **Register not referenced by spec** — The register is the spec's source of truth for edge conditions. If the spec doesn't cite it, the analysis was wasted.

## Self-Review (before handing to spec)

1. **Language check:** Are all Expected Behaviors in business/domain terms? No `return 400`, no `throw exception`, no `use mutex`?
2. **Severity calibration:** If a stakeholder wouldn't call a meeting about it, is it really Critical?
3. **Coverage:** Did you skip a category? If yes, write why in a note at the bottom.
4. **Answerability:** Could you answer every question? Flag unanswered ones for PO.
5. **No vagueness:** "Handle edge cases" → reject. "When payment fails, hold order for 24 hours, notify user via email, auto-cancel if not resolved" → accept.
