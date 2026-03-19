import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;

export interface AdaptDecisions {
  removals: string[];
  overrideKeeps: string[];
}

/**
 * Adapt a skill document using Claude.
 *
 * Two modes:
 * - ANTHROPIC_API_KEY set → Anthropic SDK (fast, for CI / GitHub Actions)
 * - No API key → `claude -p` CLI (uses existing Claude Code auth)
 */
export async function adaptWithClaude(
  content: string,
  skillName: string,
  prompt: string,
  decisions?: AdaptDecisions,
): Promise<string> {
  console.log(`  ADAPTING: ${skillName} (${HAS_API_KEY ? 'SDK' : 'CLI'})...`);

  const fullPrompt = decisions ? appendDecisions(prompt, decisions) : prompt;

  const adapted = HAS_API_KEY
    ? await adaptViaSDK(content, fullPrompt)
    : await adaptViaCLI(content, skillName, fullPrompt);

  // Validate length ±10%
  const ratio = adapted.length / content.length;
  if (ratio < 0.9 || ratio > 1.1) {
    console.warn(
      `  WARNING: ${skillName} adapted length ${adapted.length} vs input ${content.length} (${(ratio * 100).toFixed(0)}%) — outside ±10% tolerance`,
    );
  }

  return adapted;
}

async function adaptViaSDK(content: string, prompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 32768,
    messages: [
      {
        role: 'user',
        content: buildUserMessage(content, prompt),
      },
    ],
  });

  return response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function adaptViaCLI(content: string, skillName: string, prompt: string): Promise<string> {
  // Write content and prompt to temp files so Claude reads them (avoids stdin truncation)
  const tmpDir = path.join(os.tmpdir(), 'gstack-adapt');
  fs.mkdirSync(tmpDir, { recursive: true });
  const promptFile = path.join(tmpDir, 'prompt.md');
  const contentFile = path.join(tmpDir, `${skillName}-input.md`);
  fs.writeFileSync(promptFile, prompt);
  fs.writeFileSync(contentFile, content);

  const instruction = [
    `Read the adaptation rules from ${promptFile}.`,
    `Read the skill document from ${contentFile}.`,
    `Apply ALL adaptation rules to the skill document.`,
    `Output the COMPLETE adapted document — every single line, every section, every code block.`,
    `Do not summarize. Do not explain. Do not wrap in markdown fences. Just the raw adapted document.`,
  ].join(' ');

  return new Promise<string>((resolve, reject) => {
    const proc = spawn('claude', [
      '-p',
      '--model', 'opus',
      '--output-format', 'text',
      '--append-system-prompt', 'You are a document transformation tool. Your ONLY output is the complete transformed document. Never summarize, explain, or comment on changes. Never wrap output in code fences. Output the raw document text only.',
      '--allowed-tools', 'Read',
      '--no-session-persistence',
      instruction,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      // Clean up temp files
      try { fs.unlinkSync(contentFile); } catch {}

      if (code !== 0) {
        reject(new Error(`claude CLI exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    // Close stdin immediately (prompt is passed as argument)
    proc.stdin.end();
  });
}

function appendDecisions(prompt: string, decisions: AdaptDecisions): string {
  const lines: string[] = [prompt, '', '## Per-template decisions (from sync review)'];
  for (const r of decisions.removals) {
    lines.push(`REMOVE: ${r} (user declined)`);
  }
  for (const k of decisions.overrideKeeps) {
    lines.push(
      `KEEP (override): ${k} — do NOT remove this even if it matches a standard removal rule (user explicitly approved)`,
    );
  }
  return lines.join('\n');
}

function buildUserMessage(content: string, prompt: string): string {
  return `${prompt}\n\n---\n\nHere is the skill document to adapt. Return ONLY the adapted document with no surrounding commentary, no markdown fences, no preamble:\n\n${content}`;
}
