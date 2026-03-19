#!/usr/bin/env bun
/**
 * Patch gen-skill-docs.ts to integrate the fork's overlay system.
 *
 * After an upstream merge (which takes upstream's version), this script
 * re-applies the fork-specific changes:
 *   1. Adds `import { overlay, TEMPLATE_CANDIDATES } from './stack-overlay'`
 *   2. Merges overlay resolvers into the RESOLVERS map
 *   3. Replaces findTemplates() to use TEMPLATE_CANDIDATES + overlay skip/extras
 *   4. Patches processTemplate() to support template overrides
 *   5. Exports TemplateContext for stack-overlay.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const FILE = path.join(ROOT, 'scripts', 'gen-skill-docs.ts');

let content = fs.readFileSync(FILE, 'utf-8');

// 1. Add overlay import (after the last existing import)
if (!content.includes("from './stack-overlay'")) {
  content = content.replace(
    /(import .+ from ['"][^'"]+['"];?\n)(?!import)/,
    "$1import { overlay, TEMPLATE_CANDIDATES } from './stack-overlay';\n",
  );
  console.log('  PATCHED: added overlay import');
}

// 2. Export TemplateContext
if (!content.includes('export interface TemplateContext')) {
  content = content.replace(
    /interface TemplateContext/,
    'export interface TemplateContext',
  );
  console.log('  PATCHED: exported TemplateContext');
}

// 3. Add overlay resolver merge (after RESOLVERS declaration)
if (!content.includes('overlay?.resolvers')) {
  content = content.replace(
    /(const RESOLVERS[^;]+;\n)/,
    "$1\n// Merge overlay resolvers (fork-only, e.g. SERENA_SETUP override)\nif (overlay?.resolvers) {\n  for (const [name, fn] of Object.entries(overlay.resolvers)) {\n    RESOLVERS[name] = fn;\n  }\n}\n",
  );
  console.log('  PATCHED: added overlay resolver merge');
}

// 4. Replace findTemplates() to use TEMPLATE_CANDIDATES + overlay
if (!content.includes('TEMPLATE_CANDIDATES.map')) {
  const findTemplatesRegex =
    /function findTemplates\(\)[^{]*\{[\s\S]*?return templates;\s*\}/;
  const replacement = `function findTemplates(): string[] {
  const templates: string[] = [];
  const candidateSet = new Set(
    TEMPLATE_CANDIDATES.map((rel) => path.join(ROOT, rel)),
  );

  // Add extra templates from overlay (fork-only skills)
  if (overlay?.extraTemplates) {
    for (const extra of overlay.extraTemplates) {
      candidateSet.add(path.join(ROOT, extra));
    }
  }

  const skipSet = new Set(overlay?.skipTemplates ?? []);

  for (const p of candidateSet) {
    if (!fs.existsSync(p)) continue;

    // Check skip list (overlay says fork doesn't ship these)
    const dir = path.basename(path.dirname(p));
    const skillName = dir === path.basename(ROOT) ? 'gstack' : dir;
    if (skipSet.has(skillName)) continue;

    templates.push(p);
  }
  return templates;
}`;

  if (findTemplatesRegex.test(content)) {
    content = content.replace(findTemplatesRegex, replacement);
    console.log('  PATCHED: replaced findTemplates() with overlay-aware version');
  }
}

// 5. Patch processTemplate() to support template overrides
if (!content.includes('templateOverrides')) {
  content = content.replace(
    /function processTemplate\(tmplPath: string\)[^{]*\{[\s]*\n\s*const tmplContent/,
    `function processTemplate(tmplPath: string): { outputPath: string; content: string } {
  // Determine skill name for overlay lookups
  const dir = path.basename(path.dirname(tmplPath));
  const skillName = dir === path.basename(ROOT) ? 'gstack' : dir;

  // Check for template override (e.g. ship → scripts/overlays/ship-SKILL.md.tmpl)
  const overrideTmpl = overlay?.templateOverrides?.[skillName];
  const actualPath = overrideTmpl ? path.join(ROOT, overrideTmpl) : tmplPath;

  const tmplContent`,
  );
  // Also patch to use actualPath instead of tmplPath for reading
  content = content.replace(
    /const tmplContent = fs\.readFileSync\(tmplPath/,
    'const tmplContent = fs.readFileSync(actualPath',
  );
  console.log('  PATCHED: added template override support to processTemplate()');
}

fs.writeFileSync(FILE, content);
console.log('  gen-skill-docs.ts patched successfully.');
