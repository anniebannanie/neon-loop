import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TopBar } from '../components/TopBar';

/* The event workspace. Screens are being rebuilt one at a time; until each lands here,
   the tested single-file Neon Loop (served at /legacy/) runs that part of the show. */
const SECTIONS: [string, string, string][] = [
  ['rundown', 'Rundown', 'Segments, timing against the schedule, breaks, transitions, music and the output window.'],
  ['content', 'Content', 'The event gallery, content rules, uploads and the Content Designer.'],
  ['guests', 'Guests', 'Spreadsheet import, door check-in, walk-ins and wristbands.'],
  ['pledges', 'Pledges', 'Pledge entry for both event types, the live tally, takeovers and the thank-you wall.'],
  ['settings', 'Settings', 'Event details, remote control and exports.']
];

export function EventShell() {
  const { id = '', section = 'rundown' } = useParams(), [name, setName] = useState('');
  useEffect(() => { supabase?.from('events').select('name').eq('id', id).maybeSingle().then(({ data }) => setName(data?.name || 'Event')); }, [id]);
  const cur = SECTIONS.find(s => s[0] === section) || SECTIONS[0];
  return (
    <div className="wrap">
      <TopBar title={name} />
      <nav className="tabs">{SECTIONS.map(([k, label]) => <NavLink key={k} to={'/events/' + id + '/' + k} className={({ isActive }) => (isActive || (k === 'rundown' && !section) ? 'active' : '')}>{label}</NavLink>)}</nav>
      <div className="card">
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>{cur[1]}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{cur[2]}</p>
        <div className="notice">
          This screen is being rebuilt in the new app. For now, run it in the current Neon Loop: it opens this same cloud event once you sign in there.
          <div className="row" style={{ marginTop: 12 }}><a href="/legacy/"><button className="primary">Open current Neon Loop</button></a><a href="/legacy/#remote"><button>Open remote</button></a></div>
        </div>
      </div>
    </div>
  );
}
