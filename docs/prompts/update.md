# ai-agent-kit — update prompt (no clone, no scripts)

You are an AI agent upgrading an installed ai-agent-kit. Your only job is to follow this script exactly. Do not skip steps. Do not run any external scripts.

> **No Python, no JDK, no curl-jar.** You fetch files yourself, render `{{VAR}}` yourself, write files yourself.

---

## Constants

- `KIT_REPO` = the GitHub `<user>/<repo>` slug from which this kit is hosted. Read it from the URL of the prompt you fetched.
- `RAW_BASE` = `https://raw.githubusercontent.com/{KIT_REPO}/master`

---

## PHASE 0 — Detect current version

1. Find the manifest file in the project root (`*.yaml` or `*.yml`). Read it.
   - Multiple manifests → ask PO which one. (Manifests typically have a `kit_version` field at the top.)
   - None found → STOP. Tell PO: "No manifest found. This project doesn't appear to be applied via ai-agent-kit."

2. Extract `kit_version` from the manifest. This is `CURRENT_VERSION`.

3. If no `kit_version` field exists:
   - Search all `*.yaml` / `*.yml` files in the project root for a `kit_version:` line.
   - If still absent → assume `1.0.0`. Tell PO: "No `kit_version` found — assuming 1.0.0. Continue? (yes/no)". Stop on no.

---

## PHASE 1 — Fetch changelog

4. Fetch `RAW_BASE/docs/migration/changelog.yaml`. Parse as YAML.
5. The structure is:
   ```yaml
   versions:
     - version: "1.1.0"
       released: "..."
       breaking: false
       description: "..."
       files_changed: [list of paths under target dir]
       manifest_changes:
         added_fields:
           - path: "stack.formatter_v2"
             default: <yaml value>
             description: "..."
         profile_transforms:                # optional, processed in order
           - rename:
               from: kotlin-multiplatform
               to: [kotlin-gradle, compose-multiplatform]   # 1→N split allowed
           - ensure: [security-baseline]    # add to stack.profiles[] if missing
           - ensure_axis:                   # add a default profile if no profile of the axis is present
               axis: provider
               default: routerai
     - version: "1.0.0"
       ...
   ```
   `versions[0]` is always the latest.

6. If `CURRENT_VERSION == versions[0].version` → "Already up to date." STOP.

7. Build `MIGRATION_PATH`: all entries in `versions[]` whose version is **strictly greater** than `CURRENT_VERSION` and **less than or equal to** `versions[0].version`. Sort oldest-first (chronological).

If fetch fails on both raw and `https://github.com/{KIT_REPO}/blob/master/docs/migration/changelog.yaml` → STOP. "Cannot reach changelog. Check internet connection or `KIT_REPO` value."

---

## PHASE 2 — Show migration plan

8. Compose and present:

   ```
   ## ai-agent-kit Update Plan

   **Project:**         <manifest.project.name>
   **Current version:** <CURRENT_VERSION>
   **Target version:**  <versions[0].version>
   **Migration path:**  <list of versions in order, e.g. 1.0.0 → 1.1.0 → 1.2.0>

   ### Breaking Changes
   <For each entry in MIGRATION_PATH where breaking == true: list version + description.>
   <If none: write "None.">

   ### New Manifest Fields
   <For each entry in MIGRATION_PATH, list each manifest_changes.added_fields[*]:
    - path, default, description.
    Include version tag for each.>

   ### Profile Transforms
   <For each entry in MIGRATION_PATH, list each manifest_changes.profile_transforms[*]:
    - rename:      "<from> → <to1>, <to2>"
    - ensure:      "<list>"
    - ensure_axis: "<axis> ← <default> (only if no profile of that axis is currently selected)"
    If none across the migration path: write "None.">

   ### Files That Will Be Overwritten
   <Union of files_changed across all MIGRATION_PATH entries. List relative paths.
    These files will be REWRITTEN — local customizations will be lost unless committed.
    PO-managed content in <vault_path>/ (anything outside <vault_path>/_templates/ and <vault_path>/_INDEX.md,
    where vault_path = manifest.vault_path, default "vault"), .planning/CURRENT.md, .planning/tasks/, and .planning/HISTORY.md will NOT be touched.>
   ```

