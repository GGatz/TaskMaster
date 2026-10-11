// Browser end-to-end tests. Starts a throwaway server on a temporary data directory, runs every
// e2e/NN-*.cjs script against it with Playwright, and exits non-zero if any check fails.
//
//   npm i -D playwright && npx playwright install chromium   (once)
//   npm run build && npm run e2e
//
// Env: PLAYWRIGHT_PATH (path to a playwright install), SHOTS_DIR (where screenshots go).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-e2e-'));
const shots = process.env.SHOTS_DIR || path.join(dataDir, 'shots');
fs.mkdirSync(shots, { recursive: true });

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, DATA_DIR: dataDir, PORT: String(port) }, stdio: 'ignore' });

const cleanup = () => { server.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); };
process.on('exit', cleanup);

for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

const scripts = fs.readdirSync(path.join(root, 'e2e')).filter((f) => /^\d+-.*\.cjs$/.test(f)).sort();
let failed = 0;
for (const script of scripts) {
  const out = await new Promise((resolve) => {
    let buf = '';
    const child = spawn(process.execPath, [path.join(root, 'e2e', script)], { cwd: root, env: { ...process.env, BASE_URL: base, SHOTS_DIR: shots } });
    child.stdout.on('data', (d) => { buf += d; });
    child.stderr.on('data', (d) => { buf += d; });
    child.on('close', (code) => resolve({ buf, code }));
  });
  const lines = out.buf.split('\n').filter((l) => /^(PASS|FAIL) \|/.test(l));
  const bad = lines.filter((l) => l.startsWith('FAIL')).length + (/errors: \[\]/.test(out.buf) ? 0 : 1) + (out.code ? 1 : 0);
  failed += bad;
  console.log(`${bad ? '✗' : '✓'} ${script} — ${lines.length - lines.filter((l) => l.startsWith('FAIL')).length}/${lines.length} checks`);
  if (bad) console.log(out.buf.split('\n').filter((l) => !l.startsWith('PASS')).join('\n'));
}
console.log(failed ? `\n${failed} problem(s)` : '\nAll browser checks passed');
process.exit(failed ? 1 : 0);
