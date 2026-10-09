/* Reading a guest list: CSV, pasted cells, or the first sheet of an Excel .xlsx file. */
import type { Guest } from './types';

export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '', d = (first.match(/\t/g) || []).length ? '\t' : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur === '') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(x => x));
}

/** Just enough of the Excel format to read the first sheet's cells. Needs DOMParser (browser). */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('not a spreadsheet');
  const files: Record<string, { method: number; data: Uint8Array }> = {}; let p = dv.getUint32(e + 16, true);
  for (let k = 0, n = dv.getUint16(e + 10, true); k < n; k++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)), start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    files[name] = { method, data: u8.subarray(start, start + size) }; p += 46 + nl + el + cl;
  }
  const text = async (name: string) => { const f = files[name]; if (!f) return ''; if (f.method === 0) return new TextDecoder().decode(f.data);
    return new Response(new Response(f.data as BodyInit).body!.pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
  const shared = Array.from(xml(await text('xl/sharedStrings.xml') || '<x/>').getElementsByTagName('si')).map(si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join(''));
  const sheet = Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10))[0];
  if (!sheet) throw new Error('no sheet');
  const rows: string[][] = [];
  Array.from(xml(await text(sheet)).getElementsByTagName('row')).forEach(r => {
    const out: string[] = [];
    Array.from(r.getElementsByTagName('c')).forEach(c => {
      const ref = (c.getAttribute('r') || '').replace(/\d+/g, ''); let col = 0; for (const ch of ref) col = col * 26 + ch.charCodeAt(0) - 64;
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0];
      out[Math.max(0, col - 1)] = (t === 's' ? shared[+(v ? v.textContent || -1 : -1)] || '' : is ? is.textContent || '' : v ? v.textContent || '' : '').trim();
    });
    for (let i = 0; i < out.length; i++) if (out[i] == null) out[i] = '';
    if (out.some(x => x)) rows.push(out);
  });
  return rows;
}

export type ImportField = 'first' | 'last' | 'full' | 'email' | 'phone' | 'company' | 'table' | 'tag' | 'newDonor';
export const IMPORT_FIELDS: [ImportField, string, RegExp][] = [
  ['first', 'First name', /^(first(?![ -]?time)|given|fname)/i], ['last', 'Last name', /^(last|surname|family|lname|last ?name|lastname)/i], ['full', 'Full name', /^(name|full ?name|guest|attendee)$/i],
  ['email', 'Email', /e-?mail/i], ['phone', 'Mobile', /(mobile|phone|cell|contact number)/i], ['company', 'Company', /(company|organi[sz]ation|employer|business)/i], ['table', 'Table', /^table/i],
  ['tag', 'Wristband ID', /(wristband|band|tag id|nfc|rfid)/i], ['newDonor', 'First-time donor', /^(first[ -]?time|new donor|new)/i]];

/** Column index per field, guessed from the headings (-1 when not found). The last matching heading wins. */
export function guessColumns(head: string[]): Record<ImportField, number> {
  const m = {} as Record<ImportField, number>;
  IMPORT_FIELDS.forEach(([f, , re]) => { m[f] = -1; head.forEach((h, i) => { if (re.test(h)) m[f] = i; }); });
  return m;
}

/** Rows (headings first) to guest details using the chosen columns. */
export function rowsToGuests(rows: string[][], m: Record<ImportField, number>): Partial<Guest>[] {
  const cell = (r: string[], k: ImportField) => m[k] >= 0 ? (r[m[k]] || '').trim() : '';
  return rows.slice(1).map(r => {
    let first = cell(r, 'first'), last = cell(r, 'last'); const full = cell(r, 'full');
    if (!first && !last && full) { const parts = full.split(/\s+/); first = parts.shift() || ''; last = parts.join(' '); }
    let phone = cell(r, 'phone').replace(/\.0$/, ''); if (/^4\d{8}$/.test(phone)) phone = '0' + phone;     // Excel drops the leading 0 of a mobile number
    return { first, last, email: cell(r, 'email'), phone, company: cell(r, 'company'), table: cell(r, 'table').replace(/\.0$/, ''), tag: cell(r, 'tag'), newDonor: /^(y|yes|true|1|x|new|first)/i.test(cell(r, 'newDonor')) };
  }).filter(g => g.first || g.last || g.company);
}

/** Key used to merge a re-import into an existing list: email, or name and company. */
export const mergeKey = (g: Partial<Guest>) => (g.email || '').toLowerCase() || ((((g.first || '') + ' ' + (g.last || '')).trim() || g.company || 'Unnamed') + '|' + (g.company || '')).toLowerCase();
