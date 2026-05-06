# Reconfigure an installed ai-agent-kit

You are reconfiguring an already-installed ai-agent-kit. The Project Owner (PO)
describes what they want changed in **plain language** (any language — English,
Russian, etc.). You translate that intent into precise edits to the project's
manifest YAML, then re-render the kit-managed files affected by those edits.

This prompt is fetched and followed by the `/kit-config` command. The PO's
free-form request is in the constant `PO_REQUEST`. If empty, you run an
interactive picker (PHASE 0).

**You do not change `kit_version`.** This prompt does not upgrade the kit.
For version upgrades use `/kit-update`. For adding profiles use `/kit-extend`.

---

## PHASE 0 — Locate manifest and parse intent

1. Find the project manifest: a single `*.yaml` at the project root containing
   a `kit_version:` key (the canonical install marker). If multiple candidates,
   ask PO which one.
2. Read the manifest in full and the schema `kit/manifest.schema.json` from the
   kit repo (raw URL: `https://raw.githubusercontent.com/{{KIT_REPO}}/master/kit/manifest.schema.json`).
3. Read `PO_REQUEST`:
   - If empty → enter **interactive mode**: list the top-level manifest sections
     (LANGUAGE, PROJECT, VAULT, MODULES, PROVIDER, MODELS, CLAUDE_CODE, MCP,
     LSP, UI, CODE_QUALITY, FORMATTER) and ask PO which area they want to
     change. After PO names an area, ask one open question describing current
     values; treat the answer as the new `PO_REQUEST` and continue from PHASE 1.
   - If non-empty → continue to PHASE 1.

Set RECONFIGURE_LOG = `[]` (you will append every applied change here for the
final summary).

---

## PHASE 1 — Translate intent to field-level diff

For each thing PO wants changed:

1. Identify the manifest field path. Examples:
   - "переключи reviewer на claude-opus-4-7" → `models.reviewer = "claude-opus-4-7"` (if `opencode` ∈ hosts) or `claude_code.models.reviewer = "claude-opus-4-7"` (if `claude-code` ∈ hosts). If both — ask which host.
   - "выключи serena" → `mcp.serena.enabled = false`.
   - "сделай язык русским" → `language_code = "ru"`.
   - "поменяй провайдера на ollama-cloud, ключ в OLLAMA_KEY" →
     `provider.name = "ollama-cloud"`, `provider.api_key_env = "OLLAMA_KEY"`,
     `provider.base_url` per the ollama-cloud profile defaults.
   - "добавь запрещённый паттерн: только val, не var" →
     append `"var declarations (use val for immutability)"` to
     `code_quality.forbidden_patterns`.
   - "удали designer" → `models.designer = null` (omits @Designer agent).
   - "переименуй модуль server в backend" → `modules[].name`, `gradle_module`,
     `source_root`, `test_root`, `docs_path` — HIGH blast radius, see PHASE 3.
2. If the request is ambiguous (multi-host with role change, "выключи MCP"
   without naming which one, "поменяй модель" without naming role), ask PO
   **one** clarifying question, then proceed.
3. **Refuse and redirect** for these targets:
   - `kit_version` → "Use `/kit-update` to change kit version."
   - `hosts` → "Use `/kit-extend` with the host profile, or reinstall."
   - `stack.profiles[]` → "Use `/kit-extend` to add profiles."
   - `stack.external_profiles` → "Managed by `/kit-extend` automatically."
4. Build PROPOSED_CHANGES as a list:
   ```
   - path: <yaml dotted path>
     old: <current value>
     new: <proposed value>
     blast_radius: LOW | MEDIUM | HIGH
   ```

---

## PHASE 2 — Validate proposed changes against the schema

For each entry in PROPOSED_CHANGES:

1. Apply the change to an in-memory copy of the manifest.
2. Validate the modified manifest against `kit/manifest.schema.json`.
3. If validation fails → STOP and tell PO which field violated which rule, ask
   for correction.
4. Run security scan on every changed `*api_key_env` field: if the value matches
   `sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`, or 32+ chars high-entropy →
   STOP and warn PO. The field stores the env-var **name**, never the literal
   key.

---

## PHASE 3 — Classify blast radius and pick the re-render set

Tag each change LOW / MEDIUM / HIGH and compute the union of files that need
re-rendering. Use the same field → file mapping as `docs/prompts/setup.md`
PHASE 4 (rendering) — that prompt is the ground truth; do not duplicate the
mapping here.

| Blast | Examples | Files re-rendered |
|-------|----------|-------------------|
| LOW   | `mcp.<name>.enabled`, `models.<role>`, `claude_code.models.<role>`, `formatter.*`, `lsp.*`, append to `code_quality.forbidden_patterns` | host config (`opencode.json` / `.claude/settings.json`), `.mcp.json`, affected agent wrappers (frontmatter `model:`), `_shared.md` (forbidden patterns) |
| MEDIUM | `provider.*`, `language_code`, `mcp.<name>.api_key_env`, `ui.framework` | host config files, host instruction file (`AGENTS.md` / `CLAUDE.md`), `_shared.md`, optional `Designer` wrapper toggle |
| HIGH  | `project.name`, `vault_path`, `modules[]` add/remove/rename | every kit-managed file (placeholders are pervasive); HIGH changes also affect runtime state — see warnings below |

