import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import * as harness from '../skills/aidlc-portfolio/scripts/harness.ts';
test('Native Codex projection detects drift and protects tracked paths', async () => {
 const root = await mkdtemp('/tmp/portfolio-override-test-');
 try {
  const source = join(root, 'source');
  for (const name of ['.codex', '.agents/skills/aidlc', 'aidlc']) await mkdir(join(source, name), { recursive: true });
  await writeFile(join(source, '.codex/config.toml'), '# config\n');
  await writeFile(join(source, '.agents/skills/aidlc/SKILL.md'), '# skill\n');
  await writeFile(join(source, 'aidlc/version.txt'), '1');
  const wt = join(root, 'worktrees/api');
  await mkdir(wt, { recursive: true });
  async function git(...args: string[]) {
   const p = Bun.spawn(['git', '-C', wt, ...args], { stdout: 'pipe', stderr: 'pipe' });
   if (await p.exited) throw new Error(await new Response(p.stderr).text());
  }
  await git('init');
  await mkdir(join(root, 'portfolio/intents'), { recursive: true });
  await mkdir(join(root, 'portfolio/projects'), { recursive: true });
  await writeFile(join(root, 'portfolio/projects/api.yaml'), 'id: api\n');
  await writeFile(join(root, 'portfolio/intents/f.yaml'), 'id: f\nprojects:\n  - project: api\n    worktree: worktrees/api\n');
  expect((await harness.stageHarness(root, 'codex', source)).changed).toBe(true);
  expect((await harness.stageHarness(root, 'codex', source)).changed).toBe(false);
  await harness.syncHarness(root, 'codex');
  expect((await harness.verifyHarness(root, 'codex')).ok).toBe(true);
  expect((await harness.syncHarness(root, 'codex')).changed).toBe(false);
  await writeFile(join(wt, '.agents/skills/aidlc/SKILL.md'), 'tampered');
  expect((await harness.verifyHarness(root, 'codex')).ok).toBe(false);
  await harness.syncHarness(root, 'codex');
  await git('add', '-f', '.codex/config.toml');
  await expect(harness.syncHarness(root, 'codex')).rejects.toThrow('tracked harness paths');
  await writeFile(join(source, 'aidlc/version.txt'), '2');
  expect((await harness.verifyHarness(root, 'codex')).ok).toBe(false);
 } finally { await rm(root, { recursive: true, force: true }); }
});

test('native CLI selects runner provider for CLI and rejects conflicting flags', async () => {
 const root = await mkdtemp('/tmp/portfolio-profile-test-');
 try {
  const profile = join(root, 'runner.md');
  await writeFile(profile, '---\nprovider: codex\n---\n');
  const entrypoint = join(import.meta.dir, '../skills/aidlc-portfolio/scripts/portfolio.ts');
  async function run(...args: string[]) {
   const p = Bun.spawn(['bun', entrypoint, ...args], { env: { ...process.env, AIDLC_RUNNER_PROFILE: profile }, stdout: 'pipe', stderr: 'pipe' });
   return { code: await p.exited, out: await new Response(p.stdout).text(), err: await new Response(p.stderr).text() };
  }
  const rejected = await run('harness', 'verify', '--root', root, '--provider', 'claude');
  expect(rejected.code).not.toBe(0);
  expect(rejected.err).toContain('conflicts with runner profile');
  const codex = await run('harness', 'verify', '--root', root);
  expect(codex.out).toContain('"provider": "codex"');
  await writeFile(profile, '---\nprovider: claude_code\n---\n');
  const claude = await run('harness', 'verify', '--root', root);
  expect(claude.out).toContain('"provider": "claude"');
  await writeFile(profile, '---\nprovider: unknown\n---\n');
  expect((await run('harness', 'verify', '--root', root)).code).not.toBe(0);
 } finally { await rm(root, { recursive: true, force: true }); }
});
