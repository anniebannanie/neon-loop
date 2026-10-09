import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TopBar } from '../components/TopBar';
import { Hero } from '../components/Hero';

export interface EventRow { id: string; name: string; type: string; event_date: string | null; created_at: string; rules: unknown }
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
/* Upcoming soonest first, then undated newest first, then past most recent first. */
function order(rows: EventRow[]) {
  const t = today(), up = rows.filter(e => e.event_date && e.event_date >= t).sort((a, b) => a.event_date!.localeCompare(b.event_date!));
  const undated = rows.filter(e => !e.event_date).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const past = rows.filter(e => e.event_date && e.event_date < t).sort((a, b) => b.event_date!.localeCompare(a.event_date!));
  return { list: up.concat(undated, past), next: up[0] || null };
}
function greeting(rows: EventRow[] | null, next: EventRow | null): string {
  if (!rows) return 'Loading your events…';
  if (!rows.length) return 'Create your first event, set what content it accepts, then start uploading.';
  let sub: string;
  if (next) { const days = Math.round((+new Date(next.event_date + 'T00:00') - +new Date(today() + 'T00:00')) / 864e5); sub = next.name + ' is ' + (days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days') + ', on ' + fmtDate(next.event_date) + '.'; }
  else sub = 'None of your ' + (rows.length === 1 ? 'events has' : rows.length + ' events has') + ' a date coming up.';
  const locked = rows.filter(e => !e.rules).length;
  if (locked) sub += ' ' + (locked === 1 ? 'One event still needs' : locked + ' events still need') + ' content rules before anyone can upload.';
  return sub;
}
const TYPES = ['Flagship', 'Pitch night', 'Employee engagement', 'Rehearsal / test', 'Other'];
function fmtDate(d: string | null) { return fmtD(d); }
const fmtD = (d: string | null) => { if (!d) return ''; const t = new Date(d + 'T00:00'); return isNaN(+t) ? '' : t.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); };

export function Events() {
  const { profile } = useAuth(), producer = profile?.role === 'producer';
  const [rows, setRows] = useState<EventRow[] | null>(null), [err, setErr] = useState('');
  const dlg = useRef<HTMLDialogElement>(null), [name, setName] = useState(''), [type, setType] = useState(TYPES[0]), [date, setDate] = useState(''), [dErr, setDErr] = useState('');
  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase.from('events').select('id, name, type, event_date, created_at, rules');
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
  const nav = useNavigate(), { list, next } = order(rows || []), first = profile?.first_name;
  const newEvent = () => { setDErr(''); dlg.current?.showModal(); };
  return (
    <div className="wrap">
      <TopBar />
      <Hero title={first ? 'Welcome, ' + first : 'Welcome'} sub={greeting(rows, next)}>
        {producer && <button className="primary" onClick={newEvent}>+ Create an event</button>}
        {next && <button className="primary" onClick={() => nav('/events/' + next.id)}>Open {next.name}</button>}
        <a href="/legacy/"><button>Open current Neon Loop</button></a>
      </Hero>
      <div className="section-heading"><h2>Your events {rows && rows.length ? <span>({rows.length})</span> : null}</h2><p>Every moment, in one place.</p></div>
      {err && <p className="err">{err}</p>}
      {rows && !rows.length && <div className="notice">No events yet.{producer ? ' Create one to get started.' : ' A producer needs to add you to an event.'}</div>}
      <div className="grid">
        {list.map(ev => (
          <div className={'card ev' + (next && ev.id === next.id ? ' next' : '')} key={ev.id}>
            {next && ev.id === next.id && <div className="when">Up next</div>}
            <h3>{ev.name}</h3>
            <div className="meta">{[ev.type, fmtDate(ev.event_date)].filter(Boolean).join(' · ')}</div>
            <div className={'rule' + (ev.rules ? '' : ' unset')}>{ev.rules ? 'Content rules set' : 'Content rules not set yet'}</div>
            <div className="row" style={{ marginTop: 'auto', paddingTop: 10 }}>
              <button className="primary" style={{ flex: 1 }} onClick={() => nav('/events/' + ev.id)}>Open</button>
              {producer && <button onClick={() => remove(ev)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="home-footer"><span>NEON LOOP / RUNDOWN</span><span>Made for the moment.</span></div>
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
