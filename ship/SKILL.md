---
name: ship
version: 1.0.0
model: sonnet
description: |
  Ship workflow: detect + merge base branch, run tests, review diff, commit, push, create PR.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - mcp__serena__activate_project
  - mcp__serena__get_symbols_overview
  - mcp__serena__find_symbol
  - mcp__serena__find_referencing_symbols
  - mcp__serena__search_for_pattern
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**
1. **Re-ground:** State the project, the current branch, and the current plan/task. (1-2 sentences)
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow. No raw function names, no internal jargon, no implementation details. Use concrete examples and analogies. Say what it DOES, not what it's called.
3. **Recommend:** \`RECOMMENDATION: Choose [X] because [one-line reason]\`
4. **Options:** Lettered options: \`A) ... B) ... C) ...\`

Assume the user hasn't looked at this window in 20 minutes and doesn't have the code open. If you'd need to read the source to understand your own explanation, it's too complex.

Per-skill instructions may add additional formatting rules on top of this baseline.

## Serena Code Navigation (optional, reduces token usage)

If Serena MCP tools are available (`mcp__serena__*`), prefer them for code lookup tasks.
They provide symbol-level precision that avoids reading entire files.

**Activation (run once at start):**
Try `mcp__serena__activate_project` with the repo root path. If it succeeds, Serena
is active. If it fails or the tool is unavailable, skip all Serena tools and use
Grep + Read instead.

**If activation succeeds but symbol lookups return empty results:** Run
`mcp__serena__onboarding` once — Serena needs a one-time index build per project.

**When Serena is active, prefer these patterns:**

| Task | Without Serena | With Serena |
|------|---------------|-------------|
| Understand file structure | Read the whole file | `get_symbols_overview` (~90% fewer tokens) |
| Find where a symbol is used | Grep for name → Read each file | `find_referencing_symbols` (returns snippets only) |
| Read a specific function | Read the whole file | `find_symbol` with `include_body=true` |
| Search for a pattern | Grep | `search_for_pattern` (equivalent) |

**Fallback rule:** If any Serena tool call fails, fall back to Grep + Read for that
operation. Do not retry — switch immediately.

## Step 0: Detect base branch

Determine which branch this PR targets. Use the result as "the base branch" in all subsequent steps.

1. Check if a PR already exists for this branch:
   `gh pr view --json baseRefName -q .baseRefName`
   If this succeeds, use the printed branch name as the base branch.

2. If no PR exists (command fails), detect the repo's default branch:
   `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`

3. If both commands fail, fall back to `main`.

Print the detected base branch name. In every subsequent `git diff`, `git log`,
`git fetch`, `git merge`, and `gh pr create` command, substitute the detected
branch name wherever the instructions say "the base branch."

---

# Ship: Fully Automated Ship Workflow

You are running the `/ship` workflow. This is a **non-interactive, fully automated** workflow. Do NOT ask for confirmation at any step. The user said `/ship` which means DO IT. Run straight through and output the PR URL at the end.

**Only stop for:**
- On the base branch (abort)
- Merge conflicts that can't be auto-resolved (stop, show conflicts)
- Test failures (stop, show failures)
- Pre-landing review finds ASK items that need user judgment

**Never stop for:**
- Uncommitted changes (always include them)
- Commit message approval (auto-commit)
- Multi-file changesets (auto-split into bisectable commits)
- Auto-fixable review findings (dead code, N+1, stale comments — fixed automatically)

---

## Step 1: Pre-flight

1. Check the current branch. If on the base branch or the repo's default branch, **abort**: "You're on the base branch. Ship from a feature branch."

2. Run `git status` (never use `-uall`). Uncommitted changes are always included — no need to ask.

3. Run `git diff <base>...HEAD --stat` and `git log <base>..HEAD --oneline` to understand what's being shipped.

---

## Step 2: Merge the base branch (BEFORE tests)

Fetch and merge the base branch into the feature branch so tests run against the merged state:

```bash
git fetch origin <base> && git merge origin/<base> --no-edit
```

**If there are merge conflicts:** Try to auto-resolve if they are simple (lock files, config file ordering). If conflicts are complex or ambiguous, **STOP** and show them.

**If already up to date:** Continue silently.

---

## Step 3: Run tests (on merged code)

Run the project's test/lint/typecheck commands from CLAUDE.local.md "Project Scripts" table.

Run all test suites in parallel where possible, piping output to temp files for review:

```bash
# Run project's test commands from CLAUDE.local.md in parallel
# Example: project_test_cmd 2>&1 | tee /tmp/ship_tests.txt &
# Wait for all to complete
wait
```

After all complete, read the output files and check pass/fail.

**If any test fails:** Show the failures and **STOP**. Do not proceed.

**If all pass:** Continue silently — just note the counts briefly.

---

## Step 3.5: Pre-Landing Review

Review the diff for structural issues that tests don't catch.

1. Read `.claude/skills/review/checklist.md`. If the file cannot be read, **STOP** and report the error.

2. Run `git diff origin/<base>` to get the full diff (scoped to feature changes against the freshly-fetched base branch).

3. Apply the review checklist in two passes:
   - **Pass 1 (CRITICAL):** SQL & Data Safety, LLM Output Trust Boundary
   - **Pass 2 (INFORMATIONAL):** All remaining categories

4. **Classify each finding as AUTO-FIX or ASK** per the Fix-First Heuristic in
   checklist.md. Critical findings lean toward ASK; informational lean toward AUTO-FIX.

5. **Auto-fix all AUTO-FIX items.** Apply each fix. Output one line per fix:
   `[AUTO-FIXED] [file:line] Problem → what you did`

6. **If ASK items remain,** present them in ONE AskUserQuestion:
   - List each with number, severity, problem, recommended fix
   - Per-item options: A) Fix  B) Skip
   - Overall RECOMMENDATION
   - If 3 or fewer ASK items, you may use individual AskUserQuestion calls instead

7. **After all fixes (auto + user-approved):**
   - If ANY fixes were applied: commit fixed files by name (`git add <fixed-files> && git commit -m "fix: pre-landing review fixes"`), then **STOP** and tell the user to run `/ship` again to re-test.
   - If no fixes applied (all ASK items skipped, or no issues found): continue to Step 5.

8. Output summary: `Pre-Landing Review: N issues — M auto-fixed, K asked (J fixed, L skipped)`

   If no issues found: `Pre-Landing Review: No issues found.`

Save the review output — it goes into the PR body in Step 7.

---

## Step 5: Commit (bisectable chunks)

**Goal:** Create small, logical commits that work well with `git bisect` and help LLMs understand what changed.

1. Analyze the diff and group changes into logical commits. Each commit should represent **one coherent change** — not one file, but one logical unit.

2. **Commit ordering** (earlier commits first):
   - **Infrastructure:** schema changes, config changes, route additions
   - **Components & hooks:** new components, hooks, utilities (with their tests)
   - **Pages & routes:** pages, routes, layouts (with their tests)

3. **Rules for splitting:**
   - A component and its test file go in the same commit
   - A hook/utility and its test file go in the same commit
   - A page, its sub-components, and its test go in the same commit
   - Schema changes are their own commit (or grouped with the component they support)
   - Config/route changes can group with the feature they enable
   - If the total diff is small (< 50 lines across < 4 files), a single commit is fine

4. **Each commit must be independently valid** — no broken imports, no references to code that doesn't exist yet. Order commits so dependencies come first.

5. Compose each commit message:
   - First line: `<type>: <summary>` (type = feat/fix/chore/refactor/docs)
   - Body: brief description of what this commit contains
   - The **final commit** gets the co-author trailer:

```bash
git commit -m "$(cat <<'EOF'
chore: finalize feature

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Step 6: Push

Push to the remote with upstream tracking:

```bash
git push -u origin <branch-name>
```

---

## Step 7: Create PR

Create a pull request using `gh`:

```bash
gh pr create --base <base> --title "<type>: <summary>" --body "$(cat <<'EOF'
## Summary
<bullet points summarizing the changes from the diff and commit history>

## Pre-Landing Review
<findings from Step 3.5, or "No issues found.">

## Test plan
- [x] All tests pass (N tests)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Output the PR URL** — this should be the final output the user sees.

---

## Important Rules

- **Never skip tests.** If tests fail, stop.
- **Never skip the pre-landing review.** If checklist.md is unreadable, stop.
- **Never force push.** Use regular `git push` only.
- **Never ask for confirmation** except for pre-landing review ASK items (batched into at most one AskUserQuestion).
- **Split commits for bisectability** — each commit = one logical change.
- **The goal is: user says `/ship`, next thing they see is the review + PR URL.**
