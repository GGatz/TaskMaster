import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, applyFilters, applySorts, convertValue, impliedDefaults, visibleRows } from './dbquery.js';

const schema = [
  { id: 'title', type: 'title' },
  { id: 's', type: 'status', options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
  { id: 'd', type: 'date' },
  { id: 'n', type: 'number' },
  { id: 't', type: 'multi_select', options: [{ id: 'x', name: 'X' }] },
];
const rows = [
  { id: 1, title: 'Banana', props: { s: 'b', d: { start: '2026-10-05', end: null }, n: 3, t: ['x'] }, position: 1, created_at: 0, updated_at: 0 },
  { id: 2, title: 'apple', props: { s: 'a', d: { start: '2026-10-01', end: '2026-10-03' }, n: 10 }, position: 2, created_at: 0, updated_at: 0 },
  { id: 3, title: 'Cherry', props: {}, position: 3, created_at: 0, updated_at: 0 },
];
const view = (o) => ({ filters: [], sorts: [], filterMode: 'and', ...o });
const ids = (r) => r.map((x) => x.id).join();

test('sorting: text, option order, dates; empty values last', () => {
  assert.equal(ids(applySorts(rows, schema, view({ sorts: [{ prop: 'title', dir: 'asc' }] }))), '2,1,3');
  assert.equal(ids(applySorts(rows, schema, view({ sorts: [{ prop: 's', dir: 'desc' }] }))), '1,2,3');
  assert.equal(ids(applySorts(rows, schema, view({ sorts: [{ prop: 'd', dir: 'asc' }] }))), '2,1,3');
});

test('filters by type', () => {
  const f = (filters, extra) => ids(applyFilters(rows, schema, view({ filters, ...extra })));
  assert.equal(f([{ prop: 's', op: 'is', value: 'a' }]), '2');
  assert.equal(f([{ prop: 'd', op: 'is', value: '2026-10-02' }]), '2', 'date ranges include inner days');
  assert.equal(f([{ prop: 'd', op: 'after', value: '2026-10-03' }]), '1');
  assert.equal(f([{ prop: 'n', op: 'gt', value: '5' }]), '2');
  assert.equal(f([{ prop: 't', op: 'contains', value: 'x' }]), '1');
  assert.equal(f([{ prop: 's', op: 'is_empty' }]), '3');
  assert.equal(f([{ prop: 'title', op: 'contains', value: 'AN' }]), '1', 'text match is case-insensitive');
  assert.equal(f([{ prop: 's', op: 'is', value: 'a' }, { prop: 'n', op: 'eq', value: '3' }], { filterMode: 'or' }), '1,2');
});

test('search query and implied defaults', () => {
  assert.equal(ids(visibleRows(rows, schema, view(), 'cher')), '3');
  assert.deepEqual(impliedDefaults(schema, view({ filters: [{ prop: 's', op: 'is', value: 'a' }] })), { s: 'a' });
  assert.deepEqual(impliedDefaults(schema, view({ filterMode: 'or', filters: [{ prop: 's', op: 'is', value: 'a' }] })), {});
});

test('date arithmetic crosses month boundaries', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('property type conversion keeps what it can', () => {
  const sel = { type: 'select', options: [{ id: 'a', name: 'Alpha' }] };
  assert.equal(convertValue('a', sel, 'text'), 'Alpha');
  const next = { type: 'select', options: [{ id: 'z', name: 'alpha' }] };
  assert.equal(convertValue('Alpha', { type: 'text' }, 'select', next), 'z');
  assert.equal(convertValue('12.5 kg', { type: 'text' }, 'number'), 12.5);
  assert.equal(convertValue('x', { type: 'text' }, 'checkbox'), true);
});
