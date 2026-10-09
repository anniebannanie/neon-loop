/* The rundown as stored in Supabase (events.rundown), shared with the live show.
   Fields this app does not edit are always carried through untouched. */
import type { Segment } from './types';
import { clock, fmt, gap, parseClock } from './time';

export interface Rundown {
  start: string;           // show start "HH:MM" or ''
  end: string;             // finish "HH:MM" or ''
  holdMusic: string;
  trans: string;           // default transition
  items: Segment[];
  [extra: string]: unknown;
}
export interface EventRow { id: string; name: string; type: string; event_date: string | null; rules: unknown; rundown: unknown; holding_asset: string | null; fade_ms: number; updated_at: string }

export const TRANSITIONS: Record<string, string> = { cut: 'Cut', fade: 'Fade', dip: 'Dip to black', slide: 'Slide', zoom: 'Zoom' };
export const SPEEDS: [number, string][] = [[400, 'Quick'], [800, 'Medium'], [1200, 'Slow']];

const key = () => (globalThis.crypto && 'randomUUID' in crypto ? crypto.randomUUID() : 'k' + Math.random().toString(36).slice(2) + Date.now().toString(36));

/** Reads either shape the live show has stored: a bare list of items (oldest) or the full object. Every segment gets a stable key. */
export function readRundown(raw: unknown): Rundown {
  const r = (Array.isArray(raw) ? { items: raw } : raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : []).map((it: Segment) => ({ ...it, k: it.k || key(), title: it.title || '', dur: +it.dur || 0 }));
  return { ...r, start: String(r.start || ''), end: String(r.end || ''), holdMusic: String(r.holdMusic || ''), trans: String(r.trans || ''), items } as Rundown;
}

export function newSegment(title = 'New segment'): Segment { return { k: key(), title, who: '', asset: '', music: '', audio: '', lx: '', dur: 300, notes: '' }; }

export function moveItem(items: Segment[], from: number, to: number): Segment[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const next = items.slice(), [it] = next.splice(from, 1); next.splice(Math.max(0, Math.min(to, next.length)), 0, it); return next;
}
export function insertItem(items: Segment[], at: number, it: Segment = newSegment()): Segment[] { const next = items.slice(); next.splice(at, 0, it); return next; }
export function removeItem(items: Segment[], at: number): Segment[] { return items.filter((_, i) => i !== at); }
export function updateItem(items: Segment[], at: number, patch: Partial<Segment>): Segment[] { return items.map((it, i) => (i === at ? { ...it, ...patch } : it)); }

/** Clock time per row when the show start is set, otherwise running time from the top. */
export function startLabels(items: Segment[], start: string): string[] {
  const base = parseClock(start); let t = 0;
  return items.map(it => { const s = base == null ? fmt(t) : clock(base + t); t += it.dur || 0; return s; });
}
export const totalLength = (items: Segment[]) => items.reduce((n, it) => n + (it.dur || 0), 0);

/** How the plan sits against the finish time: seconds over (positive) or spare (negative), or null. */
export function againstFinish(items: Segment[], start: string, end: string): number | null {
  const b = parseClock(start), f = parseClock(end); return b == null || f == null ? null : gap((b + totalLength(items)) % 86400, f);
}

/** The first row whose fixed start the plan misses by a minute or more. */
export function missedFixed(items: Segment[], start: string): { title: string; by: number; fix: number } | null {
  const b = parseClock(start); if (b == null) return null; let t = 0;
  for (const it of items) { const fx = parseClock(it.fix); if (fx != null) { const g = gap((b + t) % 86400, fx); if (Math.abs(g) >= 60) return { title: it.title || 'Segment', by: g, fix: fx }; } t += it.dur || 0; }
  return null;
}
