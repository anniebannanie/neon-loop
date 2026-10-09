// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCsv, readXlsx, guessColumns, rowsToGuests, mergeKey } from './guestImport';

test('CSV with quotes, commas and blank lines', () => {
  expect(parseCsv('Name,Company\n"O\'Brien, ""Mick""",Bupa\n\nAsad,"Hope, Ltd"\n')).toEqual([['Name', 'Company'], ['O\'Brien, "Mick"', 'Bupa'], ['Asad', 'Hope, Ltd']]);
});
test('pasted cells are tab separated, European CSV uses semicolons', () => {
  expect(parseCsv('First\tLast\nZoe\tZhang')).toEqual([['First', 'Last'], ['Zoe', 'Zhang']]);
  expect(parseCsv('First;Last\nZoe;Zhang')).toEqual([['First', 'Last'], ['Zoe', 'Zhang']]);
});
test('a First time column is not mistaken for the first name', () => {
  const m = guessColumns(['First name', 'Last name', 'Company', 'First time', 'Mobile', 'Wristband']);
  expect(m.first).toBe(0); expect(m.newDonor).toBe(3); expect(m.phone).toBe(4); expect(m.tag).toBe(5); expect(m.full).toBe(-1);
});
test('rows become guests; Excel mobiles get their leading 0 back', () => {
  const rows = [['Name', 'Mobile', 'Table', 'New'], ['Loren Alderuccio', '434040767', '3.0', 'Yes'], ['', '', '', '']];
  const g = rowsToGuests(rows, guessColumns(rows[0]));
  expect(g).toHaveLength(1); expect(g[0]).toMatchObject({ first: 'Loren', last: 'Alderuccio', phone: '0434040767', table: '3', newDonor: true });
  expect(mergeKey({ email: 'A@B.com' })).toBe('a@b.com'); expect(mergeKey({ first: 'Zoe', company: 'Lynxx' })).toBe('zoe|lynxx');
});
test('reads the first sheet of an Excel file', async () => {
  const b = readFileSync(resolve(process.cwd(), 'src/domain/__fixtures__/guests.xlsx'));
  const rows = await readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  expect(rows[0]).toEqual(expect.arrayContaining(['First Name', 'Last Name', 'Email', 'Mobile', 'Company', 'Table']));
  expect(rowsToGuests(rows, guessColumns(rows[0]))).toHaveLength(6);
});
