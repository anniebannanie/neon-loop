import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { readRundown, type EventRow, type Rundown } from '../domain/rundown';
import { useOnline } from './offline';

/* One event's rundown and show settings, read from Supabase and saved back a moment after each change.
   The last copy and any unsaved change are kept on this device, so the page opens and edits survive
   without internet; they are sent when the connection returns. The live show picks the changes up on
   its next sync. */
export interface EventDoc { name: string; holdingAsset: string; fadeMs: number; rd: Rundown; updatedAt: string; rules: unknown }
export type SaveState = 'loading' | 'saved' | 'saving' | 'waiting' | 'error';

const cacheKey = (id: string) => 'neonloop.app.event.' + id, pendKey = (id: string) => 'neonloop.app.pending.' + id;
const ls = { get<T>(k: string): T | null { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k: string, v: unknown) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } } };
const fromRow = (r: EventRow): EventDoc => ({ name: r.name, holdingAsset: r.holding_asset || '', fadeMs: r.fade_ms == null ? 400 : r.fade_ms, rd: readRundown(r.rundown), updatedAt: r.updated_at, rules: r.rules });
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function useEventDoc(id: string) {
  const [doc, setDoc] = useState<EventDoc | null>(() => ls.get<EventDoc>(pendKey(id)) || ls.get<EventDoc>(cacheKey(id)));
  const [state, setState] = useState<SaveState>(() => (ls.get(pendKey(id)) ? 'waiting' : 'loading')), [error, setError] = useState('');
  const timer = useRef(0), online = useOnline(), latest = useRef(doc);
  latest.current = doc;

  const push = useCallback(async () => {
    const d = latest.current; if (!d || !supabase) return;
    setState('saving');
    const patch = { name: d.name, holding_asset: isUuid(d.holdingAsset) ? d.holdingAsset : null, fade_ms: d.fadeMs, updated_at: new Date().toISOString(), rundown: { ...d.rd } };
    const { data, error } = await supabase.from('events').update(patch).eq('id', id).select('updated_at');
    if (error) { const net = /fetch|network|Failed/i.test(error.message); setState(net ? 'waiting' : 'error'); setError(net ? '' : error.message); return; }
    if (!data || !data.length) { setState('error'); setError('Only a producer can change this rundown.'); return; }
    const saved = { ...d, updatedAt: data[0].updated_at };
    ls.set(cacheKey(id), saved); if (latest.current === d) { ls.set(pendKey(id), null); setState('saved'); setError(''); }
  }, [id]);

  const load = useCallback(async () => {
    if (!supabase || ls.get(pendKey(id))) return;                    // never overwrite an unsaved change
    const { data, error } = await supabase.from('events').select('id, name, type, event_date, rules, rundown, holding_asset, fade_ms, updated_at').eq('id', id).maybeSingle();
    if (error) { if (!latest.current) { setState('error'); setError(error.message); } else setState('saved'); return; }
    if (!data) { setState('error'); setError('This event is not available to you.'); return; }
    const d = fromRow(data as EventRow); ls.set(cacheKey(id), d);
    if (!ls.get(pendKey(id))) { setDoc(d); setState('saved'); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (online && ls.get(pendKey(id))) push(); }, [online, id, push]);
  useEffect(() => {                                                   // coming back to the page: pick up changes made in the live show
    const f = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f);
  }, [load]);

  const change = useCallback((fn: (d: EventDoc) => EventDoc) => {
    setDoc(cur => { if (!cur) return cur; const next = fn(cur); ls.set(pendKey(id), next); latest.current = next; return next; });
    setState('waiting'); clearTimeout(timer.current); timer.current = window.setTimeout(push, 700);
  }, [id, push]);

  return { doc, state, error, change, reload: load };
}

export interface AssetLite { id: string; name: string; kind: 'image' | 'video' | 'web' | 'audio'; url: string | null }
export function useAssets(eventId: string) {
  const k = 'neonloop.app.assets.' + eventId, [list, setList] = useState<AssetLite[]>(() => ls.get<AssetLite[]>(k) || []);
  useEffect(() => {
    supabase?.from('assets').select('id, name, kind, url').eq('event_id', eventId).order('created_at').then(({ data }) => { if (data) { setList(data as AssetLite[]); ls.set(k, data); } });
  }, [eventId, k]);
  return list;
}
