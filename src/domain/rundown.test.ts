import { readRundown, moveItem, insertItem, removeItem, updateItem, startLabels, againstFinish, missedFixed, totalLength } from './rundown';
import type { Segment } from './types';

const seg = (k: string, dur: number, extra: Partial<Segment> = {}): Segment => ({ k, title: k, dur, ...extra });

test('reads both stored shapes and keeps fields it does not know', () => {
  expect(readRundown([{ title: 'Doors', dur: 600 }]).items[0]).toMatchObject({ title: 'Doors', dur: 600 });
  expect(readRundown([{ title: 'Doors', dur: 600 }]).items[0].k).toBeTruthy();
  const r = readRundown({ start: '18:30', end: '21:00', holdMusic: 'm1', trans: 'dip', items: [{ k: 'a', title: 'A', dur: 60, org: 'o1', lx: 'warm' }], future: 1 });
  expect(r).toMatchObject({ start: '18:30', end: '21:00', holdMusic: 'm1', trans: 'dip', future: 1 }); expect(r.items[0]).toMatchObject({ k: 'a', org: 'o1', lx: 'warm' });
  expect(readRundown(null).items).toEqual([]);
});
test('moving, inserting, removing and editing rows', () => {
  const a = [seg('a', 60), seg('b', 60), seg('c', 60)];
  expect(moveItem(a, 0, 2).map(x => x.k)).toEqual(['b', 'c', 'a']); expect(moveItem(a, 2, 0).map(x => x.k)).toEqual(['c', 'a', 'b']); expect(moveItem(a, 1, 1)).toBe(a);
  expect(insertItem(a, 1).length).toBe(4); expect(insertItem(a, 1)[1].title).toBe('New segment');
  expect(removeItem(a, 1).map(x => x.k)).toEqual(['a', 'c']);
  expect(updateItem(a, 1, { title: 'B!' })[1]).toMatchObject({ k: 'b', title: 'B!', dur: 60 }); expect(a[1].title).toBe('b');
});
test('start times, length, and the finish', () => {
  const a = [seg('a', 1800), seg('b', 600, { fix: '19:05' }), seg('c', 360)];
  expect(startLabels(a, '')).toEqual(['0:00', '30:00', '40:00']);
  expect(startLabels(a, '18:30')[1]).toMatch(/^7:00\s?pm$/i);
  expect(totalLength(a)).toBe(2760);
  expect(againstFinish(a, '18:30', '19:30')).toBe(-840); expect(againstFinish(a, '18:30', '19:10')).toBe(360); expect(againstFinish(a, '', '19:10')).toBeNull();
  expect(missedFixed(a, '18:30')).toMatchObject({ title: 'b', by: -300 }); expect(missedFixed(a, '18:35')).toBeNull();
});
