import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useOnline } from '../lib/offline';

export function TopBar({ title }: { title?: string }) {
  const { session, profile, signOut } = useAuth(), online = useOnline();
  return (
    <header className="top">
      <Link to="/" className="brand"><img src="/icons/emblem.jpg" alt="" /><span><b>NEON LOOP</b><small>EVENT WORKSPACE</small></span></Link>
      {title && <h2 style={{ fontSize: 20 }}>{title}</h2>}
      <span className="spacer" />
      <span className={'pill ' + (online ? 'ok' : 'warn')}><i />{online ? 'Online' : 'Offline, working from this device'}</span>
      {session && <span className="pill">{profile?.first_name || session.user.email}{profile ? ', ' + { producer: 'Producer', team: 'Team', client: 'Client' }[profile.role] : ''}</span>}
      {session && <button onClick={signOut}>Sign out</button>}
    </header>
  );
}
