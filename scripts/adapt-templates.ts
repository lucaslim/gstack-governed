#!/usr/bin/env bun
/**
 * Adapt upstream .tmpl files for the React/TS/GraphQL fork.
 *
 * Two-phase flow:
 *   Phase A (--review): sequential, interactive — diff upstream changes,
 *     classify blocks, prompt user for flagged content
 *   Phase B: parallel, non-interactive — run Claude adaptation with decisions
 *
 * Usage:
 *   bun run adapt-templates                           # adapt all (no review)
 *   bun run adapt-templates --review                  # review + adapt
 *   bun run adapt-templates --review --review-base HEAD~1  # custom base ref
 *   bun run adapt-templates --no-review               # explicit skip review
 *   bun run adapt-templates plan-eng-review            # adapt one template
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { overlay, TEMPLATE_CANDIDATES } from './stack-overlay';
import { adaptWithClaude, type AdaptDecisions } from './adapt-skills';

const ROOT = path.resolve(import.meta.dir, '..');

// ─── Types ──────────────────────────────────────────────────

export interface DiffBlock {
  /** Label from nearest heading or first non-empty line */
  label: string;
  /** The added lines (without leading +) */
  lines: string[];
}

export interface ClassifiedBlocks {
  autoKept: DiffBlock[];
  flagged: Array<DiffBlock & { trigger: string; triggerLabel: string }>;
}

// ─── Template discovery ─────────────────────────────────────

function findAdaptableTemplates(filter?: string): string[] {
  const skip = new Set(overlay.skipTemplates ?? []);
  const overrides = new Set(Object.keys(overlay.templateOverrides ?? {}));
  const extras = new Set(
    (overlay.extraTemplates ?? []).map((e) => path.join(ROOT, e)),
  );

  const result: string[] = [];
  for (const rel of TEMPLATE_CANDIDATES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;

    const dir = path.basename(path.dirname(full));
    const skillName = dir === path.basename(ROOT) ? 'gstack' : dir;

    if (skip.has(skillName)) continue;

    if (overrides.has(skillName)) {
      console.log(`  SKIP (override): ${skillName}`);
      continue;
    }

    if (extras.has(full)) {
      console.log(`  SKIP (extra): ${skillName}`);
      continue;
    }

    if (filter && skillName !== filter) continue;

    result.push(full);
  }

  return result;
}

// ─── Diff extraction ────────────────────────────────────────

