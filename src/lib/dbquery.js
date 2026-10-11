// Filtering, sorting and value helpers for database rows. Pure functions (no DOM).

const TEXTY = new Set(['title', 'text', 'url', 'email', 'phone']);
const DATEY = new Set(['date', 'created_time', 'last_edited_time']);

export const filterKind = (type) => {
  if (TEXTY.has(type)) return 'text';
  if (type === 'number') return 'number';
  if (type === 'select' || type === 'status') return 'select';
  if (type === 'multi_select') return 'multi_select';
  if (DATEY.has(type)) return 'date';
  if (type === 'checkbox') return 'checkbox';
  return 'text';
};

const EMPTY_OPS = [['is_empty', 'Is empty'], ['is_not_empty', 'Is not empty']];
export const OPS = {
  text: [['contains', 'Contains'], ['not_contains', 'Does not contain'], ['is', 'Is'], ['is_not', 'Is not'], ['starts_with', 'Starts with'], ['ends_with', 'Ends with'], ...EMPTY_OPS],
  number: [['eq', '='], ['neq', '≠'], ['gt', '>'], ['lt', '<'], ['gte', '≥'], ['lte', '≤'], ...EMPTY_OPS],
  select: [['is', 'Is'], ['is_not', 'Is not'], ...EMPTY_OPS],
  multi_select: [['contains', 'Contains'], ['not_contains', 'Does not contain'], ...EMPTY_OPS],
  date: [['is', 'Is'], ['before', 'Before'], ['after', 'After'], ['on_or_before', 'On or before'], ['on_or_after', 'On or after'], ...EMPTY_OPS],
  checkbox: [['is', 'Is']],
};
export const opsFor = (type) => OPS[filterKind(type)];
export const needsValue = (op) => op !== 'is_empty' && op !== 'is_not_empty';

export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoDate(new Date());
export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
};
export const resolveDateToken = (v) => {
  if (v === 'today') return todayIso();
  if (v === 'tomorrow') return addDays(todayIso(), 1);
  if (v === 'yesterday') return addDays(todayIso(), -1);
  if (v === 'week_ago') return addDays(todayIso(), -7);
  if (v === 'week_ahead') return addDays(todayIso(), 7);
  return v || '';
};

/** Raw value of a property on a row. Dates normalise to {start,end}. */
export function getValue(row, prop) {
  switch (prop.type) {
    case 'title': return row.title || '';
    case 'created_time': return { start: isoDate(new Date(row.created_at)), end: null };
    case 'last_edited_time': return { start: isoDate(new Date(row.updated_at)), end: null };
    default: return row.props?.[prop.id];
  }
}

const norm = (s) => String(s ?? '').toLowerCase();
const isEmptyValue = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && !v.start);

export function matchFilter(row, prop, f) {
  if (!prop) return true;
  const v = getValue(row, prop);
  const kind = filterKind(prop.type);
  if (f.op === 'is_empty') return kind === 'checkbox' ? !v : isEmptyValue(v);
  if (f.op === 'is_not_empty') return kind === 'checkbox' ? !!v : !isEmptyValue(v);
  switch (kind) {
    case 'text': {
      const a = norm(v);
      const b = norm(f.value);
      if (f.op === 'contains') return a.includes(b);
      if (f.op === 'not_contains') return !a.includes(b);
      if (f.op === 'is') return a === b;
      if (f.op === 'is_not') return a !== b;
      if (f.op === 'starts_with') return a.startsWith(b);
      if (f.op === 'ends_with') return a.endsWith(b);
      return true;
    }
    case 'number': {
      if (f.value === '' || f.value == null) return true;
      const target = Number(f.value);
      if (v == null || v === '') return f.op === 'neq';
      const n = Number(v);
      return { eq: n === target, neq: n !== target, gt: n > target, lt: n < target, gte: n >= target, lte: n <= target }[f.op] ?? true;
    }
    case 'select':
      if (!f.value) return true;
      return f.op === 'is' ? v === f.value : v !== f.value;
    case 'multi_select': {
      if (!f.value) return true;
      const has = Array.isArray(v) && v.includes(f.value);
      return f.op === 'contains' ? has : !has;
    }
    case 'checkbox':
      return !!v === (f.value !== false && f.value !== 'false');
    case 'date': {
      const target = resolveDateToken(f.value);
      if (!target) return true;
      if (!v?.start) return false;
      const start = v.start;
      const end = v.end || v.start;
      switch (f.op) {
        case 'is': return start <= target && target <= end;
        case 'before': return start < target;
        case 'after': return end > target;
        case 'on_or_before': return start <= target;
        case 'on_or_after': return end >= target;
        default: return true;
      }
    }
    default: return true;
  }
}

