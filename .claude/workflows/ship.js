export const meta = {
  name: 'ship',
  description: 'Ship a batch of changes end to end: research fleet, sequential implementers, slop-check fleet, fresh review, fix loop. Local commits only.',
  whenToUse: 'When one or more scoped changes should be built and hardened to PR quality in a single run.',
  phases: [
    { title: 'Research', detail: 'parallel read-only mapping, then spec synthesis' },
    { title: 'Implement', detail: 'one sequential builder per task, local commit each' },
    { title: 'Slop check', detail: 'parallel consistency / over-engineering / style sweep' },
    { title: 'Review', detail: 'fresh unbiased agent reviews the full branch diff' },
    { title: 'Fix', detail: 'apply must-fixes and re-verify, up to 2 rounds' },
  ],
}

// ── args ────────────────────────────────────────────────────────────────────
// tasks:   [{ id, title, spec }] — implemented strictly in array order, so a
//          later task may depend on an earlier one (say so in its spec).
// repo:    absolute path to the working copy.
// branch:  the branch to commit on. Created from `base` if missing, reused as
//          checked out if it already exists (never reset).
// base:    merge base for review diffs (default origin/main).
// testCmd: the green-gate every implementer and the reviewer must run.
const {
  tasks = [],
  repo,
  branch,
  base = 'origin/main',
  testCmd = 'npm run build',
  styleRules = 'Match the surrounding idiom exactly (comment density, naming, punctuation). Repo idiom always beats any general style preference. No AI filler words, no comments that narrate the diff.',
  researchAngles = null,
} = args || {}

if (!repo || !branch || !tasks.length) {
  throw new Error('ship needs args.repo, args.branch and a non-empty args.tasks')
}

const taskList = tasks.map((t, i) => `${i + 1}. [${t.id}] ${t.title}\n${t.spec}`).join('\n\n')

// ── Phase 1: research fleet (barrier is correct: synthesis needs all maps) ──
phase('Research')
const angles = researchAngles || [
  'Data layer: storage schema, transaction and query patterns, the invariants mutations protect',
  'UI composition: view/component structure, styling system, reusable primitives, stacking/layout constraints',
  'Encoded pitfalls: constraints explained in code comments, platform quirks, and the bug classes visible in past fix commits (read git log)',
]

const maps = (await parallel(angles.map((angle, i) => () =>
  agent(
    `Read-only research in the repo at ${repo} (do NOT edit anything).\n` +
    `Angle: ${angle}\n\n` +
    `This research feeds the implementation of these tasks:\n${taskList}\n\n` +
    `Return a dense factual map for your angle: file paths, function/component names, ` +
    `patterns to mirror (with a short verbatim example each), and traps an implementer ` +
    `would hit. Facts only — no recommendations beyond "mirror this pattern".`,
    { label: `research:${i + 1}`, phase: 'Research' },
  )
))).filter(Boolean)

const SPEC_SCHEMA = {
  type: 'object',
  required: ['specs', 'pitfalls'],
  properties: {
    specs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['taskId', 'spec'],
        properties: { taskId: { type: 'string' }, spec: { type: 'string' } },
      },
    },
    pitfalls: { type: 'string' },
  },
}

const synth = await agent(
  `You are the spec synthesizer for a ship pipeline on the repo at ${repo}.\n\n` +
  `Draft tasks:\n${taskList}\n\n` +
  `Research maps from parallel read-only agents:\n\n${maps.map((m, i) => `--- MAP ${i + 1} ---\n${m}`).join('\n\n')}\n\n` +
  `Refine each draft task into a precise implementation spec grounded in the maps: exact files to ` +
  `touch, patterns to mirror, edge cases to handle, and what NOT to do. Keep each task's scope as ` +
  `drafted — refine, don't expand. Also distill a shared "pitfalls" briefing every implementer must read. ` +
  `Verify anything uncertain by reading the repo directly.`,
  { label: 'synthesize-specs', phase: 'Research', schema: SPEC_SCHEMA },
)
if (!synth) throw new Error('spec synthesis died')

// ── Phase 2: implement (sequential ON PURPOSE: tasks share files) ───────────
phase('Implement')
const IMPL_SCHEMA = {
  type: 'object',
  required: ['status', 'summary'],
  properties: {
    status: { type: 'string', enum: ['committed', 'failed'] },
    commit: { type: 'string' },
    summary: { type: 'string' },
    notes: { type: 'string' },
  },
}

const done = []
for (const t of tasks) {
  const spec = synth.specs.find((s) => s.taskId === t.id)?.spec || t.spec
  const result = await agent(
    `Implement one task in the repo at ${repo}, on the CURRENT branch.\n\n` +
    `Branch rules: run \`git -C ${repo} rev-parse --abbrev-ref HEAD\`; if it is not "${branch}", ` +
    `check out ${branch} (create from ${base} only if it does not exist). NEVER reset the branch, ` +
    `NEVER push, NEVER commit to any other branch.\n\n` +
    `TASK [${t.id}] ${t.title}\n${spec}\n\n` +
    `SHARED PITFALLS BRIEFING\n${synth.pitfalls}\n\n` +
    (done.length
      ? `ALREADY LANDED THIS RUN (your task may build on these):\n${done.map((d) => `- ${d.summary}`).join('\n')}\n\n`
      : '') +
    `STYLE RULES\n${styleRules}\n\n` +
    `Definition of done: the task's spec is implemented, \`${testCmd}\` passes, and the work is ` +
    `committed locally with a clear conventional-commit message ending with these two trailer lines:\n` +
    `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>\n` +
    `Claude-Session: https://claude.ai/code/session_01NBLkqNYmSgVYiTwUDcdogL\n` +
    `Commit ONLY files your task touched. If you cannot finish, commit nothing and report status "failed" with why.`,
    { label: `implement:${t.id}`, phase: 'Implement', schema: IMPL_SCHEMA },
  )
  if (result) done.push({ id: t.id, ...result })
  else done.push({ id: t.id, status: 'failed', summary: `${t.id}: agent died` })
  log(`implement ${t.id}: ${result?.status || 'died'} — ${result?.summary || ''}`)
}