function getUpstreamDiff(tmplPath: string, base: string): DiffBlock[] {
  const relPath = path.relative(ROOT, tmplPath);
  let diffOutput: string;
  try {
    diffOutput = execFileSync('git', ['diff', `${base}..HEAD`, '--', relPath], {
      cwd: ROOT,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return [];
  }

  if (!diffOutput.trim()) return [];

  // Parse added blocks: contiguous runs of + lines (excluding +++ header)
  const diffLines = diffOutput.split('\n');
  const blocks: DiffBlock[] = [];
  let currentLines: string[] = [];
  let nearestHeading = '';

  for (const line of diffLines) {
    // Track nearest heading from context lines for labeling
    if (
      (line.startsWith(' ') || line.startsWith('+')) &&
      /^[+ ]#{1,4}\s/.test(line)
    ) {
      nearestHeading = line.replace(/^[+ ]#+\s*/, '').trim();
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentLines.push(line.slice(1)); // strip leading +
    } else {
      if (currentLines.length > 0) {
        const label =
          nearestHeading ||
          currentLines.find((l) => l.trim())?.trim().slice(0, 60) ||
          '(unnamed block)';
        blocks.push({ label, lines: [...currentLines] });
        currentLines = [];
      }
    }
  }

  // Flush last block
  if (currentLines.length > 0) {
    const label =
      nearestHeading ||
      currentLines.find((l) => l.trim())?.trim().slice(0, 60) ||
      '(unnamed block)';
    blocks.push({ label, lines: [...currentLines] });
  }

  return blocks;
}

// ─── Classification ─────────────────────────────────────────

export function classifyBlocks(
  blocks: DiffBlock[],
  triggers?: Record<string, string>,
): ClassifiedBlocks {
  const triggerMap = triggers ?? overlay.reviewTriggers ?? {};
  const compiled = Object.entries(triggerMap).map(([pattern, label]) => ({
    re: new RegExp(pattern, 'i'),
    pattern,
    label,
  }));

  const result: ClassifiedBlocks = { autoKept: [], flagged: [] };

  for (const block of blocks) {
    const text = block.lines.join('\n');
    let matched = false;

    for (const { re, pattern, label } of compiled) {
      if (re.test(text)) {
        result.flagged.push({
          ...block,
          trigger: pattern,
          triggerLabel: label,
        });
        matched = true;
        break; // first match wins
      }
    }

    if (!matched) {
      result.autoKept.push(block);
    }
  }

  return result;
}

// ─── Review summary ─────────────────────────────────────────

function buildDecisions(
  templateName: string,
  classified: ClassifiedBlocks,
): AdaptDecisions {
  const decisions: AdaptDecisions = { removals: [], overrideKeeps: [] };

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log(`║   Upstream changes: ${templateName.padEnd(17)}║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (classified.autoKept.length > 0) {
    console.log('  KEPT (generic):');
    for (const block of classified.autoKept) {
      console.log(
        `    + ${JSON.stringify(block.label)} (${block.lines.length} lines)`,
      );
    }
    console.log('');
  }

  if (classified.flagged.length === 0) {
    console.log('  No flagged content — all new blocks are generic.');
    return decisions;
  }

  console.log('  REMOVED (flagged):');
  for (const block of classified.flagged) {
    console.log(
      `    - ${JSON.stringify(block.label)} (${block.lines.length} lines) [${block.triggerLabel}]`,
    );
    decisions.removals.push(block.label);
  }
  console.log('');

  return decisions;
}

// ─── Arg parsing ────────────────────────────────────────────

function parseArgs(): {
  filter?: string;
  review: boolean;
  reviewBase: string;
  keepOverrides: string[];
} {
  const args = process.argv.slice(2);
  let review = false;
  let reviewBase = 'ORIG_HEAD';
  let filter: string | undefined;
  const keepOverrides: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--review') {
      review = true;
    } else if (arg === '--no-review') {
      review = false;
    } else if (arg === '--review-base') {
      reviewBase = args[++i] ?? 'ORIG_HEAD';
    } else if (arg === '--keep') {
      keepOverrides.push(args[++i] ?? '');
    } else if (!arg.startsWith('-')) {
      filter = arg;
    }
  }

  return { filter, review, reviewBase, keepOverrides };
}

// ─── Skill name helper ──────────────────────────────────────

function skillNameFor(tmplPath: string): string {
  const dir = path.basename(path.dirname(tmplPath));
  return dir === path.basename(ROOT) ? 'gstack' : dir;
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const { filter, review, reviewBase, keepOverrides } = parseArgs();
  const prompt = overlay.adaptationPrompt;

  if (!prompt) {
    console.error('ERROR: No adaptation prompt found in overlay');
    process.exit(1);
  }

  const templates = findAdaptableTemplates(filter);

  if (templates.length === 0) {
    console.error(
      filter ? `No template found for: ${filter}` : 'No templates to adapt',
    );
    process.exit(1);
  }

  // ── Phase A: Review (classify upstream changes) ─────────────

  const decisionsMap = new Map<string, AdaptDecisions>();

  if (review) {
    console.log(`Reviewing upstream changes (base: ${reviewBase})...\n`);

    let anyChanges = false;
    for (const tmplPath of templates) {
      const skillName = skillNameFor(tmplPath);
      const blocks = getUpstreamDiff(tmplPath, reviewBase);

      if (blocks.length === 0) continue;
      anyChanges = true;

      const classified = classifyBlocks(blocks);

      // Move --keep overrides from flagged → autoKept
      if (keepOverrides.length > 0) {
        const kept: typeof classified.flagged = [];
        for (const block of classified.flagged) {
          if (keepOverrides.some((k) => block.label.toLowerCase().includes(k.toLowerCase()))) {
            classified.autoKept.push(block);
          } else {
            kept.push(block);
          }
        }
        classified.flagged = kept;
      }

      const decisions = buildDecisions(skillName, classified);
      decisionsMap.set(tmplPath, decisions);
    }

    if (!anyChanges) {
      console.log('No new upstream content detected in templates.\n');
    }
  }

  // ── Phase B: Adapt (parallel, non-interactive) ─────────────

  console.log(`Adapting ${templates.length} template(s)...\n`);

  const results = await Promise.allSettled(
    templates.map(async (tmplPath) => {
      const content = fs.readFileSync(tmplPath, 'utf-8');
      const skillName = skillNameFor(tmplPath);
      const decisions = decisionsMap.get(tmplPath);

      const adapted = await adaptWithClaude(
        content,
        skillName,
        prompt,
        decisions,
      );
      fs.writeFileSync(tmplPath, adapted);
      console.log(`  WROTE: ${path.relative(ROOT, tmplPath)}`);
    }),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error(`\n${failed.length} template(s) failed:`);
    for (const f of failed) {
      console.error(`  ${(f as PromiseRejectedResult).reason}`);
    }
    process.exit(1);
  }

  console.log(
    `\nDone. Run 'bun run gen:skill-docs' to regenerate SKILL.md files.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
