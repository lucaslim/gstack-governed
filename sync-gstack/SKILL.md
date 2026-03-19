---
name: sync-gstack
version: 2.0.0
model: sonnet
description: |
  Sync gstack-governed fork with upstream gstack. Fetches latest from garrytan/gstack,
  modifies the generator (preamble trim) and templates (React/TS adaptations),
  regenerates SKILL.md files, then creates a PR on the fork for review.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - mcp__serena__find_symbol
  - mcp__serena__get_symbols_overview
  - mcp__serena__find_referencing_symbols
  - mcp__serena__search_for_pattern
  - mcp__serena__find_file
  - mcp__serena__list_dir
  - mcp__serena__replace_symbol_body
  - mcp__serena__insert_after_symbol
  - mcp__serena__insert_before_symbol
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (run first)

```bash
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -delete 2>/dev/null || true
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
```

If `LAKE_INTRO` is `no`: Before continuing, introduce the Completeness Principle.
Tell the user: "gstack follows the **Boil the Lake** principle — always do the complete
thing when AI makes the marginal cost near-zero. Read more: https://garryslist.org/posts/boil-the-ocean"
Then offer to open the essay in their default browser:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

Only run `open` if the user says yes. Always run `touch` to mark as seen. This only happens once.

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch (use the `_BRANCH` value printed by the preamble — NOT any branch from conversation history or gitStatus), and the current plan/task. (1-2 sentences)
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow. No raw function names, no internal jargon, no implementation details. Use concrete examples and analogies. Say what it DOES, not what it's called.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]` — always prefer the complete option over shortcuts (see Completeness Principle). Include `Completeness: X/10` for each option. Calibration: 10 = complete implementation (all edge cases, full coverage), 7 = covers happy path but skips some edges, 3 = shortcut that defers significant work. If both options are 8+, pick the higher; if one is ≤5, flag it.
4. **Options:** Lettered options: `A) ... B) ... C) ...` — when an option involves effort, show both scales: `(human: ~X / CC: ~Y)`

Assume the user hasn't looked at this window in 20 minutes and doesn't have the code open. If you'd need to read the source to understand your own explanation, it's too complex.

Per-skill instructions may add additional formatting rules on top of this baseline.

## Completeness Principle — Boil the Lake

AI-assisted coding makes the marginal cost of completeness near-zero. When you present options:

- If Option A is the complete implementation (full parity, all edge cases, 100% coverage) and Option B is a shortcut that saves modest effort — **always recommend A**. The delta between 80 lines and 150 lines is meaningless with CC+gstack. "Good enough" is the wrong instinct when "complete" costs minutes more.
- **Lake vs. ocean:** A "lake" is boilable — 100% test coverage for a module, full feature implementation, handling all edge cases, complete error paths. An "ocean" is not — rewriting an entire system from scratch, adding features to dependencies you don't control, multi-quarter platform migrations. Recommend boiling lakes. Flag oceans as out of scope.
- **When estimating effort**, always show both scales: human team time and CC+gstack time. The compression ratio varies by task type — use this reference:

| Task type | Human team | CC+gstack | Compression |
|-----------|-----------|-----------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |
| Architecture / design | 2 days | 4 hours | ~5x |
| Research / exploration | 1 day | 3 hours | ~3x |

- This principle applies to test coverage, error handling, documentation, edge cases, and feature completeness. Don't skip the last 10% to "save time" — with AI, that 10% costs seconds.

**Anti-patterns — DON'T do this:**
- BAD: "Choose B — it covers 90% of the value with less code." (If A is only 70 lines more, choose A.)
- BAD: "We can skip edge case handling to save time." (Edge case handling costs minutes with CC.)
- BAD: "Let's defer test coverage to a follow-up PR." (Tests are the cheapest lake to boil.)
- BAD: Quoting only human-team effort: "This would take 2 weeks." (Say: "2 weeks human / ~1 hour CC.")

## Completion Status Protocol

