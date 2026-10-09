import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { TopBar } from '../components/TopBar';

export function SignIn() {
  const [email, setEmail] = useState(''), [pass, setPass] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault(); if (!supabase) return; setErr('');
    if (!email || !pass) { setErr('Enter your email and password.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) setErr(/invalid/i.test(error.message) ? 'That email and password do not match.' : /fetch|network/i.test(error.message) ? 'No connection. Check your internet and try again.' : error.message);
  }
  return (
    <div className="wrap">
      <TopBar />
      <form className="card" style={{ maxWidth: 420, margin: '40px auto' }} onSubmit={go}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Sign in</h1>
        <p className="muted" style={{ margin: 0 }}>Use your Neon Loop account.</p>
        <label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="pass">Password</label><input id="pass" type="password" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} />
        <div className="err">{err}</div>
        <button className="primary" style={{ width: '100%', marginTop: 8 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
