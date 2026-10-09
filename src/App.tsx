import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { configError } from './lib/supabase';
import { SignIn } from './pages/SignIn';
import { Events } from './pages/Events';
import { EventShell } from './pages/EventShell';
import { TopBar } from './components/TopBar';

function Setup() {
  return (
    <div className="wrap"><TopBar />
      <div className="card" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{configError === 'secret' ? 'Wrong Supabase key' : 'Connect Supabase'}</h1>
        {configError === 'secret'
          ? <p>The app was built with the secret service key. Replace <code>VITE_SUPABASE_ANON_KEY</code> with the <b>anon public</b> key and rotate the secret key in Supabase, since it may have been exposed.</p>
          : <p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel (Project Settings, Environment Variables) or in <code>.env.local</code>, then redeploy.</p>}
        <p className="muted">The current Neon Loop still works without this: <a href="/legacy/">open it here</a>.</p>
      </div>
    </div>
  );
}

function Gate() {
  const { ready, session } = useAuth();
  if (configError) return <Setup />;
  if (!ready) return null;
  if (!session) return <SignIn />;
  return (
    <Routes>
      <Route path="/" element={<Events />} />
      <Route path="/events/:id" element={<EventShell />} />
      <Route path="/events/:id/:section" element={<EventShell />} />
      <Route path="/remote" element={<RedirectTo href="/legacy/#remote" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
function RedirectTo({ href }: { href: string }) { location.replace(href); return null; }

export default function App() { return <AuthProvider><BrowserRouter><Gate /></BrowserRouter></AuthProvider>; }
