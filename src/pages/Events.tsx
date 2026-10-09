import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TopBar } from '../components/TopBar';

export interface EventRow { id: string; name: string; type: string; event_date: string | null }
const TYPES = ['Flagship', 'Pitch night', 'Employee engagement', 'Rehearsal / test', 'Other'];
const fmtDate = (d: string | null) => { if (!d) return ''; const t = new Date(d + 'T00:00'); return isNaN(+t) ? '' : t.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };

export function Events() {
  const { profile } = useAuth(), producer = profile?.role === 'producer';
  const [rows, setRows] = useState<EventRow[] | null>(null), [err, setErr] = useState('');
  const dlg = useRef<HTMLDialogElement>(null), [name, setName] = useState(''), [type, setType] = useState(TYPES[0]), [date, setDate] = useState(''), [dErr, setDErr] = useState('');
  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase.from('events').select('id, name, type, event_date').order('event_date', { ascending: false, nullsFirst: false });
    if (error) setErr(error.message); else { setErr(''); setRows(data as EventRow[]); }
  }
  useEffect(() => { load(); }, []);
  async function create() {
    if (!name.trim()) { setDErr('Give the event a name.'); return; }
    const { error } = await supabase!.from('events').insert({ name: name.trim(), type, event_date: date || null });
    if (error) { setDErr(error.message); return; }
    dlg.current?.close(); setName(''); setDate(''); load();
  }
  async function remove(ev: EventRow) {
    if (!confirm('Delete "' + ev.name + '" for everyone, with its content, guests and pledges? This cannot be undone.')) return;
    const { error } = await supabase!.from('events').delete().eq('id', ev.id);
    if (error) alert(error.message); else load();
  }
  return (
    <div className="wrap">
      <TopBar />
      <div className="row" style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 28 }}>Events</h1><span className="spacer" />
        <a href="/legacy/"><button>Open current Neon Loop</button></a>
        {producer && <button className="primary" onClick={() => { setDErr(''); dlg.current?.showModal(); }}>New event</button>}
      </div>
      {err && <p className="err">{err}</p>}
      {!rows && !err && <p className="muted">Loading events…</p>}
      {rows && !rows.length && <div className="notice">No events yet.{producer ? ' Create one to get started.' : ' A producer needs to add you to an event.'}</div>}
      <div className="grid">
        {rows?.map(ev => (
          <div className="card ev" key={ev.id}>
            <h3>{ev.name}</h3>
            <div className="meta">{[ev.type, fmtDate(ev.event_date)].filter(Boolean).join(' · ')}</div>
            <div className="row" style={{ marginTop: 14 }}>
              <Link to={'/events/' + ev.id}><button className="primary">Open</button></Link>
              {producer && <button onClick={() => remove(ev)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
      <dialog ref={dlg}>
        <h2 style={{ fontSize: 22 }}>New event</h2>
        <label htmlFor="evName">Name</label><input id="evName" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <label htmlFor="evType">Type</label><select id="evType" value={type} onChange={e => setType(e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
        <label htmlFor="evDate">Date</label><input id="evDate" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <div className="err">{dErr}</div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button onClick={() => dlg.current?.close()}>Cancel</button><button className="primary" onClick={create}>Create event</button></div>
      </dialog>
    </div>
  );
}
