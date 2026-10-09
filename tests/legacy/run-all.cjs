// Runs the end-to-end suites written against the single-file Neon Loop (public/legacy/index.html).
// They define what the React rebuild must still do. Usage: npm run test:legacy [-- 08 14]
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const dir = __dirname, out = path.join(dir, 'out'); fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2), files = fs.readdirSync(dir).filter(f => /^\d\d-.*\.test\.cjs$/.test(f) && (!only.length || only.some(o => f.startsWith(o)))).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { cwd: out, encoding: 'utf8', timeout: 600000 });
  const text = (r.stdout || '') + (r.stderr || ''), pass = (text.match(/^PASS /gm) || []).length, bad = text.split('\n').filter(l => /^(FAIL|ERR|CRASH)/.test(l));
  if (bad.length || r.status !== 0) failed++;
  console.log((bad.length || r.status !== 0 ? '✕ ' : '✓ ') + f + '  ' + pass + ' passed' + (bad.length ? ', ' + bad.length + ' failed' : ''));
  bad.forEach(l => console.log('    ' + l));
}
process.exit(failed ? 1 : 0);
