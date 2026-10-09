import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useAuth } from '../lib/auth';
import { liveShowUrl } from '../lib/supabase';
import { useAssets, useEventDoc, type EventDoc, type SaveState } from '../lib/useEventDoc';
import { againstFinish, insertItem, missedFixed, moveItem, removeItem, SPEEDS, startLabels, totalLength, TRANSITIONS, updateItem } from '../domain/rundown';
import { clock, fmt, parseClock, parseDur, span } from '../domain/time';
import { isBreak } from '../domain/forecast';
import type { Segment } from '../domain/types';

/* The rundown: planning and editing. Running the show (take, holding, the output window) still happens
   in the live show for now; this page shows what is on air there when it runs in this browser. */

const STATUS: Record<SaveState, [string, string]> = {
  loading: ['', 'Loading…'], saved: ['ok', 'All changes saved'], saving: ['', 'Saving…'],
  waiting: ['warn', 'Saved on this device, sending when online'], error: ['warn', 'Not saved']
};
const OPT: [keyof Segment, string, string][] = [['who', 'Who', 'On stage'], ['audio', 'Audio', 'Mics, music'], ['lx', 'Lighting', 'Lighting state']];

interface LiveRun { current: number; cued: number; hold: boolean; orgs: { id: string; name: string }[] }
/** What the live show is doing with this event, when it runs in this same browser. */
function useLiveRun(id: string): LiveRun | null {
  const read = () => { try { const b = JSON.parse(localStorage.getItem('neonloop.v3') || 'null'); const e = b && b.events && b.events.find((x: { id: string }) => x.id === id); return e ? { current: e.run ? e.run.current : -1, cued: e.run ? e.run.cued : 0, hold: !!(e.run && e.run.hold), orgs: e.orgs || [] } : null; } catch { return null; } };
  const [r, setR] = useState<LiveRun | null>(read);
  useEffect(() => { const t = setInterval(() => setR(read()), 1500), f = (e: StorageEvent) => { if (e.key === 'neonloop.v3') setR(read()); }; addEventListener('storage', f); return () => { clearInterval(t); removeEventListener('storage', f); }; }, [id]);   // eslint-disable-line
  return r;
}

