import { momentsFor, defaultTakeovers } from './takeovers';
import { orgTotals, grandTotal } from './pledges';
import type { Guest, Org, Pledge } from './types';

let n = 0; const pl = (org: string, amount: number, donorId = ''): Pledge => ({ id: 'p' + (++n), ts: n, org, amount, donorId, donorName: '', anon: false, fund: 'own' });
const orgs: Org[] = [{ id: 'r', name: 'River Nile', target: 5000 }, { id: 'h', name: 'Hope Network', match: 1000 }];
function add(list: Pledge[], p: Pledge, guests: Guest[] = [], cfg = defaultTakeovers()) {
  const before = orgTotals(orgs, list), after = [...list, p], now = orgTotals(orgs, after);
  return { list: after, m: momentsFor(cfg, orgs.find(o => o.id === p.org)!, p, before[p.org], now[p.org], grandTotal(orgs, before), grandTotal(orgs, now), guests, after).map(x => x.kind) };
}

test('ordinary pledge: nothing', () => { expect(add([], pl('r', 200)).m).toEqual([]); });
test('big pledge waits for approval by default', () => { expect(add([], pl('r', 2000)).m).toEqual(['big-ask']); });
test('crossing the target celebrates the organisation', () => { expect(add([pl('r', 3700)], pl('r', 1500)).m).toEqual(['big-ask', 'target']); });
test('matched funding fully used', () => { expect(add([pl('h', 600)], pl('h', 450)).m).toEqual(['match']); });
test('milestone when the night crosses a step', () => { expect(add([pl('r', 3700), pl('h', 600)], pl('r', 100)).m).toEqual(['mile']); });
test('target outranks the milestone', () => { expect(add([pl('r', 4900)], pl('r', 200)).m).toEqual(['target']); });
test('the fifth person from one company', () => {
  const guests: Guest[] = [1, 2, 3, 4, 5].map(i => ({ id: 'g' + i, first: 'B' + i, company: 'Bupa' }));
  let list: Pledge[] = []; let last: string[] = [];
  for (let i = 1; i <= 5; i++) { const r = add(list, pl('r', 10, 'g' + i), guests); list = r.list; last = r.m; }
  expect(last).toEqual(['company']);
  expect(add(list, pl('r', 10, 'g5'), guests).m).toEqual([]);      // a repeat pledge does not fire it again
});
test('everything can be switched off', () => {
  expect(add([pl('r', 4900)], pl('r', 9000), [], { big: 0, step: 0, target: false, match: false, ask: false, people: false }).m).toEqual([]);
});