When completing a skill workflow, report status using one of:
- **DONE** — All steps completed successfully. Evidence provided for each claim.
- **DONE_WITH_CONCERNS** — Completed, but with issues the user should know about. List each concern.
- **BLOCKED** — Cannot proceed. State what is blocking and what was tried.
- **NEEDS_CONTEXT** — Missing information required to continue. State exactly what you need.

### Escalation

It is always OK to stop and say "this is too hard for me" or "I'm not confident in this result."

Bad work is worse than no work. You will not be penalized for escalating.
- If you have attempted a task 3 times without success, STOP and escalate.
- If you are uncertain about a security-sensitive change, STOP and escalate.
- If the scope of work exceeds what you can verify, STOP and escalate.

Escalation format:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```

# Sync Gstack-Governed with Upstream

Pull latest upstream gstack, modify the generator and templates to apply governed trims and
React/TS adaptations, regenerate all SKILL.md files, create a PR.

**Architecture note:** SKILL.md files are generated from `.tmpl` templates by
`scripts/gen-skill-docs.ts`. Running `./setup` (which calls `bun run build`) regenerates
them. Never edit generated SKILL.md files directly — edits go in `.tmpl` files or in the
generator script.

## Prerequisites

Detect the gstack repo root (works in both global installs and Conductor worktrees):
```bash
GSTACK_ROOT=$(git rev-parse --show-toplevel)
echo "GSTACK_ROOT=$GSTACK_ROOT"
```

The fork must have an `upstream` remote pointing to `garrytan/gstack`:
```bash
git remote -v  # should show upstream → garrytan/gstack
```

If missing: `git remote add upstream https://github.com/garrytan/gstack.git`

## Workflow

### Step 1 — Fetch upstream + assess what changed

```bash
git fetch upstream
git fetch origin
```

Show what is new upstream vs the fork:
```bash
git log origin/main..upstream/main --oneline
```

Read the CHANGELOG diff:
```bash
git diff origin/main..upstream/main -- CHANGELOG.md
```

Print a summary of what is new upstream: new skills, changed templates, generator changes,
new commands, version bumps. This summary goes into the PR body later.

### Step 2 — Create sync branch from origin/main and rebase upstream

Create a branch based on `origin/main` (the fork), then rebase onto `upstream/main`.
This replays the fork's commits on top of upstream, producing a linear history and
avoiding unnecessary merge conflicts when the PR lands.

```bash
git checkout -b sync-upstream-$(date +%Y%m%d) origin/main
git rebase upstream/main
```

**If there are rebase conflicts:** Resolve them, preferring the fork's version for:
- Generator functions that the fork has already adapted (e.g. `generatePreamble()`)
- Template sections the fork has already adapted (React/TS vocab, Greptile removal)
- Fork-only files (sync-gstack/, .serena/, .gitignore)

For genuinely new upstream content (new skills, new template sections), accept upstream's
version — it will be adapted in Steps 3–4.

After resolving each conflict: `git add <files> && git rebase --continue`

**If the rebase is clean:** Continue — Steps 2b–4 will clean up and adapt any new content.

### Step 2b — Remove upstream update infrastructure

The fork does not use gstack-upgrade, gstack-update-check, or gstack-config.
Upstream still ships them, so the rebase will reintroduce them. Delete them now:

```bash
rm -rf gstack-upgrade/
rm -f bin/gstack-update-check bin/gstack-config
rm -f browse/test/gstack-config.test.ts browse/test/gstack-update-check.test.ts
```

Also remove `gstack-upgrade` from the build/test registries if the rebase re-added it:

1. `scripts/gen-skill-docs.ts` — remove the `gstack-upgrade` entry from `findTemplates()`
2. `scripts/skill-check.ts` — remove `'gstack-upgrade/SKILL.md'` from `SKILL_FILES`
3. `test/gen-skill-docs.test.ts` — remove `{ dir: 'gstack-upgrade', ... }` from `ALL_SKILLS`
4. `test/skill-validation.test.ts` — remove `'gstack-upgrade/SKILL.md'` from the skills array
5. `test/skill-e2e.test.ts` — remove any `test.todo()` for gstack-upgrade

