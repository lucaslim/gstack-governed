/**
 * Stack overlay — all fork customizations for lucaslim/gstack-governed.
 *
 * This file is the ONLY place where fork-specific behavior is defined.
 * Upstream templates are kept pristine; Claude adapts them via the
 * adaptation prompt during `gen:skill-docs --adapt`.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TemplateContext } from './gen-skill-docs';

const ROOT = path.resolve(import.meta.dir, '..');

// ─── Fork-only resolver: SERENA_SETUP ────────────────────────

function generateSerenaSetup(_ctx: TemplateContext): string {
  return `## Serena Code Navigation (optional, reduces token usage)

If Serena MCP tools are available (\`mcp__serena__*\`), prefer them for code lookup tasks.
They provide symbol-level precision that avoids reading entire files.

**Activation (run once at start):**
Try \`mcp__serena__activate_project\` with the repo root path. If it succeeds, Serena
is active. If it fails or the tool is unavailable, skip all Serena tools and use
Grep + Read instead.

**If activation succeeds but symbol lookups return empty results:** Run
\`mcp__serena__onboarding\` once — Serena needs a one-time index build per project.

**When Serena is active, prefer these patterns:**

| Task | Without Serena | With Serena |
|------|---------------|-------------|
| Understand file structure | Read the whole file | \`get_symbols_overview\` (~90% fewer tokens) |
| Find where a symbol is used | Grep for name → Read each file | \`find_referencing_symbols\` (returns snippets only) |
| Read a specific function | Read the whole file | \`find_symbol\` with \`include_body=true\` |
| Search for a pattern | Grep | \`search_for_pattern\` (equivalent) |

**Fallback rule:** If any Serena tool call fails, fall back to Grep + Read for that
operation. Do not retry — switch immediately.`;
}

// ─── Overlay type ────────────────────────────────────────────

export interface StackOverlay {
  /** Fork-only resolvers (e.g. SERENA_SETUP — doesn't exist upstream) */
  resolvers?: Record<string, (ctx: TemplateContext) => string>;
  /** Claude adaptation prompt — handles vocab, structure, frontmatter, everything */
  adaptationPrompt?: string;
  /** Template overrides — self-contained, skip adaptation (only ship) */
  templateOverrides?: Record<string, string>;
  /** Fork-only templates not in upstream's findTemplates() */
  extraTemplates?: string[];
  /** Upstream skills the fork doesn't ship */
  skipTemplates?: string[];
  /** Keyword triggers for upstream review — regex pattern → human-readable label */
  reviewTriggers?: Record<string, string>;
}

// ─── Overlay config ──────────────────────────────────────────

const promptPath = path.join(ROOT, 'scripts', 'adaptation-prompt.md');

export const overlay: StackOverlay = {
  resolvers: {
    SERENA_SETUP: generateSerenaSetup,
  },

  templateOverrides: {
    ship: 'scripts/overlays/ship-SKILL.md.tmpl',
  },

  extraTemplates: [
    'qa-design-review/SKILL.md.tmpl',
    'sync-gstack/SKILL.md.tmpl',
  ],

  skipTemplates: [
    'office-hours', 'debug', 'gstack-upgrade', 'design-review',
    'codex', 'careful', 'freeze', 'guard', 'unfreeze',
  ],

  reviewTriggers: {
    '\\brails\\b': 'Rails framework',
    '\\bruby\\b': 'Ruby language',
    '\\bactiverecord\\b': 'Rails ORM',
    '\\bturbo\\b': 'Rails Turbo',
    '\\bstimulus\\b': 'Rails Stimulus',
    '\\bgemfile\\b': 'Ruby dependency',
    '\\.rb\\b': 'Ruby file',
    '\\bgreptile\\b': 'Greptile (code review tool)',
    '\\bgstack-update-check\\b': 'gstack auto-update',
    '\\bgstack-upgrade\\b': 'gstack upgrade flow',
    '\\bgstack-diff-scope\\b': 'gstack diff-scope binary',
  },

  adaptationPrompt: fs.readFileSync(promptPath, 'utf-8'),
};

// ─── Shared template candidate list ─────────────────────────
// Single source of truth — used by adapt-templates.ts and gen-skill-docs.ts

export const TEMPLATE_CANDIDATES: string[] = [
  'SKILL.md.tmpl',
  'browse/SKILL.md.tmpl',
  'qa/SKILL.md.tmpl',
  'qa-only/SKILL.md.tmpl',
  'setup-browser-cookies/SKILL.md.tmpl',
  'ship/SKILL.md.tmpl',
  'review/SKILL.md.tmpl',
  'plan-ceo-review/SKILL.md.tmpl',
  'plan-eng-review/SKILL.md.tmpl',
  'retro/SKILL.md.tmpl',
  'plan-design-review/SKILL.md.tmpl',
  'design-consultation/SKILL.md.tmpl',
  'document-release/SKILL.md.tmpl',
];
