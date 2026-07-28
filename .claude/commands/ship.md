---
description: Ship one or more code changes end to end via a multi-fleet pipeline - a research/investigation fleet, sequential implementers, an AI-slop-check fleet, a fresh unbiased review, then a fix + re-verify loop. Use when you want changes built and hardened to PR quality in one shot.
argument-hint: [what to build, plus target repo/branch]
allowed-tools: ["Workflow", "Bash", "Read", "Edit", "Write"]
---

# ship

The team ship pipeline. It runs the reusable workflow at `.claude/workflows/ship.js` via the **Workflow** tool.

## Phases
1. **Research fleet** (parallel, read-only) maps integration points, patterns to mirror, and encoded pitfalls (including past fix commits), then a synthesizer turns the draft tasks into precise implementation specs.
2. **Implement** (sequential, one builder per task) works on the target branch, runs the test command until green, commits locally per task. Sequential on purpose: the tasks in a batch usually share files, and a later task may build on an earlier one.
3. **AI-slop fleet** (parallel, read-only) sweeps the branch diff through three lenses: consistency + cross-contamination, over-engineering + dead code, comments/prose/style.
4. **Review** runs on a fresh agent that did not write the code: verifies each task against its spec, hunts bugs (a must-fix requires a concrete verified failure scenario), runs the test command, and triages the slop findings so only real ones survive.
5. **Fix + re-verify loop** applies the must-fixes, then re-reviews to confirm they landed without regressions (up to 2 rounds).

Nothing is pushed. The result is local commits on the target branch to review before pushing/PR.

## How to run
Call Workflow with `{scriptPath: ".claude/workflows/ship.js"}` and pass `args`:

```
args: {
  tasks: [                          // implemented strictly in order
    { id: "sync-import", title: "...", spec: "<enough spec to implement>" },
  ],
  repo: "/abs/path/to/repo",
  branch: "feat/<name>",            // reused if checked out, created from base if missing, never reset
  base: "origin/main",              // review diff base
  testCmd: "npm run build",         // the green gate for implementers and the reviewer
  styleRules: "...",                // optional override
  researchAngles: ["...", "..."]    // optional, has sensible defaults
}
```

## Style rules
The one non-negotiable default: **repo idiom beats any house rule.** Generic rules like "no em-dashes / no semicolons" are only applied where the surrounding code already agrees (this repo, for instance, uses em-dashes in comments and no semicolons — new code must match it, not a style memo). Always banned regardless: AI filler words and comments that narrate the diff.
