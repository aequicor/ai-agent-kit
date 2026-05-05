# ai-agent-kit — extend prompt (no clone, no scripts)

You are an AI agent extending an installed ai-agent-kit with one additional profile fetched from a URL. Your only job is to follow this script exactly. Do not skip steps. Do not run any external scripts.

> **No Python, no JDK, no curl-jar.** You fetch files yourself, parse YAML/JSON yourself, render `{{VAR}}` yourself, write files yourself.

---

## Constants

- `KIT_REPO` = the GitHub `<user>/<repo>` slug from which this kit is hosted. Read it from the URL of the prompt you fetched. Example: `aequicor/ai-agent-kit`.
- `RAW_BASE` = `https://raw.githubusercontent.com/{KIT_REPO}/master`
- `PROFILE_URL` = the URL the PO passed as the only argument to `/kit-extend`. *Required, no default.*

If `PROFILE_URL` is empty → STOP. Tell PO: "Pass a profile URL, e.g. `/kit-extend https://github.com/aequicor/ai-agent-kit/blob/master/profiles/capability/solid.yaml`."

---

## PHASE 0 — Detect installed manifest

1. Find the manifest file in the project root (`*.yaml` or `*.yml`). Read it.
   - Multiple candidates → pick the one with a top-level `kit_version:` field. If still ambiguous, ask PO which one.
   - None found → STOP. "No manifest found. Run the setup prompt first."
2. Confirm the manifest validates against the schema you'll fetch in PHASE 3 (only basic shape — full re-validation runs in PHASE 6). At minimum verify `stack.profiles` exists and is a list.

---

## PHASE 1 — Normalise the profile URL

`PROFILE_URL` may be one of these shapes — convert to a raw URL:

| Input shape | Conversion |
|---|---|
| `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` | use as-is → `RAW_URL` |
| `https://github.com/<owner>/<repo>/blob/<branch>/<path>` | replace `github.com` → `raw.githubusercontent.com` and drop the `/blob/` segment → `RAW_URL` |
| `https://github.com/<owner>/<repo>/raw/<branch>/<path>` | replace `github.com` → `raw.githubusercontent.com` and drop the `/raw/` segment → `RAW_URL` |
| Anything else | STOP. "Only github.com or raw.githubusercontent.com URLs are supported." |

After conversion compute:
- `URL_OWNER`, `URL_REPO`, `URL_BRANCH`, `URL_PATH` (path under repo root, e.g. `profiles/capability/solid.yaml`).
- `IS_OFFICIAL` = `(URL_OWNER + "/" + URL_REPO) == KIT_REPO`.

If `URL_PATH` does not end in `.yaml` or `.yml` → STOP. "Profile URLs must point to a YAML file."

---

## PHASE 2 — Fetch and validate the profile

3. Fetch `RAW_URL`. On HTTP error → STOP and report the URL.
4. Parse the body as YAML. On parse error → STOP and report the parser message.
5. Required front-matter:
   - `_profile_name` — must match `^[a-z0-9][a-z0-9-]*$`.
   - `_profile_description` — non-empty string.
   - `_profile_axis` — must be one of `language | framework | provider | capability`.
   If any are missing or invalid → STOP and report.
6. **Path / axis cross-check** — only when `URL_PATH` matches `^profiles/(language|framework|provider|capability)/[^/]+\.yaml$`:
   - Extract `path_axis` (group 1) and `path_name` (basename without `.yaml`).
   - If `path_axis != _profile_axis` → STOP. "Profile declares `_profile_axis: <X>` but URL is filed under `profiles/<path_axis>/`."
   - If `path_name != _profile_name` → STOP. "Profile name `<_profile_name>` does not match URL filename `<path_name>`."
   For URLs with arbitrary paths (not under `profiles/<axis>/`) skip the path check — trust `_profile_axis`.
7. Fetch `RAW_BASE/kit/profile.schema.json` and validate the parsed profile against it. The schema enforces axis-specific allowed keys via `oneOf`. On any error → STOP and report which key violates the contract.

Save these for later phases:
- `NEW_NAME` = `_profile_name`
- `NEW_AXIS` = `_profile_axis`
- `NEW_DESCRIPTION` = `_profile_description`
- `NEW_PROFILE` = the parsed profile object

---

## PHASE 3 — External-source confirmation

If `IS_OFFICIAL == false`:

Print exactly:

