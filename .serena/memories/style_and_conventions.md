# Code Style and Conventions

## Language & Runtime
- TypeScript with Bun runtime
- No React in this repo (it's a CLI/skill-template project) but skills target React/TS stacks

## SKILL template conventions
- Templates are `.tmpl` files with YAML frontmatter (name, version, description, allowed-tools)
- Placeholders like `{{PREAMBLE}}`, `{{COMMAND_REFERENCE}}` are resolved by gen-skill-docs.ts
- Each bash code block runs in a separate shell — variables don't persist between blocks
- Use natural language for logic/state between code blocks, not shell variables
- Don't hardcode branch names — detect dynamically via `gh pr view` or `gh repo view`
- Use `{{BASE_BRANCH_DETECT}}` for PR-targeting skills

## Generator conventions
- `scripts/gen-skill-docs.ts` is the single source of truth for SKILL.md generation
- Resolver functions: `generatePreamble()`, `generateQAMethodology()`, `generateCommandReference()`, etc.
- `RESOLVERS` constant maps placeholder names to generator functions

## Test conventions
- Tests use Bun's built-in test runner
- Tier 1: skill-validation, gen-skill-docs, skill-parser (free, fast)
- Tier 2: E2E via `claude -p` (~$3.85/run)
- Tier 3: LLM-as-judge (~$0.15/run)

## Commit style
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- No Co-Authored-By trailers (per CLAUDE.md)
- One task per commit
