/* Where the show stands against its schedule. Pure functions: pass in the rundown,
   the run state and the time, get back the forecast. */
import type { Segment, RunState } from './types';
import { daySecs, gap, parseClock } from './time';

export const isBreak = (it: Segment) => it.type === 'break' || it.type === 'flex';

/** A flexible break taken late gives back the time the show is behind, never below half its length. */
export function shrink(it: Segment, behind: number): number {
  const d = it.dur || 0;
  return it.type === 'flex' && behind > 0 ? Math.max(Math.round(d / 2), Math.round(d - behind)) : d;
}

/** The length a segment is actually running to: shortened if it was a flexible break taken late. */
export function effDur(it: Segment, run: RunState): number {
  const a = (run.act || {})[it.k];
  return a && a.d != null ? a.d : it.dur || 0;
}

/** Planned offsets from the top of the show, per row. */
export function planOffsets(items: Segment[]): number[] { let c = 0; return items.map(it => { const o = c; c += it.dur || 0; return o; }); }

/** The length to record when a segment is taken now (only flexible breaks change). */
export function lengthWhenTaken(items: Segment[], i: number, showStart: string | undefined, t0: number, now: number): number {
  const it = items[i], plan = planOffsets(items)[i], b = parseClock(showStart), bs = b == null ? daySecs(t0) : b;
  return shrink(it, gap(daySecs(now), (bs + plan) % 86400));
}

export interface Forecast { arr: (number | null)[]; rem: number; plan: number[] }

/** Expected start (seconds of the day) of every row still to come, and seconds left in the show. */
export function forecast(items: Segment[], showStart: string | undefined, run: RunState, now: number, started: boolean): Forecast {
  const b = parseClock(showStart), bs = b != null ? b : run.t0 ? daySecs(run.t0) : null, n = items.length, arr: (number | null)[] = new Array(n).fill(null), plan = planOffsets(items);
  const total = items.reduce((s, it) => s + (it.dur || 0), 0);
  if (!started) { if (bs != null) for (let i = 0; i < n; i++) arr[i] = bs + plan[i]; return { arr, rem: total, plan }; }
  const nowS = daySecs(now), cur = items[run.current];
  let rel = Math.max(0, effDur(cur, run) - (now - run.startedAt) / 1000);
  for (let i = run.current + 1; i < n; i++) { arr[i] = nowS + rel; rel += shrink(items[i], bs == null ? 0 : gap((nowS + rel) % 86400, (bs + plan[i]) % 86400)); }
  return { arr, rem: rel, plan };
}

export interface Timing {
  base: number | null; fin: number | null; total: number; started: boolean; f: Forecast;
  t0?: number; proj?: number; planEnd?: number; behind?: number; lateStart?: number | null; vsFin?: number | null;
}

/** Summary used by the status line: late start, behind or ahead, forecast finish against the finish time. */
export function timing(items: Segment[], showStart: string | undefined, showEnd: string | undefined, run: RunState, now: number): Timing {
  const base = parseClock(showStart), fin = parseClock(showEnd), total = items.reduce((n, it) => n + (it.dur || 0), 0);
  const started = !!run.t0 && run.current >= 0 && now - run.t0 < 64800000;      // a run left over from days ago does not count
  if (!started) return { base, fin, total, started, f: forecast(items, showStart, run, now, false) };
  const f = forecast(items, showStart, run, now, true), t0 = daySecs(run.t0!), proj = daySecs(now) + f.rem, planEnd = (base == null ? t0 : base) + total;
  return { base, fin, total, started, f, t0, proj, planEnd,
    behind: gap(proj % 86400, planEnd % 86400), lateStart: base == null ? null : gap(t0, base), vsFin: fin == null ? null : gap(proj % 86400, fin) };
}
