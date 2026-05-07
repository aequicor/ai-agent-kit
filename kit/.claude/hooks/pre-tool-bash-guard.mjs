#!/usr/bin/env node
// ai-agent-kit — Claude Code hook: PreToolUse for Bash
// Two checks the permission-table cannot enforce alone:
//   1. Hard-deny `git push --force` to main/master regardless of pattern allow-list.
//   2. Pre-commit sync: if src/ is staged without test-cases.md update — ask PO.
// Cross-platform: Node.js + git only. Fail-soft (default allow on error).

import { execSync } from "node:child_process";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.resume();
  });
}

function safeExec(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000
    });
  } catch {
    return "";
  }
}

function emit(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  }));
}

let raw = "";
try { raw = await readStdin(); } catch { process.exit(0); }

let input;
try { input = JSON.parse(raw || "{}"); } catch { process.exit(0); }

if (input.tool_name !== "Bash") process.exit(0);

const cmd = (input.tool_input?.command || "").trim();
if (!cmd) process.exit(0);

// ── Hard deny: git push --force to main/master ─────────────────────────
if (/git\s+push\s+(--force(?:-with-lease)?|-f|-fwl)\b/.test(cmd) && /\b(main|master|prod|production)\b/.test(cmd)) {
  emit("deny", "git push --force to main/master/prod is permanently denied. Use a feature branch and a regular push.");
  process.exit(0);
}

// ── Hard deny: writing to credential files ─────────────────────────────
if (/(>|tee|cp|mv)\s+[^|]*?(\.env(?:\.\w+)?|~?\/?\.ssh\/|~?\/?\.aws\/|credentials\.json)/i.test(cmd)) {
  emit("deny", "Writing to credential files is forbidden. Set the value via the appropriate manifest field or your shell environment.");
  process.exit(0);
}

// ── Pre-commit: source-vs-tests sync check ─────────────────────────────
if (/^git\s+commit\b/.test(cmd)) {
  const staged = safeExec("git diff --cached --name-only").split(/\r?\n/).filter(Boolean);
  if (staged.length === 0) process.exit(0);

  const isSrc = (p) => /(^|\/)src\//i.test(p) && !/\/test\//i.test(p) && !/Test\.[a-z]+$/i.test(p);
  const isTestCases = (p) => /vault\/features\/[^/]+\/[^/]+\/test-cases\.md$/i.test(p);
  const isFeatureDoc = (p) => /vault\/features\/[^/]+\/[^/]+\/feature\.md$/i.test(p);
  const isTestFile = (p) => /\/test\//i.test(p) || /Test\.[a-z]+$/i.test(p) || /\.test\.[a-z]+$/i.test(p);

  const srcFiles = staged.filter(isSrc);
  if (srcFiles.length > 0) {
    const hasTestCases = staged.some(isTestCases);
    const hasFeatureDoc = staged.some(isFeatureDoc);
    const hasTests = staged.some(isTestFile);

    if (!hasTestCases && !hasFeatureDoc && !hasTests) {
      emit(
        "ask",
        `Source files staged (${srcFiles.slice(0, 3).join(", ")}${srcFiles.length > 3 ? ", …" : ""}) without any test or test-cases.md update. Likely missing @TestKeeper RECONCILE or regression test. Proceed anyway?`
      );
      process.exit(0);
    }
  }
}

// Default: allow (no JSON output → permission table decides)
process.exit(0);
