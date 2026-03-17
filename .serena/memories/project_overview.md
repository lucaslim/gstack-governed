# Project Overview: gstack-governed

A **governed fork** of `garrytan/gstack` — a suite of Claude Code agent skills for software engineering workflows.

## What it does
- Provides slash-command skills (`/ship`, `/review`, `/qa`, `/retro`, `/plan-eng-review`, `/plan-ceo-review`, `/browse`, etc.)
- Each skill is a prompt template (`.tmpl`) that gets compiled to `SKILL.md` by `scripts/gen-skill-docs.ts`
- Includes a headless browser CLI (`browse/`) built on Playwright for QA testing

## Fork modifications (governed trims)
The fork strips Rails/Ruby-specific content from upstream and adapts for **React/TypeScript** stacks:
- `generatePreamble()` stripped to AskUserQuestion format only (no update checks, session tracking, contributor mode)
- `generateQAMethodology()` has no `### Rails` subsection; SPA vocab used instead
- Template vocab: "Components/Hooks/Services/Utils" instead of "Models/Controllers/Concerns"
- `.gstack/` paths → `.local-context/`
- All Greptile integration removed (upstream uses Greptile for code review; fork does not)
- `bin/test-lane` / `npm run test` → project's own test commands from CLAUDE.local.md

## Upstream remote
- Fork: `lucaslim/gstack-governed`
- Upstream: `garrytan/gstack`
- PRs always target the fork (`--repo lucaslim/gstack-governed`), never upstream

## Key architecture
- SKILL.md files are **generated** — never edit them directly
- Edit `.tmpl` templates + run `bun run gen:skill-docs` (or `bun run build`)
- Generator (`scripts/gen-skill-docs.ts`) has resolver functions expanding placeholders like `{{PREAMBLE}}`, `{{COMMAND_REFERENCE}}`, `{{QA_METHODOLOGY}}`
