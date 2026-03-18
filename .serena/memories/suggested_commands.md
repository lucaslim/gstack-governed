# Suggested Commands

## Development
- `bun install` — install dependencies
- `bun run gen:skill-docs` — regenerate SKILL.md files from .tmpl templates
- `bun run build` — gen docs + compile browse binary
- `bun run dev <cmd>` — run CLI in dev mode (e.g. `bun run dev goto https://example.com`)
- `bun run skill:check` — health dashboard for all skills
- `bun run dev:skill` — watch mode: auto-regen + validate on change

## Testing
- `bun test` — run free tests (browse + snapshot + skill validation + gen-skill-docs)
  - Note: `bun test` with no args finds no files; use the package.json script which specifies paths
  - Explicit: `bun test test/skill-validation.test.ts test/gen-skill-docs.test.ts test/skill-parser.test.ts`
- `bun run test:evals` — paid evals: LLM judge + E2E (~$4/run, needs ANTHROPIC_API_KEY)
- `bun run test:e2e` — E2E tests only (~$3.85/run)

## Eval analysis
- `bun run eval:list` — list all eval runs
- `bun run eval:compare` — compare two eval runs
- `bun run eval:summary` — aggregate stats

## Setup
- `./setup` — one-time setup: build binary + symlink skills

## Git / GitHub
- PRs target the fork: `gh pr create --repo lucaslim/gstack-governed`
- Upstream: `git remote add upstream https://github.com/garrytan/gstack.git`
- Deploy after merge: `cd ~/.claude/skills/gstack && git fetch origin && git reset --hard origin/main && bun run build`
