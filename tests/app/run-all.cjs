// Builds the app once, then runs every app test. Usage: npm run test:app
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
require('./harness.cjs');
const files = fs.readdirSync(__dirname).filter(f => /^\d\d-.*\.test\.cjs$/.test(f)).sort(); let failed = 0, first = true;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 600000, env: Object.assign({}, process.env, first ? {} : { APP_TEST_BUILT: '1' }) }); first = false;
  const text = (r.stdout || '') + (r.stderr || ''), pass = (text.match(/^PASS /gm) || []).length, bad = text.split('\n').filter(l => /^(FAIL|ERR|CRASH)/.test(l));
  if (bad.length || r.status !== 0) failed++;
  console.log((bad.length || r.status !== 0 ? '✕ ' : '✓ ') + f + '  ' + pass + ' passed' + (bad.length ? ', ' + bad.length + ' failed' : ''));
  bad.forEach(l => console.log('    ' + l)); if (r.status !== 0 && !bad.length) console.log(text.slice(-1500));
}
process.exit(failed ? 1 : 0);