9. Ask PO: "Proceed with update? (yes / no)". Stop on no.

---

## PHASE 3 — Re-apply with merge

This is the same render-and-write flow as `setup.md` PHASE 3, but with **merge mode**: kit-managed files are overwritten, PO-managed files are preserved.

### 3.1. Build the rendering context

Compute the same `{{VAR}}` table as documented in `setup.md` PHASE 3.1, using values from the existing manifest (do not ask PO again — assume the manifest is the source of truth for project values).

Add `KIT_REPO` (from constants above) so `commands/kit-update.md` renders correctly.

### 3.2. Discover all kit files

Fetch `RAW_BASE/kit/_index.txt`.

### 3.3. Filter

Same as setup.md 3.3: drop other-editor files based on `manifest.editors`.

### 3.4. Compute target paths

Same as setup.md 3.4 — including the vault path substitution: if a path starts with `.vault/` after stripping `kit/`, replace `.vault/` with `{manifest.vault_path}/` (default `vault/`). Then drop `editors/<editor>/` prefix, drop `.template` suffix, apply path-escape guard.

### 3.5. Render and write — merge mode

For each kit file:

1. Fetch raw content from `RAW_BASE/<kit-path>`.
2. Substitute `{{VARNAME}}` patterns from context. Apply to ALL files (`.template` suffix only affects the output filename).
3. Compute target path.
4. **Determine if the file is kit-managed:**
   - Kit-managed (overwrite freely): everything that comes from the kit — i.e. EVERY file you process here is kit-managed by definition.
5. **Skip these target paths even if they appear in the index** (PO-managed runtime state):
   - `<target>/.planning/CURRENT.md`
   - `<target>/.planning/HISTORY.md`
   - `<target>/.planning/tasks/*.md` and `<target>/.planning/tasks/done/*.md` — active and archived task state files, never overwrite.
   - Any content under `<target>/<vault_path>/concepts/**`, `<target>/<vault_path>/reference/**`, `<target>/<vault_path>/how-to/**`, `<target>/<vault_path>/tutorials/**`, `<target>/<vault_path>/guidelines/**` created by PO/agents (where `vault_path = manifest.vault_path`, default `vault`) — but the **templates** under `<target>/<vault_path>/_templates/` and `<target>/<vault_path>/_INDEX.md` ARE kit-managed and DO get overwritten.
   - Any file the manifest explicitly marks as `merge_skip` (future extension; ignore for now).
6. Write the file. Create parent dirs as needed.

### 3.6. Render nested AGENTS.md per module — merge mode

Same algorithm as setup.md 3.6, but **overwrite existing nested AGENTS.md files**.

### 3.7. Vault scaffold — only fill missing dirs

Re-run the directory scaffold from setup.md 3.7. Skip any directory that already exists. (The vault tree may have grown — only top up missing genres/subdirs.)

---

## PHASE 4 — Update manifest

10. Set `manifest.kit_version` to `versions[0].version`.

11. For each version in `MIGRATION_PATH`, for each `manifest_changes.added_fields[*]`:
    - If `path` (e.g. `formatter.environment`) is NOT present in the current manifest → add it with the documented `default`. Append a comment `# NEW in v<version>: <description>` on the same line (or directly above for multi-line values).
    - If already present → leave PO's value alone.

