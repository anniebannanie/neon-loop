/* Which takeovers a new pledge should fire. At most one celebration of the organisation or the room per
   pledge, plus the big-pledge moment; the order matches what the room should see. */
import type { Guest, Org, OrgTotal, Pledge, TakeoverConfig } from './types';
import { peopleStats } from './pledges';

export type TakeoverKind = 'big' | 'big-ask' | 'target' | 'match' | 'company' | 'firsts' | 'mile';
export interface Moment { kind: TakeoverKind; company?: string; count?: number; milestone?: number }

export const defaultTakeovers = (): TakeoverConfig => ({ big: 1000, step: 5000, target: true, match: true, ask: true });

/** A donor's first pledge of the night can tip their company, or the first-time donors, over a multiple of five. */
export function peopleMoment(p: Pledge, guests: Guest[], pledges: Pledge[]): Moment | null {
  const g = guests.find(x => x.id === p.donorId); if (!g || pledges.some(x => x !== p && x.donorId === p.donorId)) return null;
  const s = peopleStats(guests, pledges), n = g.kind !== 'org' && g.company ? s.comp[g.company] || 0 : 0;
  if (n >= 5 && n % 5 === 0) return { kind: 'company', company: g.company, count: n };
  if (g.newDonor && s.firsts >= 5 && s.firsts % 5 === 0) return { kind: 'firsts', count: s.firsts };
  return null;
}

/** `pledges` already includes `p`. `was` and `grandWas` are the figures from just before it. */
export function momentsFor(cfg: TakeoverConfig, o: Org, p: Pledge, was: OrgTotal, now: OrgTotal, grandWas: number, grand: number, guests: Guest[], pledges: Pledge[]): Moment[] {
  const out: Moment[] = [];
  if (+cfg.big > 0 && p.amount >= +cfg.big) out.push({ kind: cfg.ask ? 'big-ask' : 'big' });
  let pm: Moment | null = null;
  if (cfg.target && +(o.target || 0) > 0 && was.total < +o.target! && now.total >= +o.target!) out.push({ kind: 'target' });
  else if (cfg.match && +(o.match || 0) > 0 && was.matched < +o.match! && now.matched >= +o.match!) out.push({ kind: 'match' });
  else if (cfg.people !== false && (pm = peopleMoment(p, guests, pledges))) out.push(pm);
  else if (+cfg.step > 0 && Math.floor(grand / cfg.step) > Math.floor(grandWas / cfg.step)) out.push({ kind: 'mile', milestone: Math.floor(grand / cfg.step) * cfg.step });
  return out;
}