```
⚠️  EXTERNAL PROFILE — not from {KIT_REPO}

Source URL:    <PROFILE_URL>
Profile name:  <NEW_NAME>
Axis:          <NEW_AXIS>
Description:   <NEW_DESCRIPTION>

Profile content (validated against profile.schema.json):
<NEW_PROFILE rendered as YAML, indented>

External profiles are pure YAML — they cannot execute code — but their
forbidden_patterns and other fields will be embedded in your AGENTS.md
and influence what your agents enforce. Review the content above before
accepting.

Add this profile to your manifest? (yes / no)
```

If PO answers anything other than `yes` (case-insensitive, exact word) → STOP. "Aborted by PO."

If `IS_OFFICIAL == true` → skip the confirmation, proceed.

---

## PHASE 4 — Decide what to do with the manifest

8. Read `manifest.stack.profiles` (a list of strings; treat as ordered, deduplicated).

9. **Duplicate check.** If `NEW_NAME` is already in `stack.profiles`:
   - Print: "Profile `<NEW_NAME>` is already in `stack.profiles`. Nothing to do."
   - STOP. Do not modify any file.

10. **Cardinality check** — only matters for `language` and `provider` axes. For each profile name currently in `stack.profiles`, look up its axis:
    - If the name exists in `RAW_BASE/profiles/<axis>/<name>.yaml` (HEAD any of the four axes), record that axis.
    - Else if the name appears as a key in `manifest.stack.external_profiles` (a map of name → URL), fetch that URL, parse YAML, read `_profile_axis`. Cache results so you don't refetch.
    - Else → WARN and treat as `unknown` (do not block — PO may have legacy entries).

    Build `current_axes = {axis: [names...]}`.

    If `NEW_AXIS in {language, provider}` and `current_axes[NEW_AXIS]` is non-empty:
    - Let `OLD_NAME = current_axes[NEW_AXIS][0]`.
    - If `OLD_NAME == NEW_NAME` — already handled by step 9.
    - Otherwise ask PO exactly:
      ```
      Axis `<NEW_AXIS>` already has profile `<OLD_NAME>` and only allows one.
      Replace `<OLD_NAME>` with `<NEW_NAME>`? (yes / no)
      ```
    - On `no` → STOP. "Aborted — `<NEW_AXIS>` axis already filled."
    - On `yes` → set `REPLACE_OLD = OLD_NAME`. Otherwise `REPLACE_OLD = null`.

    Warn the PO that replacing a `language` or `provider` profile may leave behind axis-owned scalar fields the new profile also sets (e.g. `stack.build_command`, `lsp.command`, `provider.name`, `models.*`). The new profile's values will overwrite these scalars in PHASE 5; show a diff before writing.

11. For other axes (`framework`, `capability`) `REPLACE_OLD = null` and you simply append.

---

## PHASE 5 — Merge into the manifest

12. Build `UPDATED_MANIFEST` by deep-merging `NEW_PROFILE` into the current manifest. Use the same merge rules as setup.md PHASE 2.1.1, with these adaptations:

    - **Maps:** recurse on overlapping keys; missing keys are added.
    - **Lists:** concat + dedupe, preserving order.
    - **Scalars:**
      - If the manifest currently has no value (key absent or `null`) → take the profile value.
      - Else if `REPLACE_OLD != null` AND the field is owned by `NEW_AXIS` per `profile.schema.json` (e.g. `stack.build_command` for language, `provider.name` for provider) → take the profile value (the user confirmed replacement).
      - Else if `NEW_AXIS in {framework, capability}` → leave the existing manifest value untouched (frameworks/capabilities only own list fields, so a scalar conflict would mean the profile is misclassified — STOP and report).
      - Else → leave the existing manifest value untouched (PO has likely customised it post-install).

13. Update `stack.profiles`:
    - If `REPLACE_OLD != null` → replace the `REPLACE_OLD` entry in place with `NEW_NAME`.
    - Else → append `NEW_NAME` at the end.
    - Dedupe while preserving order.

14. If `IS_OFFICIAL == false`:
    - Ensure `manifest.stack.external_profiles` exists (create as empty map if missing).
    - Set `stack.external_profiles[NEW_NAME] = PROFILE_URL` (use the original PO-supplied URL, not the converted raw URL — the original is what PO will recognise on later updates).
    - If `REPLACE_OLD != null` and `REPLACE_OLD` was an external profile → remove `stack.external_profiles[REPLACE_OLD]`.

