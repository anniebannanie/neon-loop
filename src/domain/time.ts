/* Times and durations. Durations are seconds; clock times are seconds since midnight. */

/** 75 -> "1:15", 3725 -> "1:02:05", negative -> "+1:15" (over time). */
export function fmt(sec: number): string {
  const neg = sec < 0; sec = Math.abs(Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (neg ? '+' : '') + (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

/** "5" -> 300 (minutes), "5:30" -> 330, "1:05:00" -> 3900. */
export function parseDur(v: string): number {
  const p = String(v).trim().split(':').map(x => parseInt(x, 10) || 0);
  return p.length === 1 ? p[0] * 60 : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
}

/** "18:30" -> 66600, anything else -> null. */
export function parseClock(v: string | undefined | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 : null;
}

/** Seconds since midnight -> "6:30 pm" in the given locale. */
export function clock(sec: number, locale?: string): string {
  sec = ((sec % 86400) + 86400) % 86400;
  return new Date(2000, 0, 1, 0, 0, sec).toLocaleTimeString(locale || [], sec % 60 ? { hour: 'numeric', minute: '2-digit', second: '2-digit' } : { hour: 'numeric', minute: '2-digit' });
}

/** A timestamp's local time of day, in seconds. */
export function daySecs(t: number): number { const d = new Date(t); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }

/** Difference between two times of day, taking the short way round midnight. */
export function gap(a: number, b: number): number { let d = a - b; if (d > 43200) d -= 86400; else if (d < -43200) d += 86400; return d; }

/** A gap for people: "45 sec" or "4:00". */
export function span(sec: number): string { sec = Math.abs(Math.round(sec)); return sec < 60 ? sec + ' sec' : fmt(sec); }
