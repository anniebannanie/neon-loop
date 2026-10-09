/* Pledge totals, matching, budgets and who has given. */
import type { Guest, Org, OrgTotal, Pledge } from './types';

export function money(n: number): string { return '$' + (Math.round(n * 100) / 100).toLocaleString('en-AU', { maximumFractionDigits: 2 }); }
export function gname(g?: Guest | null): string { return g ? ((g.first || '') + ' ' + (g.last || '')).trim() || g.company || 'Unnamed' : ''; }
export function gfull(g: Guest): string { const n = ((g.first || '') + ' ' + (g.last || '')).trim(); return n ? n + (g.company ? ' (' + g.company + ')' : '') : g.company || 'Unnamed'; }

/** Per organisation: pledged, count, matched (capped by the matched funding available) and total. */
export function orgTotals(orgs: Org[], pledges: Pledge[]): Record<string, OrgTotal> {
  const t: Record<string, OrgTotal> = {};
  orgs.forEach(o => { t[o.id] = { donated: 0, n: 0, matched: 0, total: 0 }; });
  pledges.forEach(p => { if (t[p.org]) { t[p.org].donated += p.amount; t[p.org].n++; } });
  orgs.forEach(o => { const x = t[o.id]; x.matched = Math.min(+(o.match || 0), x.donated); x.total = x.donated + x.matched; });
  return t;
}
export const grandTotal = (orgs: Org[], t: Record<string, OrgTotal>) => orgs.reduce((n, o) => n + (t[o.id] ? t[o.id].total : 0), 0);
export function budgetUsed(pledges: Pledge[]): number { return pledges.filter(p => p.fund === 'budget').reduce((n, p) => n + p.amount, 0); }

/** "8 weeks of tutoring", or '' below two units. */
export function impactOf(o: Org, amt: number): string {
  const n = +(o.impactAmt || 0) > 0 && o.impactUnit ? Math.floor(amt / o.impactAmt!) : 0;
  return n >= 2 ? n.toLocaleString('en-AU') + ' ' + o.impactUnit : '';
}

export interface PeopleStats { names: string[]; count: number; firsts: number; comp: Record<string, number> }

/** Distinct people who have given (never amounts). Anonymous donors count but are not named. */
export function peopleStats(guests: Guest[], pledges: Pledge[]): PeopleStats {
  const gs: Record<string, Guest> = {}, seen: Record<string, 'anon' | 'named'> = {}, names: string[] = [], comp: Record<string, number> = {};
  let count = 0, firsts = 0; guests.forEach(g => { gs[g.id] = g; });
  pledges.forEach(p => {
    const g = gs[p.donorId], key = p.donorId || (p.anon ? p.id : 'n:' + p.donorName); if (!key || key === 'n:') return;
    const was = seen[key]; if (was === 'named') return;
    if (!was) { count++; if (g && g.newDonor) firsts++; if (g && g.kind !== 'org' && g.company) comp[g.company] = (comp[g.company] || 0) + 1; }
    if (p.anon) { seen[key] = 'anon'; return; }
    seen[key] = 'named'; names.push(g ? gname(g) : p.donorName);
  });
  return { names, count, firsts, comp };
}