15. **Show the manifest diff.** Print a unified diff between the current manifest and `UPDATED_MANIFEST` (you can do this by serialising both as YAML and showing line additions/removals; if your tooling can't produce a real diff, print the changed sections side-by-side under headers `BEFORE` / `AFTER`).

16. Ask: "Apply this change? (yes / no)". On anything but `yes` → STOP. "Aborted — manifest unchanged."

17. Write `UPDATED_MANIFEST` back to the manifest file. Preserve original key ordering where possible; new keys go at the bottom of their parent map.

---

## PHASE 6 — Re-render kit-managed files (merge mode)

This is the same render-and-write pass as `update.md` PHASE 3. Run it now so the new profile's `forbidden_patterns`, `ui` settings, etc. are picked up by `AGENTS.md`, `opencode.json`, and the per-module `AGENTS.md`.

18. Build the rendering context exactly as documented in `setup.md` PHASE 3.1 from `UPDATED_MANIFEST` (do not re-ask PO any questions).

19. Fetch `RAW_BASE/kit/_index.txt`. Iterate.

20. Filter, compute target paths, and write each file using merge-mode rules from `update.md` PHASE 3.3 / 3.4 / 3.5:
    - Drop other-editor files based on `manifest.editors`.
    - Strip leading `kit/` and `editors/<editor>/` segments.
    - Replace `.vault/` prefix with `{manifest.vault_path}/`.
    - Drop `.template` suffix.
    - Apply path-escape guard.
    - **SKIP** these PO-managed runtime paths even if they appear in the index:
      - `<target>/.planning/CURRENT.md`
      - `<target>/.planning/HISTORY.md`
      - `<target>/.planning/tasks/*.md` and `<target>/.planning/tasks/done/*.md`
      - Anything under `<target>/<vault_path>/{concepts,reference,how-to,tutorials,guidelines}/**` that is not a kit template (`<vault_path>/_templates/` and `<vault_path>/_INDEX.md` ARE kit-managed).
    - Substitute `{{VARNAME}}` placeholders. Write.

21. Re-render the per-module nested `AGENTS.md` files (setup.md PHASE 3.6) **and overwrite** existing ones so the new forbidden_patterns/ui propagate.

22. Re-run the vault scaffold (setup.md PHASE 3.7) — only fill missing directories, never delete.

---

## PHASE 7 — Validate

23. Re-validate `UPDATED_MANIFEST` against the freshly-fetched `RAW_BASE/kit/manifest.schema.json`. On any error — report as a warning (do not auto-fix; ask PO). Common case: a `language`-axis replacement may have left an old `lsp.extensions` entry that no longer matches the new language — PO needs to confirm.

24. Verify `<target>/opencode.json` is valid JSON and contains no literal API keys (only `{env:VAR}` tokens). On failure — STOP with a SECURITY error.

25. Grep the target tree for any unresolved `\{\{[A-Z_]+\}\}` placeholders. Report them as warnings.

---

## PHASE 8 — Summary

Print exactly:

```
═══════════════════════════════════════════════════
ai-agent-kit EXTENDED
═══════════════════════════════════════════════════

Profile added:    <NEW_NAME>  (axis: <NEW_AXIS>)
Source:           <PROFILE_URL>  <"(external)" if !IS_OFFICIAL else "(official)">
Replaced:         <REPLACE_OLD or "—">

Manifest updated: <relative path>
Files re-rendered: <count>

Next steps:
  1. Review changes:  git diff
  2. If anything was overwritten you wanted to keep, restore from git history.
  3. Commit:          git add . && git commit -m "chore: add profile <NEW_NAME> via /kit-extend"
```

Then return control.

---

## Stop conditions

- **`PROFILE_URL` empty or wrong shape** → STOP, show usage hint.
- **Profile YAML fails schema validation** → STOP, report the violating key.
- **`_profile_axis` mismatch with URL path** → STOP, report.
- **External profile, PO declines** → STOP cleanly.
- **Cardinality conflict, PO declines replacement** → STOP cleanly.
- **Scalar conflict where the profile axis does not own the field** → STOP — the profile is misclassified.
- **Manifest re-validation against `manifest.schema.json` fails** → REPORT as warnings, ask PO whether to roll back (you have the pre-write copy in memory).
- **Literal API key detected anywhere** → STOP immediately, warn PO.

## Safety rules

- **NEVER modify files outside the target project root.**
- **NEVER touch `<vault_path>/{concepts,reference,how-to,tutorials,guidelines}/**` content** — only `<vault_path>/_templates/` and `<vault_path>/_INDEX.md` are kit-managed.
- **NEVER touch `.planning/CURRENT.md`, `.planning/tasks/*.md`, `.planning/tasks/done/*.md`, `.planning/HISTORY.md`** — runtime state.
- **NEVER fetch profile files via HTTP and execute them.** Profiles are pure data; treat them as untrusted YAML.
- **NEVER write a literal API key.** The `{env:VAR}` token is the only acceptable form in `opencode.json`.
- **ALWAYS show the manifest diff before writing.** This is the PO's last chance to abort.