**Verification:**
```bash
grep -rn 'gstack-upgrade\|gstack-update-check\|gstack-config' scripts/ test/ bin/ --include='*.ts' --include='*.sh'
```

If any matches remain, remove them. CHANGELOG.md references are historical — leave those.

### Step 3 — Verify generator (preamble trim)

Since the branch started from `origin/main`, the generator already has the fork's
adaptations. This step verifies the rebase didn't reintroduce upstream content and
fixes it if it did.

Use Serena's symbolic tools to inspect the generator efficiently:
- `get_symbols_overview` on `scripts/gen-skill-docs.ts` to see all functions
- `find_symbol` with `include_body=true` to read specific function bodies
- `replace_symbol_body` to replace function implementations if needed

The generator is `scripts/gen-skill-docs.ts`. The `generatePreamble()` function controls
what the `PREAMBLE` placeholder resolves to in every template.

**Verify `generatePreamble()` contains everything from upstream EXCEPT:**
- The `_UPD` line (`gstack-update-check`)
- The `UPGRADE_AVAILABLE` handling paragraph
- The `_CONTRIB` line (`gstack-config get gstack_contributor`)
- The entire "Contributor Mode" section (field reports, calibration, etc.)

**Keep (must be present):**
- Session tracking (`_SESSIONS`), branch detection (`_BRANCH`), lake intro (`_LAKE_SEEN`)
- Lake intro (one-time Completeness Principle introduction with `open` offer)
- AskUserQuestion format (upstream's enhanced version with completeness scoring, dual time estimates, `_BRANCH` reference)
- Completeness Principle section (lake vs ocean, compression table, anti-patterns)
- Completion Status Protocol (DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT)
- Escalation section

If the rebase reintroduced `_UPD`, `_CONTRIB`, or Contributor Mode, remove those lines/sections.
If the rebase stripped session tracking or Completeness Principle, restore them from upstream.

Also check `generateQAMethodology()` in the same file. If upstream re-added a `### Rails`
framework subsection, remove it. Ensure `### General SPA (React, Vue, Angular)` is present
with hydration, client-side routing, CLS, and stale state checks.

Also check `generateDesignMethodology()` if it exists. Verify it contains no Rails-specific
content (e.g. `.gstack/` paths, Rails view references). If clean, leave it as-is.

**Verification:**
```bash
grep -n '_UPD=\|UPGRADE_AVAILABLE\|Contributor Mode\|gstack_contributor' scripts/gen-skill-docs.ts
```

This should return empty. If matches are found, the trim is incomplete.

### Step 4 — Verify and fix React/TS template adaptations

Since the branch started from `origin/main`, most adaptations are already in place.
This step verifies the rebase didn't reintroduce upstream content (Rails vocab, Greptile,
VERSION/CHANGELOG steps, etc.) and adapts any genuinely NEW upstream content.

Edit `.tmpl` files (never generated `.md` files). For each skill below, check whether
the merge reintroduced content and fix if needed. If a section is already correct
(fork adaptation preserved), skip that sub-step.

---

**4a. ship/SKILL.md.tmpl**

- Remove any Step related to VERSION bump if upstream re-added it
- Remove any Step related to CHANGELOG generation if upstream re-added it
- Remove any eval suite step (e.g. "Step 3.25: Eval Suites") if present
- Remove any TODOS.md auto-update step if present
- Replace test command references: `bin/test-lane` and `npm run test` become
  "project's test/lint/typecheck commands from CLAUDE.local.md 'Project Scripts' table"
- Replace commit ordering vocabulary:
  - "migrations" → "schema changes"
  - "Models & services" → "Components & hooks"
  - "Controllers & views" → "Pages & routes"