export function Rundown({ eventId }: { eventId: string }) {
  const { profile } = useAuth(), canEdit = profile?.role === 'producer';
  const { doc, state, error, change } = useEventDoc(eventId), assets = useAssets(eventId), live = useLiveRun(eventId);
  const [edit, setEdit] = useState(false), hist = useRef<EventDoc[]>([]), touched = useRef<EventTarget | null>(null), [, bump] = useState(0);
  const [drag, setDrag] = useState<{ from: number; over: number; after: boolean } | null>(null);
  const pics = useMemo(() => assets.filter(a => a.kind !== 'audio'), [assets]), tracks = useMemo(() => assets.filter(a => a.kind === 'audio'), [assets]);
  const name = (id?: string) => (id ? (assets.find(a => a.id === id)?.name ?? 'Missing ⚠') : '');
  if (!doc) return <div className="card"><p className="muted">{state === 'error' ? error : 'Loading the rundown…'}</p></div>;
  const { rd } = doc, items = rd.items;

  /* every change goes through here; in Edit, the state before it is kept for Undo */
  const snap = () => { hist.current.push(doc); if (hist.current.length > 200) hist.current.shift(); bump(n => n + 1); };
  const apply = (fn: (d: EventDoc) => EventDoc, step = true) => { if (step) snap(); change(fn); };
  const setItems = (fn: (it: Segment[]) => Segment[], step = true) => apply(d => ({ ...d, rd: { ...d.rd, items: fn(d.rd.items) } }), step);
  const field = (i: number, f: keyof Segment, v: string, target?: EventTarget) => {
    const first = !target || touched.current !== target; if (target) touched.current = target;          // one undo step per visit to a box
    setItems(it => updateItem(it, i, { [f]: f === 'dur' ? parseDur(v) : v } as Partial<Segment>), first);
  };
  const setRd = (patch: Partial<typeof rd>) => apply(d => ({ ...d, rd: { ...d.rd, ...patch } }));
  const undo = () => { const prev = hist.current.pop(); if (prev) { change(() => prev); bump(n => n + 1); } };
  const toggleEdit = () => { setEdit(e => !e); hist.current = []; touched.current = null; };

  const starts = startLabels(items, rd.start), total = totalLength(items), vsFin = againstFinish(items, rd.start, rd.end), miss = missedFixed(items, rd.start);
  const orgs = live?.orgs || [], orgName = (id?: string) => orgs.find(o => o.id === id)?.name || '';
  const cols = OPT.filter(([f]) => edit || items.some(it => it[f])), hasMusic = edit || items.some(it => it.music), hasOrg = edit ? orgs.length > 0 : items.some(it => orgName(it.org));
  const onDrop = (e: DragEvent) => { e.preventDefault(); if (!drag) return; let to = drag.over + (drag.after ? 1 : 0); if (to > drag.from) to--; setItems(it => moveItem(it, drag.from, to)); setDrag(null); };
  const [stCls, stTxt] = STATUS[state];

  return (
    <div className="rundown">
      <div className="rd-head">
        <h2>Rundown</h2>
        <span className={'pill ' + stCls}><i />{state === 'error' && error ? error : stTxt}</span>
        <span className="spacer" />
        {edit && <button onClick={undo} disabled={!hist.current.length}>Undo</button>}
        {edit && <button onClick={() => setItems(it => insertItem(it, it.length))}>+ Add segment</button>}
        {canEdit && <button className={edit ? 'primary' : ''} onClick={toggleEdit}>{edit ? 'Done' : 'Edit rundown'}</button>}
        {!edit && <a href={liveShowUrl(eventId, 'rundown')}><button className="primary">Run the show</button></a>}
      </div>

      <div className="rd-stat">
        {parseClock(rd.start) != null && <span className="rs">Scheduled <b>{clock(parseClock(rd.start)!)}</b>{parseClock(rd.end) != null && <> to <b>{clock(parseClock(rd.end)!)}</b></>}</span>}
        <span className="rs">Planned to run <b>{fmt(total)}</b></span>
        {vsFin != null && <span className={'rs ' + (vsFin > 59 ? 'late' : vsFin < -59 ? 'good' : '')}>{Math.abs(vsFin) < 60 ? 'Fits the finish time' : <><b>{span(vsFin)}</b> {vsFin > 0 ? 'over the finish time' : 'spare before the finish'}</>}</span>}
        {miss && <span className={'rs ' + (miss.by > 0 ? 'late' : '')}><b>{miss.title}</b> is planned {span(miss.by)} {miss.by > 0 ? 'after' : 'before'} its fixed {clock(miss.fix)}</span>}
        {live && live.current >= 0 && <span className="rs onair"><i />Live show: {live.hold ? 'holding' : 'on air'}</span>}
      </div>

      {edit && (
        <div className="rd-editbar card">
          <label>Show starts at<input type="time" value={rd.start} onChange={e => setRd({ start: e.target.value })} /></label>
          <label>Finishes at<input type="time" value={rd.end} onChange={e => setRd({ end: e.target.value })} /></label>
          <label>Holding content<select value={doc.holdingAsset} onChange={e => apply(d => ({ ...d, holdingAsset: e.target.value }))}><option value="">None (black)</option>{pics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>Holding music<select value={rd.holdMusic} onChange={e => setRd({ holdMusic: e.target.value })}><option value="">None (silence)</option>{tracks.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>Transition<select value={rd.trans || 'fade'} onChange={e => setRd({ trans: e.target.value })}>{Object.entries(TRANSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Speed<select value={doc.fadeMs || 400} onChange={e => apply(d => ({ ...d, fadeMs: +e.target.value }))}>{SPEEDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
      )}

      <div className="tw">
        <table className={'rd-table' + (edit ? ' editing' : '')}>
          <thead><tr>
            <th>#</th><th className="hide-sm">{parseClock(rd.start) == null ? 'Running time' : 'Start'}</th><th>Segment</th>{edit && <th className="dur">Planned</th>}
            {cols.some(c => c[0] === 'who') && <th className="hide-sm">Who</th>}<th>Content</th>{hasOrg && <th className="hide-sm">Pledging for</th>}{hasMusic && <th className="hide-sm">Music</th>}
            {cols.filter(c => c[0] !== 'who').map(c => <th key={c[0]} className="hide-sm">{c[1]}</th>)}
            {edit && <><th>Transition</th><th>Type and fixed start</th></>}{!edit && <th className="dur">Planned</th>}{edit && <th>Notes</th>}<th className="st" />
          </tr></thead>
          <tbody onDragOver={e => { if (drag) e.preventDefault(); }} onDrop={onDrop}>
            {!items.length && <tr><td colSpan={12} className="muted" style={{ padding: 24 }}>No segments yet.{canEdit ? ' Choose Edit rundown, then Add segment.' : ''}</td></tr>}
            {items.map((it, i) => {
              const fx = parseClock(it.fix), onair = live && live.current === i, next = live && live.current >= 0 && live.cued === i;
              const cls = [isBreak(it) ? 'brk' : '', onair ? 'air' : next ? 'nxt' : '', drag && drag.over === i ? (drag.after ? 'drop-after' : 'drop-before') : ''].join(' ');
              const txt = (f: keyof Segment, label: string, hint?: string) => <input value={String(it[f] ?? '')} aria-label={label} placeholder={hint} onFocus={() => (touched.current = null)} onChange={e => field(i, f, e.target.value, e.target)} />;
              if (edit) return (
                <tr key={it.k} className={cls} onDragOver={e => { if (!drag) return; const r = e.currentTarget.getBoundingClientRect(); setDrag({ ...drag, over: i, after: e.clientY > r.top + r.height / 2 }); }}>
                  <td className="idx num"><span className="grip" draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); setDrag({ from: i, over: i, after: false }); }} onDragEnd={() => setDrag(null)} title="Drag to move">⠿</span>{i + 1}</td>
                  <td className="stt num">{starts[i]}</td>
                  <td>{txt('title', 'Segment')}</td>
                  <td className="dur"><input className="num" defaultValue={fmt(it.dur)} key={it.k + ':' + it.dur} aria-label="Planned length" onFocus={() => (touched.current = null)} onBlur={e => { const v = parseDur(e.target.value); if (v !== it.dur) field(i, 'dur', e.target.value); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></td>
                  {cols.some(c => c[0] === 'who') && <td>{txt('who', 'Who', 'On stage')}</td>}
                  <td><select value={it.asset || ''} aria-label="Content" onChange={e => field(i, 'asset', e.target.value)}><option value="">None (black)</option>{pics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}{it.asset && !pics.some(a => a.id === it.asset) && <option value={it.asset}>Missing ⚠</option>}</select></td>
                  {hasOrg && <td><select value={it.org || ''} aria-label="Pledging for" onChange={e => field(i, 'org', e.target.value)}><option value="">None</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></td>}
                  {hasMusic && <td><select value={it.music || ''} aria-label="Music" onChange={e => field(i, 'music', e.target.value)}><option value="">Silence</option>{tracks.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></td>}
                  {cols.filter(c => c[0] !== 'who').map(c => <td key={c[0]}>{txt(c[0], c[1], c[2])}</td>)}
                  <td><select value={it.trans || ''} aria-label="Transition" onChange={e => field(i, 'trans', e.target.value)}><option value="">Event default</option>{Object.entries(TRANSITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  <td className="typ"><select value={it.type || ''} aria-label="Type" onChange={e => field(i, 'type', e.target.value)}><option value="">Segment</option><option value="break">Break, fixed length</option><option value="flex">Break, can shorten</option></select>
                    <input type="time" value={it.fix || ''} aria-label="Fixed start" title="Fixed start, if this must begin at a set time" onChange={e => field(i, 'fix', e.target.value)} /></td>
                  <td>{txt('notes', 'Notes')}</td>
                  <td className="st"><div className="rowbtns">
                    <button title="Add a segment below" onClick={() => setItems(x => insertItem(x, i + 1))}>+</button>
                    <button title="Move up" disabled={!i} onClick={() => setItems(x => moveItem(x, i, i - 1))}>↑</button>
                    <button title="Move down" disabled={i === items.length - 1} onClick={() => setItems(x => moveItem(x, i, i + 1))}>↓</button>
                    <button title="Delete" onClick={() => { if (confirm('Delete "' + (it.title || 'this segment') + '" from the rundown?')) setItems(x => removeItem(x, i)); }}>✕</button>
                  </div></td>
                </tr>
              );
              return (
                <tr key={it.k} className={cls}>
                  <td className="idx num">{i + 1}</td>
                  <td className="stt num hide-sm">{starts[i]}</td>
                  <td>{it.title}{it.notes && <div className="note">{it.notes}</div>}
                    {(isBreak(it) || fx != null) && <div>{isBreak(it) && <span className="rk">{it.type === 'flex' ? 'Break, can shorten to ' + fmt(Math.round((it.dur || 0) / 2)) : 'Break'}</span>}{fx != null && <span className="rk">Fixed start {clock(fx)}</span>}</div>}</td>
                  {cols.some(c => c[0] === 'who') && <td className="crew hide-sm">{it.who}</td>}
                  <td><span className={'cont' + (it.asset ? '' : ' none')}>{it.asset ? name(it.asset) : 'Black'}</span></td>
                  {hasOrg && <td className="crew hide-sm">{orgName(it.org)}</td>}
                  {hasMusic && <td className="crew hide-sm">{it.music ? '♪ ' + name(it.music) : ''}</td>}
                  {cols.filter(c => c[0] !== 'who').map(c => <td key={c[0]} className="crew hide-sm">{String(it[c[0]] ?? '')}</td>)}
                  <td className="dur num">{fmt(it.dur)}</td>
                  <td className="st">{onair ? <span className="tag air">{live!.hold ? 'HOLDING' : 'ON AIR'}</span> : next ? <span className="tag nxt">NEXT</span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted rd-foot">{edit ? 'Changes save as you go. Drag a row by its handle to move it.' : 'Run the show opens this rundown in the live show, with the output window, take and holding.'}</p>
    </div>
  );
}
