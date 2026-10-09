import { orgTotals, grandTotal, impactOf, peopleStats, budgetUsed, gfull, money } from './pledges';
import type { Guest, Org, Pledge } from './types';

const orgs: Org[] = [{ id: 'r', name: 'River Nile', target: 5000, impactAmt: 250, impactUnit: 'weeks of tutoring' }, { id: 'h', name: 'Hope Network', match: 1000 }];
let n = 0; const pl = (org: string, amount: number, extra: Partial<Pledge> = {}): Pledge => ({ id: 'p' + (++n), ts: n, org, amount, donorId: '', donorName: '', anon: false, fund: 'own', ...extra });

test('matching is added up to the funding available', () => {
  let t = orgTotals(orgs, [pl('h', 600)]); expect(t.h).toEqual({ donated: 600, n: 1, matched: 600, total: 1200 });
  t = orgTotals(orgs, [pl('h', 600), pl('h', 700)]); expect(t.h.total).toBe(2300); expect(t.h.matched).toBe(1000);
  expect(grandTotal(orgs, orgTotals(orgs, [pl('r', 500), pl('h', 600)]))).toBe(1700);
});
test('pledges to a removed organisation do not count', () => { expect(grandTotal(orgs, orgTotals(orgs, [pl('gone', 900)]))).toBe(0); });
test('impact lines from two units up', () => {
  expect(impactOf(orgs[0], 2000)).toBe('8 weeks of tutoring'); expect(impactOf(orgs[0], 250)).toBe(''); expect(impactOf(orgs[1], 5000)).toBe('');
});
test('budget used counts only budget pledges', () => { expect(budgetUsed([pl('r', 100), pl('r', 2000, { fund: 'budget' })])).toBe(2000); });
test('names and money', () => {
  expect(gfull({ id: '1', first: 'Loren', last: 'Alderuccio', company: 'Bupa' })).toBe('Loren Alderuccio (Bupa)'); expect(gfull({ id: '2', company: 'AMP' })).toBe('AMP');
  expect(money(12000)).toBe('$12,000'); expect(money(12.5)).toBe('$12.5');
});
test('people who have given: once each, anonymous counted not named', () => {
  const guests: Guest[] = [{ id: 'a', first: 'Ann', last: 'Lee', company: 'Bupa', newDonor: true }, { id: 'b', first: 'Bob', company: 'Bupa' }, { id: 'c', first: 'Cy' }];
  const s = peopleStats(guests, [pl('r', 10, { donorId: 'a' }), pl('r', 20, { donorId: 'a' }), pl('h', 5, { donorId: 'b', anon: true }), pl('r', 7, { donorId: 'c' }), pl('r', 9, { anon: true })]);
  expect(s.count).toBe(4); expect(s.names).toEqual(['Ann Lee', 'Cy']); expect(s.firsts).toBe(1); expect(s.comp).toEqual({ Bupa: 2 });
});
