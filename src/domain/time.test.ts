import { fmt, parseDur, parseClock, gap, span, clock } from './time';

test('durations format like a broadcast timer', () => {
  expect(fmt(75)).toBe('1:15'); expect(fmt(3725)).toBe('1:02:05'); expect(fmt(-75)).toBe('+1:15'); expect(fmt(0)).toBe('0:00');
});
test('typed durations: minutes, m:ss, h:mm:ss', () => {
  expect(parseDur('5')).toBe(300); expect(parseDur('5:30')).toBe(330); expect(parseDur('1:05:00')).toBe(3900); expect(parseDur('')).toBe(0);
});
test('clock times', () => {
  expect(parseClock('18:30')).toBe(66600); expect(parseClock('7:05')).toBe(25500); expect(parseClock('18.30')).toBeNull(); expect(parseClock(undefined)).toBeNull();
  expect(clock(66600, 'en-AU')).toMatch(/^6:30\s?pm$/i);
});
test('gaps take the short way round midnight', () => {
  expect(gap(100, 86300)).toBe(200); expect(gap(86300, 100)).toBe(-200); expect(gap(3600, 0)).toBe(3600);
  expect(span(45)).toBe('45 sec'); expect(span(-240)).toBe('4:00');
});