For HIGH blast changes you MUST surface these warnings to PO before applying:
- **`vault_path` rename** — the kit only re-renders templates with the new
  path. Existing PO-authored content at the OLD path stays put. Tell PO they
  must `git mv <old_vault_path>/ <new_vault_path>/` themselves.
- **`modules[]` rename or remove** — `.planning/CURRENT.md`, `.planning/tasks/*.md`,
  and existing vault content under the old module name will NOT be moved.
  Tell PO to migrate planning state and vault content manually.
- **`project.name` change** — affects only display strings in the rendered docs;
  no runtime consequences, but every host file is rewritten.

---

## PHASE 4 — Show diff and get PO confirmation

Print:

1. **Manifest diff** — unified diff (- old / + new) of the manifest YAML.
2. **Files to re-render** — the union from PHASE 3, grouped by blast radius.
3. **Warnings** — every HIGH-blast warning from PHASE 3.
4. **What stays untouched** — the merge-mode skip-list (same as `/kit-update`):
   `{{vault_path}}/concepts/**`, `{{vault_path}}/reference/**`, `{{vault_path}}/how-to/**`,
   `{{vault_path}}/guidelines/**`, `{{vault_path}}/tech-debt/**`,
   `.planning/CURRENT.md`, `.planning/tasks/*.md`, `.planning/tasks/done/*.md`,
   `.planning/HISTORY.md`, `.planning/DECISIONS.md`, `.planning/bugs/*.md`,
   `AUTO_MEMORY.md` if it has user content. The `vault_path` placeholder uses
   the **new** value if `vault_path` itself is being changed.

Then:

```
Apply these changes? Reply /kit-approve to proceed, or describe what should
change in the proposal.
```

Wait for `/kit-approve`. On any other reply, treat it as a refinement request
and loop back to PHASE 1 with the updated intent.

If PO has set `AUTO_APPROVE=true` for the session, dispatch `@AutoApprover`
with the proposal package instead of asking the human; on `✅ APPROVED`
proceed, on `❌ NEEDS_CHANGES` resolve BLOCKERs (max 2 retries) then escalate
to PO.

---

## PHASE 5 — Apply

1. Write the modified manifest YAML (preserve comments where the YAML library
   supports it; if not possible, preserve the section-header comments
   `# ─────...` by reading them from the old file and re-applying).
2. Re-render each file in the PHASE 3 set using the same logic as
   `docs/prompts/setup.md` PHASE 4. For each rendered file:
   - Resolve `{{INCLUDE: <path>}}` directives.
   - Substitute every `{{VAR}}` placeholder using values from the **new**
     manifest.
   - Reject the write if any `{{...}}` remains unresolved.
3. For agent wrappers (`.opencode/agents/*.md`, `.claude/agents/*.md`), only
   re-render those whose frontmatter references a changed field (typically
   `model:` per role). Do not touch wrappers that don't change.
4. Append every file path to RECONFIGURE_LOG with the change summary.

---

## PHASE 6 — Validate the result

1. Re-validate the manifest against `manifest.schema.json` (must PASS).
2. For every host listed in `hosts:`:
   - The host config file (`opencode.json` / `.claude/settings.json`) is valid
     JSON.
   - No literal API keys anywhere in the host config.
   - No unresolved `{{...}}` placeholders in any re-rendered file.
3. If any check fails → STOP, surface the failure to PO with the path of the
   offending file. Do NOT auto-rollback the manifest; PO inspects and decides.

---

## PHASE 7 — Summary

Print:

```
## /kit-config — applied

**Manifest changes:**
| Path | Old | New |
|------|-----|-----|
| <field> | <old> | <new> |
...

**Files re-rendered:** N
- <list>

**Action required from PO:**
- If `provider.api_key_env` changed: ensure the new env var is set in your shell
  (`export <NEW_NAME>=...`).
- If `vault_path` changed: `git mv <old>/ <new>/`.
- If `modules[]` changed: migrate planning state and vault content for the
  affected modules manually.

**Next steps:**
- `git diff` to review.
- `git commit` once you're satisfied.
```

---

## Safety rules (enforced inside this prompt)

- **Never modify files outside the project root.**
- **Never touch `{{vault_path}}/concepts/**`, `{{vault_path}}/reference/**`,
  `{{vault_path}}/how-to/**`, `{{vault_path}}/guidelines/**`,
  `{{vault_path}}/tech-debt/**`** — PO content.
- **Never touch `.planning/CURRENT.md`, `.planning/tasks/*.md`,
  `.planning/tasks/done/*.md`, `.planning/HISTORY.md`, `.planning/DECISIONS.md`,
  `.planning/bugs/*.md`** — runtime state.
- **Never change `kit_version`** — that is the exclusive job of `/kit-update`.
- **Never change `hosts` or `stack.profiles[]`** — that is the exclusive job
  of `/kit-extend` (or reinstall via `setup.md`).
- **Never write a literal API key** to the manifest or any rendered file.
  Reject any `*api_key_env` value that matches a literal-key heuristic.
- **Never auto-rollback.** If PHASE 6 validation fails, surface the failure
  with file paths and let PO decide.
- **Always show a diff before writing.** The PO must see what's about to
  change before `/kit-approve`.
- **One ambiguity question max.** If PO's request is ambiguous, ask one
  clarifying question, then proceed. Do not interrogate.