11b. **Apply profile transforms** — for each version in `MIGRATION_PATH`, for each entry in `manifest_changes.profile_transforms` (in declared order):

   Operate on `manifest.stack.profiles` (a list of profile name strings). Treat the list as ordered but deduplicated; preserve order on insert.

   **First, build a name→axis map** by fetching `https://api.github.com/repos/{KIT_REPO}/git/trees/master?recursive=1` and filtering paths matching `^profiles/(language|framework|provider|capability)/([^/]+)\.yaml$` (axis = group 1, name = group 2). One call resolves every profile's axis without parsing YAML.

   Then apply each transform:

   - `rename: {from: <X>, to: [<Y1>, <Y2>, ...]}` — find the first occurrence of `<X>` in the list and replace it in place with `<Y1>, <Y2>, ...`. If `<X>` is not in the list → no-op. After substitution, dedupe while preserving order. Log: `"profile rename: <X> → <Y1>, <Y2>"`.
   - `ensure: [<P1>, <P2>, ...]` — for each `<Pn>`, if it is not already in the list, append it. Log: `"profile added: <Pn>"`.
   - `ensure_axis: {axis: <A>, default: <P>}` — using the name→axis map, check whether any profile currently in the list belongs to axis `<A>`. If none → append `<P>`. Log: `"axis <A> was empty — added <P>"`.

   After processing all transforms, validate every name in `stack.profiles` resolves to a real profile YAML:
   - If the name appears as a key in `manifest.stack.external_profiles` → HEAD that URL (after normalising `github.com/.../blob/...` → `raw.githubusercontent.com/...`). On 404, report and stop.
   - Else look up its axis in the kit-repo map built above and HEAD `RAW_BASE/profiles/<axis>/<name>.yaml`. If the name is missing from the map or the HEAD 404s → STOP and report.

   External profiles (those listed under `stack.external_profiles`) are NOT subject to `profile_transforms` — kit-side renames cannot rewrite a third-party profile. Skip them when applying renames.

12. Write the updated manifest back to its original file.

13. Re-validate against the latest schema:
    - Fetch `RAW_BASE/kit/manifest.schema.json`.
    - Validate. Report any errors as warnings (do not auto-fix; ask PO).

---

## PHASE 5 — Verify

14. Read the updated `<target>/opencode.json`. Verify `apiKey` uses `{env:VAR}` syntax — NOT a literal key. If literal — SECURITY ERROR, abort and warn PO.

15. List `<target>/.opencode/agents/` — verify the 10 base agents still exist:
    Main, CodeWriter, CodeReviewer, BugFixer, debugger, QA, TestRunner, Designer (optional), PromptEngineer, AutoApprover.
    If `requirements-pipeline` is in `manifest.stack.profiles`, also: BusinessAnalyst, CornerCaseReviewer, SystemAnalyst, CoverageChecker, ConsistencyChecker.
    `RequirementsQA.md` should NOT exist anymore (merged into QA.md as of v1.0.0+).

16. Grep the target tree for any remaining `\{\{[A-Z_]+\}\}` placeholders. List them per file as warnings (PO may need to fill manually).

17. Run smoke commands from the manifest (best-effort, don't block on failure):
    - `<manifest.stack.compile_command>` — report PASS / FAIL.
    - `<manifest.stack.test_command>` (substitute first module name for `[module]`) — report PASS / FAIL.

---

## PHASE 6 — Summary

Print exactly:

```
═══════════════════════════════════════════════════
ai-agent-kit UPDATED SUCCESSFULLY
═══════════════════════════════════════════════════

Old version:  <CURRENT_VERSION>
New version:  <versions[0].version>

New capabilities:
  <bullet list pulled from each MIGRATION_PATH entry's description>

Manifest fields added:
  <list of newly-added fields with their defaults>

Files updated: <count>

Breaking changes applied: <yes — list / "None">

Next steps:
  1. Review changes:    git diff
  2. If any customizations were overwritten: restore from git history
  3. Test compile:      <manifest.stack.compile_command>
  4. Run tests:         <manifest.stack.test_command, with first module substituted>
  5. Commit:            git add . && git commit -m "chore: update ai-agent-kit to <new>"
```

Then return control.

---

## Safety rules

- **NEVER modify files outside the target project root.**
- **NEVER delete user files.** Merge mode only overwrites kit-managed files.
- **NEVER touch `<vault_path>/` content created by PO/agents** — only `<vault_path>/_templates/` and `<vault_path>/_INDEX.md` are kit-managed (vault_path = `manifest.vault_path`, default `vault`).
- **NEVER touch `.planning/CURRENT.md`, `.planning/tasks/*.md`, `.planning/tasks/done/*.md`, or `.planning/HISTORY.md`** — runtime state, not kit content.
- **ALWAYS preserve `kit_version`** by explicitly setting it in PHASE 4.
- **STOP if `provider.api_key_env` looks like a real key** (32+ chars with letters+digits+special, or matches `sk-`, `ghp_`, `glpat-`, `AKIA*`, `xox[bp]-`).
- **STOP if any kit file 404s** — report the exact URL and ask PO whether `KIT_REPO` is correct.
