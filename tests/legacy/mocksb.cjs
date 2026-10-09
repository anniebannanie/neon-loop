// Minimal stand-in for Supabase: auth, PostgREST for events/assets/profiles, storage. Mirrors the permission rules in the setup script.
const http = require('http');
const db = { events: [], assets: [], members: [], files: new Map(), log: [] };
const users = { 'trevor@example.com': { id: '11111111-1111-4111-8111-111111111111', pw: 'secret123', first_name: 'Trevor', role: 'producer' },
                'annie@example.com':  { id: '22222222-2222-4222-8222-222222222222', pw: 'secret456', first_name: 'Annie', role: 'team' } };
const byTok = t => Object.values(users).find(u => 'tok-' + u.id === t);
const member = (u, ev) => u.role === 'producer' || db.members.some(m => m.event_id === ev && m.user_id === u.id);
function start(port) {
  const srv = http.createServer((q, r) => {
    const chunks = []; q.on('data', c => chunks.push(c)); q.on('end', () => {
      const body = Buffer.concat(chunks), u = new URL(q.url, 'http://x'), p = u.pathname;
      const send = (code, obj, type) => { r.writeHead(code, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Content-Type': type || 'application/json' }); r.end(obj == null ? '' : Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)); };
      if (q.method === 'OPTIONS') return send(204);
      if (q.headers.apikey !== 'anon-test') return send(401, { message: 'Invalid API key' });
      db.log.push(q.method + ' ' + p);
      const json = () => { try { return JSON.parse(body.toString() || 'null'); } catch (e) { return null; } };
      if (p === '/auth/v1/settings') return send(200, { external: {} });
      if (p === '/auth/v1/token') {
        const b = json(); let usr;
        if (u.searchParams.get('grant_type') === 'password') { usr = users[b.email]; if (!usr || usr.pw !== b.password) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }); }
        else { usr = Object.values(users).find(x => 'ref-' + x.id === b.refresh_token); if (!usr) return send(400, { error: 'invalid_grant' }); }
        return send(200, { access_token: 'tok-' + usr.id, refresh_token: 'ref-' + usr.id, expires_in: 3600, user: { id: usr.id, email: Object.keys(users).find(k => users[k] === usr) } });
      }
      const me = byTok((q.headers.authorization || '').replace('Bearer ', '')); if (!me) return send(401, { message: 'JWT expired' });
      if (p === '/auth/v1/logout') return send(204);
      const idEq = (u.searchParams.get('id') || '').replace('eq.', '');
      if (p === '/rest/v1/profiles') { const rows = idEq === me.id ? [{ first_name: me.first_name, role: me.role }] : [];
        if (/vnd\.pgrst\.object/.test(q.headers.accept || '')) return rows.length ? send(200, rows[0]) : send(406, { message: 'no rows' });
        return send(200, rows); }
      if (p === '/rest/v1/events') {
        if (q.method === 'GET') { const rows = db.events.filter(e => member(me, e.id) && (!idEq || e.id === idEq));
          if (/vnd\.pgrst\.object/.test(q.headers.accept || '')) return rows.length ? send(200, rows[0]) : send(406, { message: 'JSON object requested, multiple (or no) rows returned' });
          return send(200, rows); }
        if (me.role !== 'producer') return q.method === 'POST' ? send(403, { message: 'new row violates row-level security policy' }) : send(200, []);
        if (q.method === 'POST') { const row = json(); if (db.events.some(e => e.id === row.id)) return send(409, { message: 'duplicate key' }); db.events.push(row); return send(201, [row]); }
        const hit = db.events.filter(e => e.id === idEq);
        if (q.method === 'PATCH') { hit.forEach(e => Object.assign(e, json())); db.log.push('PATCH event ' + idEq); return send(200, hit); }
        if (q.method === 'DELETE') { db.events = db.events.filter(e => e.id !== idEq); db.assets = db.assets.filter(a => a.event_id !== idEq); return send(200, hit); }
      }
      if (p === '/rest/v1/assets') {
        if (q.method === 'GET') { const evEq = (u.searchParams.get('event_id') || '').replace('eq.', ''); return send(200, db.assets.filter(a => member(me, a.event_id) && (!evEq || a.event_id === evEq))); }
        if (q.method === 'POST') { const row = json(), ev = db.events.find(e => e.id === row.event_id);
          if (!ev || !member(me, ev.id) || !ev.rules) return send(403, { message: 'new row violates row-level security policy for table "assets"' });
          db.assets = db.assets.filter(a => a.id !== row.id); db.assets.push(row); return send(201, [row]); }
        const hit = db.assets.filter(a => a.id === idEq && member(me, a.event_id));
        if (q.method === 'PATCH') { hit.forEach(a => Object.assign(a, json())); return send(200, hit); }
        if (q.method === 'DELETE') { if (me.role !== 'producer') return send(200, []); db.assets = db.assets.filter(a => !hit.includes(a)); return send(200, hit); }
      }
      const up = p.match(/^\/storage\/v1\/object\/content\/(.+)$/), down = p.match(/^\/storage\/v1\/object\/authenticated\/content\/(.+)$/);
      if (up && q.method === 'POST') { const ev = db.events.find(e => e.id === up[1].split('/')[0]); if (!ev || !member(me, ev.id) || !ev.rules) return send(403, { message: 'new row violates row-level security policy' });
        db.files.set(up[1], { body, type: q.headers['content-type'] }); return send(200, { Key: 'content/' + up[1] }); }
      if (down && q.method === 'GET') { const f = db.files.get(down[1]); if (!f || !member(me, down[1].split('/')[0])) return send(404, { message: 'Object not found' }); return send(200, f.body, f.type); }
      if (p === '/storage/v1/object/content' && q.method === 'DELETE') { if (me.role !== 'producer') return send(200, []); (json().prefixes || []).forEach(k => db.files.delete(k)); return send(200, []); }
      send(404, { message: 'not found ' + p });
    });
  }).listen(port);
  realtime(srv);
  return srv;
}
/* Realtime: just enough of the Phoenix protocol for private broadcast channels, with the same membership rule as the setup script. */
const { WebSocketServer } = require('ws');
const rt = { sockets: new Set(), log: [], kill: false };
function realtime(srv) {
  const wss = new WebSocketServer({ server: srv, path: '/realtime/v1/websocket' });
  wss.on('connection', (ws, req) => {
    const u = new URL(req.url, 'http://x'); if (u.searchParams.get('apikey') !== 'anon-test' || rt.kill) { ws.close(); return; }
    ws.topics = new Map(); rt.sockets.add(ws); ws.on('close', () => rt.sockets.delete(ws));
    ws.on('message', buf => {
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      const reply = (status, response) => ws.send(JSON.stringify({ topic: m.topic, event: 'phx_reply', payload: { status, response: response || {} }, ref: m.ref, join_ref: m.join_ref }));
      if (m.topic === 'phoenix' && m.event === 'heartbeat') return reply('ok');
      if (m.event === 'phx_join') {
        const me = byTok(m.payload.access_token), ev = (m.topic.match(/^realtime:nl:(.+)$/) || [])[1];
        rt.log.push('join ' + (me ? me.first_name : '?') + ' ' + ev);
        if (!m.payload.config.private || !me || !ev || !db.events.some(e => e.id === ev) || !member(me, ev)) return reply('error', { reason: 'Unauthorized: You do not have permissions to read from this Channel topic' });
        ws.topics.set(m.topic, me); return reply('ok', { postgres_changes: [] });
      }
      if (m.event === 'access_token') { const me = byTok(m.payload.access_token); if (me && ws.topics.has(m.topic)) ws.topics.set(m.topic, me); return; }
      if (m.event === 'broadcast') {
        if (!ws.topics.has(m.topic)) return;
        rt.log.push('msg ' + (m.payload.payload || {}).t);
        rt.sockets.forEach(o => { if (o !== ws && o.readyState === 1 && o.topics.has(m.topic)) o.send(JSON.stringify({ topic: m.topic, event: 'broadcast', payload: m.payload, ref: null })); });
      }
    });
  });
  rt.drop = () => rt.sockets.forEach(s => s.terminate());
}
module.exports = { start, db, users, rt };
