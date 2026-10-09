import { forecast, timing, lengthWhenTaken, shrink, effDur } from './forecast';
import { daySecs } from './time';
import type { Segment, RunState } from './types';

const at = (h: number, m: number, s = 0) => new Date(2026, 9, 7, h, m, s).getTime();
const rundown = (type: Segment['type'] = 'flex'): Segment[] => [
  { k: 'a', title: 'Doors and arrivals', dur: 1800 },
  { k: 'b', title: 'Welcome and MC intro', dur: 600 },
  { k: 'c', title: 'Meal break', dur: 1200, type },
  { k: 'd', title: 'Q&A 1', dur: 360, fix: '19:30' },
  { k: 'e', title: 'Close', dur: 600 }
];

test('a flexible break never goes below half, a fixed one never shrinks', () => {
  expect(shrink({ k: 'x', title: '', dur: 1200, type: 'flex' }, 360)).toBe(840);
  expect(shrink({ k: 'x', title: '', dur: 1200, type: 'flex' }, 5000)).toBe(600);
  expect(shrink({ k: 'x', title: '', dur: 1200, type: 'break' }, 360)).toBe(1200);
  expect(shrink({ k: 'x', title: '', dur: 1200, type: 'flex' }, -60)).toBe(1200);
});

test('before the show, rows start where the plan says', () => {
  const f = forecast(rundown(), '18:30', { current: -1, cued: 0, startedAt: 0, hold: false }, at(18, 20), false);
  expect(f.arr[3]).toBe(daySecs(at(19, 30))); expect(f.rem).toBe(4560);
});

test('an overrun before a flexible break is absorbed, so the fixed start still holds', () => {
  const run: RunState = { current: 1, cued: 2, startedAt: at(19, 0), hold: false, t0: at(18, 30) };
  const f = forecast(rundown(), '18:30', run, at(19, 16), true);
  expect(f.arr[2]).toBe(daySecs(at(19, 16))); expect(f.arr[3]).toBe(daySecs(at(19, 30)));
  expect(lengthWhenTaken(rundown(), 2, '18:30', run.t0!, at(19, 16))).toBe(840);
  const t = timing(rundown(), '18:30', '21:00', run, at(19, 16));
  expect(Math.round(t.behind!)).toBe(0); expect(t.lateStart).toBe(0);
});

test('a fixed-length break passes the overrun on', () => {
  const run: RunState = { current: 1, cued: 2, startedAt: at(19, 0), hold: false, t0: at(18, 30) };
  const f = forecast(rundown('break'), '18:30', run, at(19, 16), true);
  expect(f.arr[3]).toBe(daySecs(at(19, 36)));
});

test('very late: the break stops at half and the fixed start is missed', () => {
  const run: RunState = { current: 1, cued: 2, startedAt: at(19, 31), hold: false, t0: at(19, 31) };
  const f = forecast(rundown(), '18:30', run, at(19, 31), true);
  expect(f.arr[2]).toBe(daySecs(at(19, 41))); expect(f.arr[3]).toBe(daySecs(at(19, 51)));
  const t = timing(rundown(), '18:30', '21:00', run, at(19, 31));
  expect(t.lateStart).toBe(61 * 60);
});

test('a shortened break runs to its recorded length', () => {
  const run: RunState = { current: 2, cued: 3, startedAt: at(19, 16), hold: false, t0: at(18, 30), act: { c: { s: at(19, 16), d: 840 } } };
  expect(effDur(rundown()[2], run)).toBe(840);
  const t = timing(rundown(), '18:30', '19:45', run, at(19, 20));
  expect(t.f.arr[3]).toBe(daySecs(at(19, 30))); expect(Math.round(t.vsFin!)).toBe(daySecs(at(19, 46)) - daySecs(at(19, 45)));
});

test('a run left over from days ago is not treated as live', () => {
  const run: RunState = { current: 1, cued: 2, startedAt: at(19, 0), hold: false, t0: at(19, 0) };
  expect(timing(rundown(), '18:30', '', run, at(19, 0) + 3 * 86400000).started).toBe(false);
});