```bash
grep -n 'bin/test-lane\|npm run test\|VERSION bump\|CHANGELOG gen\|Eval Suites\|migrations\|Models & services\|Controllers & views' ship/SKILL.md.tmpl
```

---

**4b. review/SKILL.md.tmpl**

- Replace ActiveRecord / ORM vocabulary with GraphQL client / data fetching hooks
- Replace "Models" → "Components", "Controllers" → "Pages/Routes", "Concerns" → "Hooks"
- Replace "Models/Controllers/Concerns" → "Components/Hooks/Services/Utils" where grouped

**DO NOT modify `review/checklist.md` or `review/TODOS-format.md`** — these are maintained directly in the fork and are not generated.

---

**4c. retro/SKILL.md.tmpl**

- Replace "Models / Controllers / Concerns" → "Components / Hooks / Services / Utils"
  (handle both spaced and unspaced slash variants)

---

**4d. plan-eng-review/SKILL.md.tmpl**

- Replace Rails-specific error types with React/TS equivalents:
  `ActiveRecord::RecordNotFound` → `NotFoundError`,
  `ActionController::RoutingError` → `TypeError / AbortError`,
  Rails error vocabulary → TypeError, AbortError, DOMException, GraphQL client errors
- Replace architecture vocabulary: "Models" → "Components", "Controllers" → "Pages/Routes",
  "Concerns" → "Hooks"
- Ensure this exists: "When a plan requires new API queries/mutations, include a 'Request
  for BE team' section: ideal query shape, missing API capabilities, N+1 risks."
- Replace "JS or Rails test" → "project's test framework from CLAUDE.local.md"

---

**4e. plan-ceo-review/SKILL.md.tmpl**

- Apply the same vocabulary replacements as plan-eng-review (4d)

---

**4f. qa/SKILL.md.tmpl + qa-only/SKILL.md.tmpl**

- If upstream re-added a `### Rails` framework guidance subsection in the template, remove it
  (also check `generateQAMethodology()` in the generator — covered in Step 3)
- Ensure React/SPA checks are present: hydration errors, client-side routing, CLS
- Change artifact path references from `.gstack/` to `.local-context/`

---

**4g. browse/SKILL.md.tmpl (and root SKILL.md.tmpl)**

- Change any artifact path references from `.gstack/` to `.local-context/`
- If no `.gstack/` references exist, skip

---

**4h. Verify ALL remaining skills are stack-agnostic**

Every skill not explicitly adapted in 4a–4g must be checked for Rails/Ruby vocabulary
before passing through. Do not assume any skill is clean — upstream may have added
framework-specific content to previously agnostic skills.

Scan every `.tmpl` file not already handled above:
```bash
grep -rn 'ActiveRecord\|bin/test-lane\|npm run test\|Rails\|Models/Controllers\|Controllers & views\|Models & services\|rescue\|migration\|greptile\|greptile-triage\|greptile-history' \
  document-release/SKILL.md.tmpl \
  setup-browser-cookies/SKILL.md.tmpl \
  SKILL.md.tmpl \
  browse/SKILL.md.tmpl
```

Also check for `.gstack/` artifact paths (project-level, not `~/.gstack/` global):
```bash
grep -rn '\.gstack/' document-release/SKILL.md.tmpl setup-browser-cookies/SKILL.md.tmpl SKILL.md.tmpl browse/SKILL.md.tmpl | grep -v '~/.gstack'
```

If matches are found, apply the `.gstack/` → `.local-context/` path conversion.

Also check any NEW `.tmpl` files that upstream may have added since the last sync:
```bash
find . -name 'SKILL.md.tmpl' -not -path './node_modules/*' | sort
```

Compare this list against the skills handled in 4a–4g. Any template not listed above
is new — read it, check for Rails/Ruby vocabulary, and apply adaptations if needed.

If grep matches are found in any file, apply the same vocabulary replacements described
in the earlier steps. If all files are clean, they pass through unchanged.

---

**4i. Remove all Greptile integration**

Upstream includes a Greptile code review integration that the governed fork does not use.
Strip all Greptile references from templates and delete Greptile-specific files.

**Delete `review/greptile-triage.md`** if it exists — the entire file is Greptile-specific:
```bash
rm -f review/greptile-triage.md
```

**In `ship/SKILL.md.tmpl`:**
- Remove any Step related to "Address Greptile review comments" (e.g. Step 3.75)
- Remove Greptile from any batched item lists (e.g. "Greptile review comments that need user decision")
- Remove Greptile reply template instructions and greptile-history references
- Remove any "Greptile Review" output section from the report template

**In `review/SKILL.md.tmpl`:**
- Remove any Step related to "Check for Greptile review comments" (e.g. Step 2.5)
- Remove the "Greptile comment resolution" subsection
- Remove Greptile summary lines from output format (e.g. `+ N Greptile comments`)
- Remove greptile-triage.md read instructions and reply template references

**In `retro/SKILL.md.tmpl`:**
- Remove greptile-history fetch commands (e.g. `cat ~/.gstack/greptile-history.md`)
- Remove the Greptile signal metric row and its computation logic
- Remove `"greptile"` entries from any JSON schema definitions

**In any other `.tmpl` file:** Scan for and remove Greptile references.

**Verification:**
```bash
grep -rni 'greptile' */SKILL.md.tmpl SKILL.md.tmpl review/greptile-triage.md 2>/dev/null
```

This should return empty. If matches remain, trace and remove them.

### Step 5 — Regenerate all SKILL.md files

```bash
bun install && bun run gen:skill-docs
```

Verify regeneration:
```bash
git diff --stat
```

Every `*/SKILL.md` should show changes matching the template/generator modifications.

**Sanity check** — confirm no governed-trimmed content leaked through:
```bash
grep -rn '_UPD=\|Contributor Mode\|bin/test-lane\|ActiveRecord\|Controllers & views\|greptile' */SKILL.md SKILL.md
```

**Path check** — confirm upstream `.gstack/` artifact paths were converted to `.local-context/`:
```bash
grep -rn '\.gstack/' */SKILL.md SKILL.md | grep -v '~/.gstack'
```

This should return empty. If matches appear, trace to the template and apply the `.gstack/` → `.local-context/` conversion.

If any matches are found, trace back to the template or generator and fix.

### Step 6 — Commit and push

Stage templates, generator, generated files, fork-only files, and any deleted Greptile files:
```bash
git add scripts/gen-skill-docs.ts
git add $(find . -name 'SKILL.md.tmpl' -not -path './node_modules/*')
git add $(find . -name 'SKILL.md' -not -path './node_modules/*' -not -path './sync-gstack/*')
git add sync-gstack/ .serena/ .gitignore
git add review/greptile-triage.md 2>/dev/null || true
```

Read the upstream VERSION for the commit message:
```bash
cat VERSION
```

Commit referencing the upstream version (replace `<VERSION>` with the value from above):
```bash
git commit -m "Sync upstream v<VERSION>: trim preamble in generator, apply React/TS template adaptations"
```

Push to the fork:
```bash
git push origin HEAD
```

### Step 7 — Create PR

Create the PR on the fork repo. Replace `<VERSION>` with the upstream version and fill in
the changelog summary from Step 1.

