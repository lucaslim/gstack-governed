# Task Completion Checklist

Before marking any task complete:

1. **If templates were edited:** Run `bun run gen:skill-docs` to regenerate SKILL.md files
2. **Run tests:** `bun test test/skill-validation.test.ts test/gen-skill-docs.test.ts test/skill-parser.test.ts`
3. **Verify no leaked vocabulary** (for sync tasks):
   ```bash
   grep -rn '_UPD=\|Contributor Mode\|bin/test-lane\|ActiveRecord\|Controllers & views\|greptile' */SKILL.md SKILL.md
   ```
4. **Commit both `.tmpl` and generated `.md` files** — never one without the other
5. **Never edit SKILL.md directly** — always edit the `.tmpl` source
