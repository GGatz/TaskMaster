import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PageIcon from '../PageIcon.jsx';

export const SLASH_COMMANDS = [
  { id: 'paragraph', title: 'Text', desc: 'Just start writing with plain text.', glyph: 'Aa', group: 'Basic blocks', keys: 'paragraph plain text' },
  { id: 'heading_1', title: 'Heading 1', desc: 'Big section heading.', glyph: 'H1', group: 'Basic blocks', keys: 'h1 title large' },
  { id: 'heading_2', title: 'Heading 2', desc: 'Medium section heading.', glyph: 'H2', group: 'Basic blocks', keys: 'h2 subtitle' },
  { id: 'heading_3', title: 'Heading 3', desc: 'Small section heading.', glyph: 'H3', group: 'Basic blocks', keys: 'h3' },
  { id: 'bulleted_list', title: 'Bulleted list', desc: 'Create a simple bulleted list.', glyph: '•', group: 'Basic blocks', keys: 'bullet ul unordered' },
  { id: 'numbered_list', title: 'Numbered list', desc: 'Create a list with numbering.', glyph: '1.', group: 'Basic blocks', keys: 'number ol ordered' },
  { id: 'to_do', title: 'To-do list', desc: 'Track tasks with a to-do list.', glyph: '☑', group: 'Basic blocks', keys: 'todo to do to-do task checkbox check' },
  { id: 'toggle', title: 'Toggle list', desc: 'Toggles can hide and show content inside.', glyph: '▸', group: 'Basic blocks', keys: 'toggle collapse fold' },
  { id: 'quote', title: 'Quote', desc: 'Capture a quote.', glyph: '❝', group: 'Basic blocks', keys: 'quote blockquote cite' },
  { id: 'callout', title: 'Callout', desc: 'Make writing stand out.', glyph: '💡', group: 'Basic blocks', keys: 'callout note info highlight' },
  { id: 'divider', title: 'Divider', desc: 'Visually divide blocks.', glyph: '—', group: 'Basic blocks', keys: 'divider hr line separator rule' },
  { id: 'code', title: 'Code', desc: 'Capture a code snippet.', glyph: '</>', group: 'Basic blocks', keys: 'code snippet pre' },
  { id: 'table', title: 'Table', desc: 'Add a simple table.', glyph: '▦', group: 'Basic blocks', keys: 'table grid simple' },
  { id: 'page', title: 'Page', desc: 'Embed a sub-page inside this page.', glyph: '📄', group: 'Pages', keys: 'page subpage new' },
  { id: 'link_to_page', title: 'Link to page', desc: 'Link to an existing page.', glyph: '↗', group: 'Pages', keys: 'link page existing' },
  { id: 'db_page', title: 'Database (full page)', desc: 'Create a database on its own page.', glyph: '🗄', group: 'Databases', keys: 'database full page new' },
  { id: 'db_table', title: 'Table view', desc: 'Add a database as a table.', glyph: '▤', group: 'Databases', keys: 'database table view inline spreadsheet' },
  { id: 'db_board', title: 'Board view', desc: 'Add a kanban board database.', glyph: '▥', group: 'Databases', keys: 'database board kanban view inline' },
  { id: 'db_list', title: 'List view', desc: 'Add a database as a list.', glyph: '☰', group: 'Databases', keys: 'database list view inline' },
  { id: 'db_gallery', title: 'Gallery view', desc: 'Add a database as a gallery.', glyph: '▦', group: 'Databases', keys: 'database gallery cards view inline' },
  { id: 'db_calendar', title: 'Calendar view', desc: 'Add a database as a calendar.', glyph: '📅', group: 'Databases', keys: 'database calendar view inline' },
  { id: 'image', title: 'Image', desc: 'Upload or embed with a link.', glyph: '🖼', group: 'Media', keys: 'image picture photo upload' },
  { id: 'bookmark', title: 'Web bookmark', desc: 'Save a link as a visual bookmark.', glyph: '🔖', group: 'Media', keys: 'bookmark link url web' },
  { id: 'embed', title: 'Embed', desc: 'Embed a video or any web page.', glyph: '▶', group: 'Media', keys: 'embed video youtube vimeo iframe' },
  { id: 'columns_2', title: '2 columns', desc: 'Create two side-by-side columns.', glyph: '◫', group: 'Layout', keys: 'columns two 2 layout' },
  { id: 'columns_3', title: '3 columns', desc: 'Create three side-by-side columns.', glyph: '▥', group: 'Layout', keys: 'columns three 3 layout' },
  { id: 'table_of_contents', title: 'Table of contents', desc: 'Show an outline of this page.', glyph: '≡', group: 'Layout', keys: 'toc contents outline' },
  { id: 'today', title: 'Today’s date', desc: 'Insert the current date as text.', glyph: '📆', group: 'Inline', keys: 'date today now' },
];

export function filterCommands(query) {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  const score = (c) => {
    const t = c.title.toLowerCase();
    if (t.startsWith(q)) return 0;
    if (t.includes(q)) return 1;
    if (c.keys.includes(q)) return 2;
    return 3;
  };
  return SLASH_COMMANDS.filter((c) => score(c) < 3).sort((a, b) => score(a) - score(b));
}

function useMenuPosition(rect) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  // Measured after every render on purpose; the functional setState bails out when nothing moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !rect) return;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    setPos((p) => (p.left === left && p.top === top ? p : { left, top }));
  });
  return [ref, pos];
}

export function SlashMenu({ items, index, rect, onPick, onHover }) {
  const [ref, pos] = useMenuPosition(rect);
  useLayoutEffect(() => {
    ref.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [index, ref]);
  let lastGroup = null;
  return createPortal(
    <div ref={ref} className="slash-menu popover" style={pos} onMouseDown={(e) => e.preventDefault()} role="listbox" aria-label="Insert block">
      {items.length === 0 && <div className="empty-note">No results</div>}
      {items.map((c, i) => {
        const header = c.group !== lastGroup ? <div key={`g-${c.group}`} className="menu-group">{c.group}</div> : null;
        lastGroup = c.group;
        return (
          <div key={c.id}>
            {header}
            <button
              type="button"
              role="option"
              aria-selected={i === index}
              className={`slash-item${i === index ? ' active' : ''}`}
              onMouseMove={() => onHover(i)}
              onClick={() => onPick(c)}
            >
              <span className="slash-glyph">{c.glyph}</span>
              <span className="slash-text"><span className="slash-title">{c.title}</span><span className="slash-desc">{c.desc}</span></span>
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

export function MentionMenu({ items, index, rect, onPick, onHover }) {
  const [ref, pos] = useMenuPosition(rect);
  return createPortal(
    <div ref={ref} className="slash-menu popover mention-menu" style={pos} onMouseDown={(e) => e.preventDefault()} role="listbox" aria-label="Mention a page">
      <div className="menu-group">Mention a page</div>
      {items.length === 0 && <div className="empty-note">No pages found</div>}
      {items.map((p, i) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={i === index}
          className={`slash-item${i === index ? ' active' : ''}`}
          onMouseMove={() => onHover(i)}
          onClick={() => onPick(p)}
        >
          <span className="slash-glyph"><PageIcon icon={p.icon} type={p.type} size={20} /></span>
          <span className="slash-text"><span className="slash-title">{p.title || 'Untitled'}</span></span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