```bash
gh pr create --repo lucaslim/gstack-governed \
  --title "Sync upstream v<VERSION>" \
  --body "$(cat <<'EOF'
## Summary

Synced with upstream garrytan/gstack and applied governed modifications:

**Generator changes (scripts/gen-skill-docs.ts):**
- `generatePreamble()`: stripped to AskUserQuestion format only (removed update check, session tracking, contributor mode)
- `generateQAMethodology()`: removed Rails framework guidance subsection (if re-added by upstream)

**Template adaptations (.tmpl files):**
- ship: removed VERSION/CHANGELOG/eval/TODOS steps, replaced test commands, React/TS commit vocab
- review: ActiveRecord/ORM → GraphQL, Models/Controllers/Concerns → Components/Hooks/Services/Utils
- retro: Models/Controllers/Concerns → Components/Hooks/Services/Utils
- plan-eng-review: Rails errors → React/TS, added BE team request section, replaced test commands
- plan-ceo-review: same vocab as plan-eng-review
- qa + qa-only: removed Rails subsection, .gstack/ → .local-context/
- All skills: stripped Greptile integration (review comments, triage, history, reply templates)

**Stack-agnostic (passed through):** document-release, setup-browser-cookies

**Regenerated:** All SKILL.md files via `bun run gen:skill-docs`

## Upstream changes

<paste changelog diff summary from Step 1>

## Review checklist

- [ ] Generator: `generatePreamble()` outputs only AskUserQuestion format
- [ ] Generator: `generateQAMethodology()` has no Rails subsection
- [ ] Templates: no `bin/test-lane`, `npm run test`, or Rails vocabulary
- [ ] Templates: `.local-context/` used instead of `.gstack/` for QA artifacts
- [ ] Generated: `bun run gen:skill-docs --dry-run` shows all FRESH
- [ ] No Greptile references in any template or generated file
- [ ] review/greptile-triage.md deleted (if it existed upstream)
- [ ] review/checklist.md, review/TODOS-format.md untouched
- [ ] Stack-agnostic skills passed through unchanged
EOF
)"
```

### Step 8 — Report

Print:
- Upstream version synced to
- Summary of upstream changes (from CHANGELOG diff in Step 1)
- Which templates were modified vs. passed through
- Link to PR
- Reminder: after merging, deploy to the active skill install:
  ```
  cd <GSTACK_ROOT> && git checkout main && git pull && ./setup
  ```
  Where `<GSTACK_ROOT>` is whichever directory hosts gstack (e.g. `~/.claude/skills/gstack`
  for global installs, or the Conductor worktree path).

## Skill Coverage Reference

All skills and their sync treatment:

| Skill | Template | Adaptation |
|-------|----------|------------|
| gstack (root) | SKILL.md.tmpl | Preamble: strip update check + contributor mode only; .gstack/ → .local-context/ |
| browse | browse/SKILL.md.tmpl | Preamble trim via generator; .gstack/ → .local-context/ |
| ship | ship/SKILL.md.tmpl | Remove VERSION/CHANGELOG/eval/TODOS; React/TS vocab; test cmds |
| review | review/SKILL.md.tmpl | ActiveRecord → GraphQL; Models/Controllers → Components/Hooks |
| retro | retro/SKILL.md.tmpl | Models/Controllers/Concerns → Components/Hooks/Services/Utils |
| plan-eng-review | plan-eng-review/SKILL.md.tmpl | Rails errors → React/TS; add BE team section; test cmds |
| plan-ceo-review | plan-ceo-review/SKILL.md.tmpl | Same as plan-eng-review |
| qa | qa/SKILL.md.tmpl | Remove Rails subsection; .gstack/ → .local-context/ |
| qa-only | qa-only/SKILL.md.tmpl | Same as qa |
| design-consultation | design-consultation/SKILL.md.tmpl | .gstack/ → .local-context/; strip Greptile; verify clean |
| plan-design-review | plan-design-review/SKILL.md.tmpl | .gstack/ → .local-context/; strip Greptile; verify clean |
| qa-design-review | qa-design-review/SKILL.md.tmpl | .gstack/ → .local-context/; strip Greptile; verify clean |
| document-release | document-release/SKILL.md.tmpl | Verify clean, then pass through |
| setup-browser-cookies | setup-browser-cookies/SKILL.md.tmpl | Verify clean, then pass through |
| sync-gstack | sync-gstack/SKILL.md.tmpl | Preamble via generator; filesystem paths use gstack not gstack-governed |
| (any new upstream skill) | (detect in 4h) | Verify clean, adapt if needed |

**Not generated from template:** review/checklist.md, review/TODOS-format.md — maintained directly in the fork.