// ── Phase 3: slop-check fleet (barrier: the reviewer triages all findings) ──
phase('Slop check')
const SLOP_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'claim', 'severity'],
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['must-fix', 'nit'] },
          claim: { type: 'string' },
        },
      },
    },
  },
}

const lenses = [
  ['consistency', 'Consistency and cross-contamination: does new code mirror existing naming, structure, CSS tokens and component patterns? Any diff hunks that are cosmetic-only churn or touch code unrelated to the tasks?'],
  ['over-engineering', 'Over-engineering: abstractions with one caller, config nobody set, dead code, defensive branches for impossible states, anything simpler the repo already had a primitive for.'],
  ['prose-and-comments', `Comments and prose: redundant comments narrating the diff, AI filler words, tone drift from the repo's comment voice, and violations of: ${styleRules}`],
]

const slop = (await parallel(lenses.map(([key, lens]) => () =>
  agent(
    `Read-only slop check of the branch diff in ${repo} (do NOT edit).\n` +
    `Get the diff: \`git -C ${repo} diff ${base}...HEAD\` and \`git -C ${repo} log ${base}..HEAD --oneline\`.\n` +
    `The diff implements:\n${taskList}\n\n` +
    `Your lens: ${lens}\n\n` +
    `Report only findings you can point to in the diff (file + line). No praise, no generalities. ` +
    `Judge against the REPO's own idiom (read neighboring code), not abstract taste.`,
    { label: `slop:${key}`, phase: 'Slop check', schema: SLOP_SCHEMA, effort: 'low' },
  )
))).filter(Boolean).flatMap((r) => r.findings)
log(`slop fleet: ${slop.length} candidate findings`)

// ── Phase 4 + 5: fresh review, then fix + re-verify (≤2 rounds) ─────────────
const REVIEW_SCHEMA = {
  type: 'object',
  required: ['mustFix', 'nits', 'buildPassed'],
  properties: {
    mustFix: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'summary', 'failureScenario'],
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          summary: { type: 'string' },
          failureScenario: { type: 'string' },
        },
      },
    },
    nits: { type: 'array', items: { type: 'string' } },
    buildPassed: { type: 'boolean' },
  },
}

const review = (extra) =>
  agent(
    `You are a fresh, skeptical reviewer. You did not write this code; assume nothing.\n` +
    `Repo: ${repo}. Review the FULL branch diff: \`git -C ${repo} diff ${base}...HEAD\` ` +
    `(plus \`git -C ${repo} log ${base}..HEAD --oneline\`). It is meant to implement:\n${taskList}\n\n` +
    `Do all of:\n` +
    `1. Verify each task is actually implemented as specced (read the real files, not just the diff).\n` +
    `2. Hunt real bugs: state machines, async races, transaction boundaries, mobile Safari quirks. ` +
    `A must-fix needs a concrete failure scenario (inputs/state → wrong outcome) you have verified ` +
    `against the code — if you cannot construct one, it is a nit.\n` +
    `3. Run \`${testCmd}\` in ${repo} and report whether it passes.\n` +
    `4. Triage these candidate findings from a style/slop fleet — verify each against the code and ` +
    `keep only the real ones (as must-fix or nit):\n${JSON.stringify(slop, null, 2)}\n` +
    (extra || ''),
    { label: 'review-plus', phase: 'Review', schema: REVIEW_SCHEMA, effort: 'high' },
  )

phase('Review')
let verdict = await review()
if (!verdict) throw new Error('reviewer died')

let round = 0
while (verdict.mustFix.length && round < 2) {
  round++
  phase('Fix')
  log(`fix round ${round}: ${verdict.mustFix.length} must-fix findings`)
  await agent(
    `Apply review fixes in ${repo} on the current branch (verify it is "${branch}"; never push).\n\n` +
    `Must-fix findings:\n${JSON.stringify(verdict.mustFix, null, 2)}\n\n` +
    `STYLE RULES\n${styleRules}\n\n` +
    `Fix every finding (or, if one is genuinely wrong, leave the code alone and say why in your ` +
    `final report). Run \`${testCmd}\` until green, then commit with message ` +
    `"fix: address review findings (round ${round})" ending with the trailers:\n` +
    `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>\n` +
    `Claude-Session: https://claude.ai/code/session_01NBLkqNYmSgVYiTwUDcdogL`,
    { label: `fix:round-${round}`, phase: 'Fix' },
  )
  verdict = await review(
    `\nThis is re-review round ${round}: a fixer just addressed the previous must-fix list. ` +
    `Confirm each fix landed without regressions before clearing it.`,
  )
  if (!verdict) throw new Error('re-reviewer died')
}

return {
  tasks: done,
  review: {
    buildPassed: verdict.buildPassed,
    remainingMustFix: verdict.mustFix,
    nits: verdict.nits,
    fixRounds: round,
  },
}