export function applyFilters(rows, schema, view) {
  const active = (view.filters || []).filter((f) => schema.some((p) => p.id === f.prop));
  if (!active.length) return rows;
  const byId = new Map(schema.map((p) => [p.id, p]));
  const test = (row) => (view.filterMode === 'or'
    ? active.some((f) => matchFilter(row, byId.get(f.prop), f))
    : active.every((f) => matchFilter(row, byId.get(f.prop), f)));
  return rows.filter(test);
}

export function matchesQuery(row, schema, q) {
  const term = norm(q).trim();
  if (!term) return true;
  if (norm(row.title).includes(term)) return true;
  return schema.some((p) => {
    const v = row.props?.[p.id];
    if (v == null) return false;
    if (p.type === 'select' || p.type === 'status') return norm(p.options?.find((o) => o.id === v)?.name).includes(term);
    if (p.type === 'multi_select') return (v || []).some((id) => norm(p.options?.find((o) => o.id === id)?.name).includes(term));
    if (['text', 'url', 'email', 'phone', 'number'].includes(p.type)) return norm(v).includes(term);
    return false;
  });
}

function sortKey(row, prop) {
  const v = getValue(row, prop);
  switch (prop.type) {
    case 'number': return v == null || v === '' ? null : Number(v);
    case 'select': case 'status': {
      const i = (prop.options || []).findIndex((o) => o.id === v);
      return i < 0 ? null : i;
    }
    case 'multi_select': {
      const idx = (v || []).map((id) => (prop.options || []).findIndex((o) => o.id === id)).filter((i) => i >= 0);
      return idx.length ? Math.min(...idx) : null;
    }
    case 'date': case 'created_time': case 'last_edited_time': return v?.start || null;
    case 'checkbox': return v ? 1 : 0;
    default: return v ? norm(v) : null;
  }
}

export function applySorts(rows, schema, view) {
  const sorts = (view.sorts || []).filter((s) => schema.some((p) => p.id === s.prop));
  if (!sorts.length) return rows;
  const byId = new Map(schema.map((p) => [p.id, p]));
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const prop = byId.get(s.prop);
      const ka = sortKey(a, prop);
      const kb = sortKey(b, prop);
      if (ka === kb) continue;
      if (ka == null) return 1; // empty values always last
      if (kb == null) return -1;
      const cmp = typeof ka === 'string' ? ka.localeCompare(kb, undefined, { numeric: true }) : ka - kb;
      if (cmp) return s.dir === 'desc' ? -cmp : cmp;
    }
    return a.position - b.position;
  });
}

export function visibleRows(rows, schema, view, query = '') {
  return applySorts(applyFilters(rows.filter((r) => matchesQuery(r, schema, query)), schema, view), schema, view);
}

/** Does this filter set pin the property to a single value? Used to pre-fill new rows. */
export function impliedDefaults(schema, view) {
  const out = {};
  if (view.filterMode === 'or') return out;
  for (const f of view.filters || []) {
    const p = schema.find((x) => x.id === f.prop);
    if (!p || p.id === 'title') continue;
    if ((p.type === 'select' || p.type === 'status') && f.op === 'is' && f.value) out[p.id] = f.value;
    if (p.type === 'checkbox' && f.op === 'is') out[p.id] = f.value !== false && f.value !== 'false';
    if (p.type === 'multi_select' && f.op === 'contains' && f.value) out[p.id] = [f.value];
  }
  return out;
}

/** Convert a stored value when a property changes type (best effort, lossy where needed). */
export function convertValue(value, from, to, newProp) {
  if (value == null) return null;
  const textual = ['text', 'url', 'email', 'phone'];
  const label = () => {
    if (from.type === 'select' || from.type === 'status') return from.options?.find((o) => o.id === value)?.name || '';
    if (from.type === 'multi_select') return (value || []).map((id) => from.options?.find((o) => o.id === id)?.name).filter(Boolean).join(', ');
    if (from.type === 'date') return value?.start ? (value.end ? `${value.start} → ${value.end}` : value.start) : '';
    if (from.type === 'checkbox') return value ? 'Yes' : 'No';
    return String(value ?? '');
  };
  if (textual.includes(to)) return label();
  if (to === 'number') {
    const n = parseFloat(String(textual.includes(from.type) || from.type === 'number' ? value : label()).replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  if (to === 'checkbox') return !!value;
  if (to === 'select' || to === 'status' || to === 'multi_select') {
    const names = from.type === 'multi_select' || from.type === 'select' || from.type === 'status'
      ? (Array.isArray(value) ? value : [value]).map((id) => from.options?.find((o) => o.id === id)?.name).filter(Boolean)
      : textual.includes(from.type) && value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : [];
    const ids = names.map((n) => newProp.options.find((o) => o.name.toLowerCase() === n.toLowerCase())?.id).filter(Boolean);
    if (to === 'multi_select') return ids;
    return ids[0] ?? null;
  }
  return null;
}
