import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { classifyBlocks, type DiffBlock } from '../scripts/adapt-templates';

const ROOT = path.resolve(import.meta.dir, '..');

describe('stack-overlay', () => {
  test('overlay module loads without error', async () => {
    const { overlay } = await import('../scripts/stack-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.resolvers).toBeDefined();
    expect(overlay.templateOverrides).toBeDefined();
    expect(overlay.extraTemplates).toBeDefined();
    expect(overlay.skipTemplates).toBeDefined();
    expect(overlay.adaptationPrompt).toBeDefined();
  });

  test('SERENA_SETUP resolver produces expected content', async () => {
    const { overlay } = await import('../scripts/stack-overlay');
    const resolver = overlay.resolvers!['SERENA_SETUP'];
    expect(resolver).toBeDefined();
    const ctx = { skillName: 'test', tmplPath: '/tmp/test.tmpl' };
    const content = resolver(ctx);
    expect(content).toContain('Serena Code Navigation');
    expect(content).toContain('mcp__serena__activate_project');
    expect(content).toContain('get_symbols_overview');
    expect(content).toContain('Fallback rule');
  });

  test('ship template override file exists', async () => {
    const { overlay } = await import('../scripts/stack-overlay');
    const shipPath = overlay.templateOverrides!['ship'];
    expect(shipPath).toBeDefined();
    expect(fs.existsSync(path.join(ROOT, shipPath))).toBe(true);
  });

  test('ship override template has correct frontmatter', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'scripts', 'overlays', 'ship-SKILL.md.tmpl'),
      'utf-8',
    );
    expect(content).toContain('name: ship');
    expect(content).toContain('model: sonnet');
    expect(content).toContain('mcp__serena__activate_project');
    // Ship override should have behavioral differences (rebase, not merge)
    expect(content).toContain('git rebase');
  });

  test('extra templates exist on disk', async () => {
    const { overlay } = await import('../scripts/stack-overlay');
    for (const tmpl of overlay.extraTemplates ?? []) {
      const fullPath = path.join(ROOT, tmpl);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  test('skip templates list is non-empty', async () => {
    const { overlay } = await import('../scripts/stack-overlay');
    expect(overlay.skipTemplates!.length).toBeGreaterThan(0);
    expect(overlay.skipTemplates).toContain('office-hours');
    expect(overlay.skipTemplates).toContain('codex');
  });

  test('adaptation prompt contains required sections', async () => {
    const { overlay } = await import('../scripts/stack-overlay');
    const prompt = overlay.adaptationPrompt!;
    expect(prompt).toContain('Stack Identity');
    expect(prompt).toContain('Vocabulary Mapping');
    expect(prompt).toContain('Structural Changes');
    expect(prompt).toContain('Frontmatter Injection');
    expect(prompt).toContain('Deep Framework Steering');
    expect(prompt).toContain('Output Rules');
    // Key vocabulary items
    expect(prompt).toContain('Models → Components');
    expect(prompt).toContain('rescue → catch');
    expect(prompt).toContain('ActiveRecord::RecordNotFound → NotFoundError');
    expect(prompt).toContain('Waterfall requests');
    // Model assignments
    expect(prompt).toContain('review: opus');
    expect(prompt).toContain('qa: sonnet');
    expect(prompt).toContain('setup-browser-cookies: haiku');
  });

  test('adaptation prompt file exists and matches overlay', () => {
    const promptFromFile = fs.readFileSync(
      path.join(ROOT, 'scripts', 'adaptation-prompt.md'),
      'utf-8',
    );
    expect(promptFromFile.length).toBeGreaterThan(1000);
    expect(promptFromFile).toContain('React');
    expect(promptFromFile).toContain('TypeScript');
    expect(promptFromFile).toContain('GraphQL');
  });

  test('adapt-templates script exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'scripts', 'adapt-templates.ts'))).toBe(true);
  });

  test('adapt-skills module exports adaptWithClaude', async () => {
    const mod = await import('../scripts/adapt-skills');
    expect(typeof mod.adaptWithClaude).toBe('function');
  });

  test('reviewTriggers is defined and non-empty', async () => {
    const { overlay } = await import('../scripts/stack-overlay');
    expect(overlay.reviewTriggers).toBeDefined();
    expect(Object.keys(overlay.reviewTriggers!).length).toBeGreaterThan(0);
    // Spot-check a few triggers
    expect(overlay.reviewTriggers!['\\brails\\b']).toBe('Rails framework');
    expect(overlay.reviewTriggers!['\\bgreptile\\b']).toBe(
      'Greptile (code review tool)',
    );
  });

  test('TEMPLATE_CANDIDATES is exported and non-empty', async () => {
    const { TEMPLATE_CANDIDATES } = await import('../scripts/stack-overlay');
    expect(TEMPLATE_CANDIDATES).toBeDefined();
    expect(TEMPLATE_CANDIDATES.length).toBeGreaterThan(0);
    expect(TEMPLATE_CANDIDATES).toContain('SKILL.md.tmpl');
    expect(TEMPLATE_CANDIDATES).toContain('review/SKILL.md.tmpl');
  });
});

