import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the key looks like the secret service key, which must never reach a browser. */
export function isSecretKey(k: string): boolean {
  if (/^sb_secret_/.test(k)) return true;
  try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { return false; }
}

export const configError = !url || !key ? 'missing' : isSecretKey(key) ? 'secret' : '';

/* One sign-in for the whole app. The live show screens (the original Neon Loop, still running the
   parts not yet rebuilt) keep their sign-in in localStorage under "neonloop.session" and the project
   under "neonloop.cloud". This app reads and writes the same entries, so signing in, renewing the
   token and signing out happen once for both. */
export const SESSION_KEY = 'neonloop.session';
interface Shared { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email?: string }; user_full?: Record<string, unknown> }
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };
export const sharedStorage = {
  getItem(k: string): string | null {
    const raw = read(k); if (k !== SESSION_KEY || !raw) return raw;
    try {
      const s: Shared = JSON.parse(raw);
      if (!s || !s.access_token) return null;
      const user = s.user_full || { id: s.user.id, email: s.user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' };
      return JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, expires_in: Math.max(0, s.expires_at - Math.floor(Date.now() / 1000)), token_type: 'bearer', user });
    } catch { return null; }
  },
  setItem(k: string, v: string) {
    if (k !== SESSION_KEY) { write(k, v); return; }
    try {
      const g = JSON.parse(v); if (!g || !g.access_token) { write(k, null); return; }
      const s: Shared = { access_token: g.access_token, refresh_token: g.refresh_token, expires_at: g.expires_at || Math.floor(Date.now() / 1000) + (g.expires_in || 3600), user: { id: g.user.id, email: g.user.email }, user_full: g.user };
      write(k, JSON.stringify(s));
    } catch { /* ignore a malformed session */ }
  },
  removeItem(k: string) { write(k, null); }
};

if (!configError) write('neonloop.cloud', JSON.stringify({ url: url!.replace(/\/+$/, ''), key }));     // the live show screens find the project without asking

/** Null until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (and the key is the public one). */
export const supabase: SupabaseClient | null = configError ? null
  : createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: SESSION_KEY, storage: sharedStorage } });

/** Where the live show screens open a given event and section. */
const VIEW: Record<string, string> = { rundown: 'run', content: 'lib', guests: 'gst', pledges: 'plg', settings: 'set' };
export const liveShowUrl = (eventId?: string, section?: string) => '/legacy/' + (eventId ? '?event=' + encodeURIComponent(eventId) + '&view=' + (VIEW[section || 'rundown'] || 'run') : '');
