#!/usr/bin/env bash
# Sync fork with upstream gstack.
#
# Usage:
#   bun run sync                  # full sync (fetch + merge + adapt + gen + test)
#   bun run sync -- --skip-adapt  # skip Claude adaptation (just merge + gen + test)
#   bun run sync -- --adapt-only  # skip merge, just re-adapt + gen + test
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_ADAPT=false
ADAPT_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-adapt) SKIP_ADAPT=true ;;
    --adapt-only) ADAPT_ONLY=true ;;
  esac
done

echo "╔══════════════════════════════════════╗"
echo "║       gstack upstream sync           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── Step 1: Fetch upstream ───────────────────────────────────
if [ "$ADAPT_ONLY" = false ]; then
  echo "→ Step 1: Fetching upstream..."
  git fetch upstream
  echo ""

  # ─── Step 2: Merge upstream/main ──────────────────────────────
  echo "→ Step 2: Merging upstream/main..."
  PRE_MERGE=$(git rev-parse HEAD)
  echo "$PRE_MERGE" > .git/gstack-sync-base
  if ! git merge upstream/main --no-edit; then
    echo ""
    echo "⚠ Merge conflicts detected. Resolve them, then re-run:"
    echo "  bun run sync -- --adapt-only"
    exit 1
  fi
  echo ""
fi

# ─── Step 3: Adapt templates ───────────────────────────────────
if [ "$SKIP_ADAPT" = false ]; then
  echo "→ Step 3: Adapting templates (Claude)..."
  REVIEW_BASE="${PRE_MERGE:-$(cat .git/gstack-sync-base 2>/dev/null || echo ORIG_HEAD)}"
  bun run scripts/adapt-templates.ts --review --review-base "$REVIEW_BASE"
  echo ""
else
  echo "→ Step 3: Skipped (--skip-adapt)"
  echo ""
fi

# ─── Step 4: Regenerate SKILL.md ──────────────────────────────
echo "→ Step 4: Regenerating SKILL.md files..."
bun run gen:skill-docs
echo ""

# ─── Step 5: Verify ──────────────────────────────────────────
echo "→ Step 5: Verifying..."
bun run gen:skill-docs -- --dry-run
echo ""

echo "→ Step 6: Running tests..."
bun test test/stack-overlay.test.ts test/skill-validation.test.ts test/gen-skill-docs.test.ts
echo ""

echo "╔══════════════════════════════════════╗"
echo "║       Sync complete ✓                ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Next: review changes, commit, and create PR."
