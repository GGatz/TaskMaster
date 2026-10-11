import { uid } from './blocks.js';

export const VIEW_TYPES = [
  { type: 'table', label: 'Table', icon: 'table' },
  { type: 'board', label: 'Board', icon: 'board' },
  { type: 'list', label: 'List', icon: 'list' },
  { type: 'gallery', label: 'Gallery', icon: 'gallery' },
  { type: 'calendar', label: 'Calendar', icon: 'calendar' },
];

export const PROPERTY_TYPES = [
  { type: 'text', label: 'Text', glyph: 'Aa' },
  { type: 'number', label: 'Number', glyph: '#' },
  { type: 'select', label: 'Select', glyph: '◉' },
  { type: 'multi_select', label: 'Multi-select', glyph: '☰' },
  { type: 'status', label: 'Status', glyph: '◔' },
  { type: 'date', label: 'Date', glyph: '📅' },
  { type: 'checkbox', label: 'Checkbox', glyph: '☑' },
  { type: 'url', label: 'URL', glyph: '🔗' },
  { type: 'email', label: 'Email', glyph: '@' },
  { type: 'phone', label: 'Phone', glyph: '☎' },
  { type: 'created_time', label: 'Created time', glyph: '🕑' },
  { type: 'last_edited_time', label: 'Last edited time', glyph: '🕑' },
];
export const propTypeInfo = (t) => (t === 'title' ? { type: 'title', label: 'Title', glyph: 'Aa' } : PROPERTY_TYPES.find((p) => p.type === t) || PROPERTY_TYPES[0]);

export const statusOptions = () => [
  { id: uid(), name: 'Not started', color: 'gray', group: 'todo' },
  { id: uid(), name: 'In progress', color: 'blue', group: 'in_progress' },
  { id: uid(), name: 'Done', color: 'green', group: 'complete' },
];

export function newView(type, name, extra = {}) {
  return {
    id: uid(),
    name: name || VIEW_TYPES.find((v) => v.type === type)?.label || 'View',
    type,
    filters: [],
    filterMode: 'and',
    sorts: [],
    groupBy: null,
    hidden: [],
    widths: {},
    dateBy: null,
    ...extra,
  };
}

/** Schema + first view for a freshly created database. */
export function newDatabaseSetup(viewType = 'table') {
  const schema = [{ id: 'title', name: 'Name', type: 'title' }];
  const extra = {};
  if (viewType === 'board') {
    schema.push({ id: 'status', name: 'Status', type: 'status', options: statusOptions() });
    extra.groupBy = 'status';
  } else if (viewType === 'calendar') {
    schema.push({ id: 'date', name: 'Date', type: 'date' });
    extra.dateBy = 'date';
  } else {
    schema.push({ id: 'tags', name: 'Tags', type: 'multi_select', options: [] });
  }
  return { schema, views: [newView(viewType, undefined, extra)] };
}

export const emptyValue = (type) => {
  switch (type) {
    case 'checkbox': return false;
    case 'multi_select': return [];
    case 'number': case 'date': case 'select': case 'status': return null;
    default: return '';
  }
};
