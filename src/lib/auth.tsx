import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface Profile { first_name: string; role: 'producer' | 'team' | 'client' }
interface AuthState { ready: boolean; session: Session | null; profile: Profile | null; signOut: () => Promise<void> }

const Ctx = createContext<AuthState>({ ready: false, session: null, profile: null, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null), [profile, setProfile] = useState<Profile | null>(null), [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !session) { setProfile(null); return; }
    supabase.from('profiles').select('first_name, role').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { const pr = (data as Profile) || { first_name: '', role: 'team' }; setProfile(pr); try { localStorage.setItem('neonloop.profile', JSON.stringify(pr)); } catch { /* storage blocked */ } });
  }, [session]);
  const signOut = async () => { if (supabase) await supabase.auth.signOut(); try { localStorage.removeItem('neonloop.profile'); } catch { /* storage blocked */ } };
  return <Ctx.Provider value={{ ready, session, profile, signOut }}>{children}</Ctx.Provider>;
}
