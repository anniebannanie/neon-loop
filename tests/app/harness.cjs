// Shared set-up for the app tests: builds the app against the mock Supabase once, serves it, starts the mock.
const path = require('path'), http = require('http'), fs = require('fs'), { execSync } = require('child_process');
const root = path.join(__dirname, '../..'), dist = path.join(__dirname, 'out', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff' };
function build() {
  if (process.env.APP_TEST_BUILT && fs.existsSync(path.join(dist, 'index.html'))) return;
  execSync('npx vite build --logLevel error --outDir ' + JSON.stringify(dist), { cwd: root, env: Object.assign({}, process.env, { VITE_SUPABASE_URL: 'http://localhost:8790', VITE_SUPABASE_ANON_KEY: 'anon-test' }), stdio: 'inherit' });
}
function start() {
  build();
  delete require.cache[require.resolve('../legacy/mocksb.cjs')];
  const sb = require('../legacy/mocksb.cjs'), api = sb.start(8790);
  const web = http.createServer((q, r) => { let f = path.join(dist, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(path.join(f, 'index.html')) ? path.join(f, 'index.html') : path.join(dist, 'index.html'); r.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); }).listen(8791);
  return { sb, base: 'http://localhost:8791', close: () => { api.close(); web.close(); } };
}
const launchOpts = () => (process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
async function signIn(p, base, email, pw) { await p.goto(base + '/'); await p.fill('#email', email); await p.fill('#pass', pw); await p.click('button.primary'); await p.waitForSelector('.hero'); }
module.exports = { start, launchOpts, signIn };
