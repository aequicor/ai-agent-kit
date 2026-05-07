// ai-agent-kit — OpenCode plugin: session-bootstrap
// v6.1+: on session.created, write .planning/.session-bootstrap.md so @Main reads
// pending-step context at task start (mirrors Claude Code's SessionStart hook).
// OpenCode plugin API does NOT expose direct system-prompt injection at session start;
// the kit instead instructs all agents (via _shared.md) to read this file at task start.
//
// Plugin signature reference: https://opencode.ai/docs/plugins/
// Hooks API: subscribes to session.created (and session.compacted as a side-channel
// to refresh after compaction, since that also clears agent context).
//
// Fail-soft: any error → no-op, never blocks the session.

import type { Plugin } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

function safeRead(p: string): string {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function safeWrite(p: string, content: string): boolean {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf8");
    return true;
  } catch { return false; }
}

function safeExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
      cwd
    }).trim();
  } catch {
    return "";
  }
}

function parseField(text: string, key: string): string {
  const re = new RegExp(`^${key}:\\s*([^\\n\\r#]+?)\\s*(?:#.*)?$`, "m");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

interface StepCommit {
  step: number;
  sha: string;
  goal: string;
  superseded: boolean;
}

function parseStepCommits(taskBody: string): StepCommit[] {
  // Line-by-line parser (avoids relying on \Z which is not supported in JS/TS regex).
  const entries: StepCommit[] = [];
  let cur: StepCommit | null = null;
  for (const line of taskBody.split(/\r?\n/)) {
    const stepM = line.match(/^-\s*step:\s*(\d+)/);
    if (stepM) {
      if (cur) entries.push(cur);
      cur = { step: parseInt(stepM[1], 10), sha: "", goal: "", superseded: false };
      continue;
    }
    if (!cur) continue;
    const shaM = line.match(/^\s+sha:\s*([^\s]+)/);
    if (shaM) cur.sha = shaM[1];
    const goalM = line.match(/^\s+goal:\s*(.+)/);
    if (goalM) cur.goal = goalM[1].trim();
    if (/^\s+superseded:\s*true\s*$/.test(line)) cur.superseded = true;
  }
  if (cur) entries.push(cur);
  return entries;
}

function refreshBootstrap(cwd: string): void {
  const branch = safeExec("git rev-parse --abbrev-ref HEAD", cwd) || "(no git)";
  const lastCommit = safeExec("git log -1 --oneline --no-color", cwd) || "(no commits)";

  const currentMdPath = path.join(cwd, ".planning", "CURRENT.md");
  const currentMd = safeRead(currentMdPath);
  if (!currentMd) return; // .planning/ missing → nothing to bootstrap

  const activeTask = parseField(currentMd, "active_task") || "(none)";
  const mode = parseField(currentMd, "mode") || "interactive";
  const taskStatus = parseField(currentMd, "status") || "";

  let pending = 0;
  let lastEntry: StepCommit | null = null;
  let body = "";

  if (activeTask !== "(none)" && !activeTask.startsWith("(")) {
    body = safeRead(path.join(cwd, ".planning", "tasks", `${activeTask}.md`));
    const currentStepIdx = parseInt(parseField(body, "current_step_idx") || "0", 10);
    const commits = parseStepCommits(body);
    lastEntry = commits.length ? commits[commits.length - 1] : null;
    pending = (lastEntry && lastEntry.superseded) ? currentStepIdx : currentStepIdx + 1;
  }

  const lines = [
    `# Session bootstrap — written by OpenCode session.created plugin`,
    `# Generated: ${new Date().toISOString()}`,
    ``,
    `branch: ${branch}`,
    `last_commit: ${lastCommit.slice(0, 100)}`,
    `active_task: ${activeTask}`,
    `mode: ${mode}`,
    `status: ${taskStatus || "(active)"}`,
    `pending_step: ${pending}`,
    `last_green_sha: ${lastEntry?.sha || "(none)"}`,
    ``,
    `## Pending action`,
    taskStatus === "SLEEP_BLOCKED"
      ? `Read .planning/MORNING_REPORT.md (sleep mode hit BLOCKED-shutdown). Then /kit-resume to continue.`
      : (activeTask === "(none)"
        ? `No active task — run /kit-new-feature to start.`
        : (pending <= 1 && !lastEntry
          ? `Run /kit-resume to continue analysis/plan/execute from current state.`
          : `Run /kit-step-resume to enter step ${pending}.`)),
    ``,
    `## Last step runbook (for regression check at next 5.6)`,
    lastEntry?.goal
      ? `Step ${lastEntry.step} — ${lastEntry.goal} — sha ${lastEntry.sha?.slice(0, 8) || "?"}${lastEntry.superseded ? " (superseded)" : ""}`
      : `(no completed steps yet)`,
    ``,
    `> This file is regenerated on every session start. Agents read it at task start per _shared.md instruction.`
  ];

  safeWrite(path.join(cwd, ".planning", ".session-bootstrap.md"), lines.join("\n"));
}

export const SessionBootstrapPlugin: Plugin = async (ctx) => {
  const cwd = ctx.directory || ctx.worktree || process.cwd();

  return {
    "session.created": async () => {
      try { refreshBootstrap(cwd); } catch { /* fail-soft */ }
    },
    // Also refresh after compaction — agent context is partially reset, so the
    // briefing should be fresh.
    "session.compacted": async () => {
      try { refreshBootstrap(cwd); } catch { /* fail-soft */ }
    }
  };
};

export default SessionBootstrapPlugin;
