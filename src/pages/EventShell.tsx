import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, liveShowUrl } from '../lib/supabase';
import { TopBar } from '../components/TopBar';
import { Rail, SECTIONS } from '../components/Rail';
import { Rundown } from './Rundown';

/* The event workspace. Screens are being rebuilt one at a time; until each lands here,
   the live show (the original Neon Loop, served at /legacy/) runs that part, on the same sign-in. */
const ABOUT: Record<string, string> = {
  rundown: 'Segments, timing against the schedule, breaks, transitions, music and the output window.',
  content: 'The event gallery, content rules, uploads and the Content Designer.',
  guests: 'Spreadsheet import, door check-in, walk-ins and wristbands.',
  pledges: 'Pledge entry for both event types, the live tally, takeovers and the thank-you wall.',
  settings: 'Event details, remote control and exports.'
};

export function EventShell() {
  const { id = '', section: raw } = useParams(), [name, setName] = useState('');
  const section = SECTIONS.some(s => s[0] === raw) ? raw! : 'rundown';
  useEffect(() => { supabase?.from('events').select('name').eq('id', id).maybeSingle().then(({ data }) => setName(data?.name || 'Event')); }, [id]);
  const label = SECTIONS.find(s => s[0] === section)![1];
  return (
    <div className="shell">
      <Rail eventId={id} section={section} />
      <div className="wrap">
        <TopBar title={name} />
        {section === 'rundown' ? <Rundown key={id} eventId={id} /> : (
        <div className="card">
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>{label}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{ABOUT[section]}</p>
          <div className="notice">
            {label} is being rebuilt here. Until it is, it runs in the live show, which opens this event straight away. You are already signed in there.
            <div className="row" style={{ marginTop: 12 }}><a href={liveShowUrl(id, section)}><button className="primary">Open {label.toLowerCase()} in the live show</button></a><a href="/remote"><button>Open remote</button></a></div>
          </div>
        </div>)}
      </div>
    </div>
  );
}