describe('classifyBlocks', () => {
  const triggers: Record<string, string> = {
    '\\brails\\b': 'Rails framework',
    '\\bruby\\b': 'Ruby language',
    '\\bgreptile\\b': 'Greptile (code review tool)',
    '\\.rb\\b': 'Ruby file',
  };

  test('no triggers → all blocks auto-kept', () => {
    const blocks: DiffBlock[] = [
      { label: 'New section', lines: ['Added a generic improvement'] },
      { label: 'Another section', lines: ['More good stuff'] },
    ];
    const result = classifyBlocks(blocks, triggers);
    expect(result.autoKept).toHaveLength(2);
    expect(result.flagged).toHaveLength(0);
  });

  test('single trigger match → block is flagged', () => {
    const blocks: DiffBlock[] = [
      { label: 'Check Greptile', lines: ['Run greptile review on PR'] },
    ];
    const result = classifyBlocks(blocks, triggers);
    expect(result.autoKept).toHaveLength(0);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].triggerLabel).toBe('Greptile (code review tool)');
  });

  test('word boundary — no false positive on "turbocharged"', () => {
    const blocks: DiffBlock[] = [
      {
        label: 'Turbo section',
        lines: ['This turbocharged feature is amazing'],
      },
    ];
    // turbo trigger uses \bturbo\b — "turbocharged" should NOT match
    const withTurbo = { ...triggers, '\\bturbo\\b': 'Rails Turbo' };
    const result = classifyBlocks(blocks, withTurbo);
    expect(result.autoKept).toHaveLength(1);
    expect(result.flagged).toHaveLength(0);
  });

  test('word boundary — matches standalone "turbo"', () => {
    const blocks: DiffBlock[] = [
      { label: 'Turbo section', lines: ['Enable turbo streams for live updates'] },
    ];
    const withTurbo = { ...triggers, '\\bturbo\\b': 'Rails Turbo' };
    const result = classifyBlocks(blocks, withTurbo);
    expect(result.autoKept).toHaveLength(0);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].triggerLabel).toBe('Rails Turbo');
  });

  test('.rb trigger matches file extensions', () => {
    const blocks: DiffBlock[] = [
      { label: 'Ruby files', lines: ['Edit app/models/user.rb'] },
    ];
    const result = classifyBlocks(blocks, triggers);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].triggerLabel).toBe('Ruby file');
  });

  test('.rb trigger does not match "orb" or "verb"', () => {
    const blocks: DiffBlock[] = [
      { label: 'Generic', lines: ['The verb is important for this orb'] },
    ];
    const result = classifyBlocks(blocks, triggers);
    expect(result.autoKept).toHaveLength(1);
    expect(result.flagged).toHaveLength(0);
  });

  test('mixed blocks — some flagged, some auto-kept', () => {
    const blocks: DiffBlock[] = [
      { label: 'Generic improvement', lines: ['Better error messages'] },
      { label: 'Rails check', lines: ['Run rails db:migrate first'] },
      { label: 'New feature', lines: ['Added snapshot diffing'] },
    ];
    const result = classifyBlocks(blocks, triggers);
    expect(result.autoKept).toHaveLength(2);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].label).toBe('Rails check');
  });

  test('empty blocks array → empty results', () => {
    const result = classifyBlocks([], triggers);
    expect(result.autoKept).toHaveLength(0);
    expect(result.flagged).toHaveLength(0);
  });

  test('case insensitive matching', () => {
    const blocks: DiffBlock[] = [
      { label: 'Ruby section', lines: ['Install RUBY 3.2'] },
    ];
    const result = classifyBlocks(blocks, triggers);
    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0].triggerLabel).toBe('Ruby language');
  });
});
