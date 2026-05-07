#!/usr/bin/env node
// ai-agent-kit — Claude Code hook: SessionStart
// Emits additionalContext with current git branch + active task summary.
// Cross-platform: Node.js only, no shell-specific commands.
// Fail-soft: any error → empty context, never blocks the session.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function safeRead(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function safeExec(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000
    }).trim();
  } catch {
    return "";
  }
}

const cwd = process.cwd();
const branch = safeExec("git rev-parse --abbrev-ref HEAD") || "(no git)";
const lastCommit = safeExec("git log -1 --oneline --no-color") || "(no commits)";

const currentMd = safeRead(path.join(cwd, ".planning", "CURRENT.md"));
const taskMatch = currentMd.match(/active_task:\s*([^\n\r]+)/);
const activeTask = taskMatch ? taskMatch[1].trim() : "(none)";

let taskLine = "";
if (activeTask !== "(none)" && !activeTask.startsWith("(")) {
  const body = safeRead(path.join(cwd, ".planning", "tasks", `${activeTask}.md`));
  const typeM = body.match(/^Type:\s*(.*)$/m);
  const nextEntries = [...body.matchAll(/^-\s*NEXT:\s*(.*)$/gm)];
  const lastNext = nextEntries.length ? nextEntries[nextEntries.length - 1][1].trim() : "";
  taskLine = ` | type=${typeM?.[1]?.trim() || "?"} | next: ${lastNext.slice(0, 100) || "(none)"}`;
}

const ctx = [
  "[ai-agent-kit session boot]",
  `branch=${branch}`,
  `last_commit=${lastCommit.slice(0, 100)}`,
  `active_task=${activeTask}${taskLine}`
].join(" | ");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ctx
  }
}));
process.exit(0);
