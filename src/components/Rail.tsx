import { Link } from 'react-router-dom';
import type { JSX } from 'react';
import { useOnline } from '../lib/offline';

/* The floating side menu from the original Neon Loop: the event's places, always in reach.
   At phone width it becomes a bar along the bottom. */
const I = (d: JSX.Element) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICONS: Record<string, JSX.Element> = {
  events: I(<path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" />),
  rundown: I(<><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="1.4" /></>),
  content: I(<><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M4 16l4.5-4.5 4 4 3-3 4.5 4.5" /><circle cx="15.5" cy="9.5" r="1.3" /></>),
  guests: I(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.7.7 2.7 2.3 3 4.6" /></>),
  pledges: I(<path d="M12 20s-7-4.3-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.7 12 20 12 20z" />),
  settings: I(<><path d="M5 7h9M18 7h1M5 17h1M10 17h9" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>),
  live: I(<><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M10 9l4 2-4 2z" /></>)
};
export const SECTIONS: [string, string, string][] = [
  ['rundown', 'Rundown', 'Run the show'], ['content', 'Content', 'Upload, design and manage content'], ['guests', 'Guests', 'Guest list and door check-in'],
  ['pledges', 'Pledges', 'Record pledges'], ['settings', 'Settings', 'Event settings and remote control']
];

export function Rail({ eventId, section }: { eventId: string; section: string }) {
  const online = useOnline();
  return (
    <nav className="rail" aria-label="Event sections">
      <Link to="/" title="Back to all events">{ICONS.events}<span>Events</span></Link>
      <span className="rail-sep" />
      {SECTIONS.map(([k, label, tip]) => (
        <Link key={k} to={'/events/' + eventId + '/' + k} title={tip} aria-current={section === k ? 'page' : undefined}>{ICONS[k]}<span>{label}</span></Link>
      ))}
      <span className="rail-grow" />
      <a href="/legacy/" title={'Run the show in the current Neon Loop' + (online ? '' : ' (works offline)')} className="rail-live">{ICONS.live}<span>Live show</span><i className={online ? 'ok' : 'warn'} /></a>
    </nav>
  );
}
