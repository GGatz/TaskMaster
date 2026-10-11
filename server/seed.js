import { randomUUID } from 'node:crypto';
import { createPage } from './pages.js';

const uid = () => randomUUID().slice(0, 12);
const b = (type, html = '', extra = {}) => ({ id: uid(), type, html, children: [], ...extra });
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** First-run content: a tour page plus a sample Tasks database with a board view. */
export function seed() {
  const statusOpts = [
    { id: 'st1', name: 'Not started', color: 'gray', group: 'todo' },
    { id: 'st2', name: 'In progress', color: 'blue', group: 'in_progress' },
    { id: 'st3', name: 'Done', color: 'green', group: 'complete' },
  ];
  const prioOpts = [
    { id: 'pr1', name: 'High', color: 'red' },
    { id: 'pr2', name: 'Medium', color: 'yellow' },
    { id: 'pr3', name: 'Low', color: 'green' },
  ];
  const schema = [
    { id: 'title', name: 'Task', type: 'title' },
    { id: 'status', name: 'Status', type: 'status', options: statusOpts },
    { id: 'priority', name: 'Priority', type: 'select', options: prioOpts },
    { id: 'due', name: 'Due', type: 'date' },
    { id: 'tags', name: 'Tags', type: 'multi_select', options: [
      { id: 'tg1', name: 'Work', color: 'purple' },
      { id: 'tg2', name: 'Home', color: 'orange' },
      { id: 'tg3', name: 'Learning', color: 'pink' },
    ] },
    { id: 'done', name: 'Done?', type: 'checkbox' },
  ];
  const view = (name, type, extra = {}) => ({
    id: uid(), name, type, filters: [], filterMode: 'and', sorts: [], groupBy: null, hidden: [], widths: {}, dateBy: null, ...extra,
  });

  const homeId = randomUUID();

  const tasks = createPage({
    parent_id: homeId,
    type: 'database',
    inline: true,
    title: 'Tasks',
    icon: '✅',
    schema,
    views: [
      view('Board', 'board', { groupBy: 'status', hidden: ['done'] }),
      view('All tasks', 'table', { sorts: [{ id: uid(), prop: 'due', dir: 'asc' }] }),
      view('Calendar', 'calendar', { dateBy: 'due' }),
      view('List', 'list'),
      view('Gallery', 'gallery'),
    ],
  });

  const rows = [
    ['Plan the week', 'st3', 'pr2', -2, ['tg1'], true],
    ['Write the project proposal', 'st2', 'pr1', 1, ['tg1'], false],
    ['Book dentist appointment', 'st1', 'pr3', 4, ['tg2'], false],
    ['Read a chapter of a book', 'st1', 'pr3', 2, ['tg3'], false],
    ['Review pull requests', 'st2', 'pr2', 0, ['tg1'], false],
    ['Fix the leaking tap', 'st1', 'pr2', 6, ['tg2'], false],
    ['Learn a new keyboard shortcut', 'st3', 'pr3', -1, ['tg3'], true],
  ];
  rows.forEach(([title, status, prio, due, tags, done], i) => {
    createPage({
      parent_id: tasks.id,
      title,
      position: i + 1,
      props: { status, priority: prio, due: { start: day(due), end: null }, tags, done },
    });
  });

  const intro = [
    b('callout', 'Welcome to <strong>TaskMaster</strong> — a Notion-style workspace that runs on your own machine. Everything you see here is editable.', { icon: '💡', color: 'yellow_bg' }),
    b('heading_1', 'The basics'),
    b('paragraph', 'Click anywhere in a page and just start typing. Press <code>/</code> on an empty line to open the block menu.'),
    b('to_do', 'Type <code>/</code> and pick a block type', { checked: false }),
    b('to_do', 'Select text to see the formatting toolbar (or use <code>Ctrl/⌘ + B</code>, <code>I</code>, <code>U</code>, <code>E</code>, <code>K</code>)', { checked: false }),
    b('to_do', 'Drag a block by its ⋮⋮ handle to reorder it', { checked: false }),
    b('to_do', 'Press <code>Tab</code> / <code>Shift + Tab</code> to nest and un-nest blocks', { checked: true }),
    b('heading_2', 'Markdown shortcuts'),
    b('bulleted_list', '<code>#</code>, <code>##</code>, <code>###</code> + space → headings'),
    b('bulleted_list', '<code>-</code> or <code>*</code> + space → bulleted list; <code>1.</code> + space → numbered list'),
    b('bulleted_list', '<code>[]</code> + space → to-do; <code>&gt;</code> + space → toggle; <code>"</code> + space → quote'),
    b('bulleted_list', '<code>---</code> → divider; <code>```</code> → code block'),
    b('bulleted_list', 'Wrap text in <code>**bold**</code>, <code>*italic*</code>, <code>`code`</code> or <code>~strike~</code>'),
    b('toggle', 'Click the arrow to open this toggle', {
      open: false,
      children: [b('paragraph', 'Toggles can hold any blocks, including other toggles.')],
    }),
    b('quote', 'Simplicity is the ultimate sophistication.'),
    b('code', 'function greet(name) {\n  return `Hello, ${name}!`;\n}', { lang: 'javascript' }),
    b('heading_1', 'Databases'),
    b('paragraph', 'Every database is a collection of pages with properties. Switch between the Board, Table, Calendar, List and Gallery views below — all of them show the same data.'),
    b('child_database', '', { pageId: tasks.id }),
    b('paragraph', ''),
    b('heading_2', 'Tips'),
    b('numbered_list', 'Press <code>Ctrl/⌘ + K</code> to search every page.'),
    b('numbered_list', 'Press <code>Ctrl/⌘ + \\</code> to hide the sidebar.'),
    b('numbered_list', 'Type <code>@</code> to mention another page.'),
    b('numbered_list', 'Press <code>Esc</code> in a block to select it, then <code>Delete</code>, <code>Ctrl/⌘ + D</code> or <code>Shift + ↑/↓</code>.'),
  ];
  // The tour page is created last because it embeds the Tasks database by id.
  return createPage({
    id: homeId,
    title: 'Getting Started',
    icon: '👋',
    cover: 'gradient:sunrise',
    position: 1,
    blocks: intro,
  });
}
