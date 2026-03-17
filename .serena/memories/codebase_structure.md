# Codebase Structure

```
gstack/
├── scripts/              # Build + DX tooling
│   ├── gen-skill-docs.ts # Template → SKILL.md generator (key file)
│   ├── skill-check.ts    # Health dashboard
│   └── dev-skill.ts      # Watch mode
├── browse/               # Headless browser CLI (Playwright)
│   ├── src/              # CLI + server + commands
│   │   ├── commands.ts   # Command registry (single source of truth)
│   │   └── snapshot.ts   # SNAPSHOT_FLAGS metadata array
│   ├── test/             # Integration tests + fixtures
│   └── dist/             # Compiled binary
├── test/                 # Skill validation + eval tests
│   ├── helpers/          # skill-parser.ts, session-runner.ts, llm-judge.ts, eval-store.ts
│   ├── fixtures/         # Ground truth JSON, eval baselines
│   ├── skill-validation.test.ts  # Tier 1: static validation
│   ├── gen-skill-docs.test.ts    # Tier 1: generator quality
│   └── skill-e2e.test.ts         # Tier 2: E2E via claude -p
├── ship/                 # /ship skill
├── review/               # /review skill (+ checklist.md, TODOS-format.md maintained directly)
├── retro/                # /retro skill
├── qa/ + qa-only/        # QA skills
├── plan-eng-review/      # /plan-eng-review skill
├── plan-ceo-review/      # /plan-ceo-review skill
├── sync-gstack/          # /sync-gstack skill (fork-only, not in upstream)
├── document-release/     # /document-release skill
├── gstack-upgrade/       # /gstack-upgrade skill
├── setup-browser-cookies/# Cookie import skill
├── SKILL.md.tmpl         # Root skill template
└── SKILL.md              # Generated from template (don't edit)
```

## Key files
- `scripts/gen-skill-docs.ts` — the generator; resolver functions for all placeholders
- `browse/src/commands.ts` — command registry; add new browse commands here
- `browse/src/snapshot.ts` — SNAPSHOT_FLAGS metadata array
- `*/SKILL.md.tmpl` — source of truth for each skill's documentation
- `review/checklist.md`, `review/TODOS-format.md` — maintained directly (not generated)
