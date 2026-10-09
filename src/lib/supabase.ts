import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when the key looks like the secret service key, which must never reach a browser. */
export function isSecretKey(k: string): boolean {
  if (/^sb_secret_/.test(k)) return true;
  try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch { return false; }
}

export const configError = !url || !key ? 'missing' : isSecretKey(key) ? 'secret' : '';

/** Null until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (and the key is the public one). */
export const supabase: SupabaseClient | null = configError ? null : createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });
