import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const pkgPath = 'package.json';
if (!existsSync(pkgPath)) {
  console.log('[rewaq-agent-check] No package.json; skipping Node checks.');
  process.exit(0);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const scripts = pkg.scripts ?? {};
const checks = [
  { name: 'typecheck', command: 'npx', args: ['tsc', '--noEmit', '-p', 'tsconfig.json'] },
  ...(scripts.lint ? [{ name: 'lint', command: 'npm', args: ['run', 'lint'] }] : []),
  ...(scripts.test ? [{ name: 'test', command: 'npm', args: ['run', 'test', '--', '--run'] }] : []),
];

if (process.argv.includes('--full') && scripts.build) {
  checks.push({ name: 'build', command: 'npm', args: ['run', 'build'] });
}

let failed = false;

for (const check of checks) {
  console.log(`[rewaq-agent-check] Running ${check.name}...`);
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) failed = true;
}

if (failed) {
  console.error('[rewaq-agent-check] One or more checks failed.');
  process.exit(1);
}

console.log('[rewaq-agent-check] Applicable checks passed.');
