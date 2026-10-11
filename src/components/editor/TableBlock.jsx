import { memo, useLayoutEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '../../lib/sanitize.js';
import { currentRange } from './caret.js';
import { useEditor, useUi } from './EditorContext.js';
import Icon from '../Icon.jsx';
import Popover, { MenuItem } from '../Popover.jsx';

const Cell = memo(function Cell({ html, header, readOnly, onChange, onKey, cellRef }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current.innerHTML !== html) ref.current.innerHTML = html;
  }, [html]);
  return (
    <div
      ref={(el) => { ref.current = el; cellRef(el); }}
      className={`cell-edit${header ? ' header' : ''}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onInput={(e) => onChange(e.currentTarget.innerHTML.replace(/^<br>$/, ''))}
      onKeyDown={onKey}
      onPaste={(e) => {
        e.preventDefault();
        const t = e.clipboardData.getData('text/html');
        const txt = e.clipboardData.getData('text/plain');
        document.execCommand('insertHTML', false, t ? sanitizeHtml(t) : sanitizeHtml(txt.replace(/\n/g, '<br>')));
      }}
    />
  );
});

export default function TableBlock({ block }) {
  const ed = useEditor();
  const { readOnly } = useUi();
  const rows = block.rows?.length ? block.rows : [['']];
  const cols = rows[0].length;
  const cellEls = useRef({});
  const [menu, setMenu] = useState(null); // { anchor, kind: 'row'|'col', index }

  const commit = (nextRows, extra = {}, typing = false) => ed.update(block.id, { rows: nextRows, ...extra }, { typing });
  const setCell = (r, c, v) => commit(rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)), {}, true);
  const focusCell = (r, c, atEnd = true) => {
    const el = cellEls.current[`${r}:${c}`];
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(!atEnd);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  const addRow = (at = rows.length) => {
    const next = [...rows];
    next.splice(at, 0, Array(cols).fill(''));
    commit(next);
    setTimeout(() => focusCell(at, 0), 0);
  };
  const addCol = (at = cols) => commit(rows.map((r) => { const n = [...r]; n.splice(at, 0, ''); return n; }));
  const delRow = (at) => rows.length > 1 && commit(rows.filter((_, i) => i !== at));
  const delCol = (at) => cols > 1 && commit(rows.map((r) => r.filter((_, i) => i !== at)));

  const onKey = (e, r, c) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Tab') {
      e.preventDefault();
      const next = e.shiftKey ? (c > 0 ? [r, c - 1] : r > 0 ? [r - 1, cols - 1] : null) : (c < cols - 1 ? [r, c + 1] : r < rows.length - 1 ? [r + 1, 0] : 'new');
      if (next === 'new') addRow(); else if (next) focusCell(...next);
    } else if (e.key === 'Enter' && !e.shiftKey && !mod) {
      e.preventDefault();
      if (r < rows.length - 1) focusCell(r + 1, c); else addRow();
    } else if (e.key === 'Escape') {
      ed.selectBlock(block.id);
    } else if (e.key === 'ArrowUp' && r > 0 && currentRange(e.currentTarget)?.collapsed) {
      const top = e.currentTarget.getBoundingClientRect().top;
      const caret = window.getSelection().getRangeAt(0).getClientRects()[0];
      if (!caret || caret.top - top < 12) { e.preventDefault(); focusCell(r - 1, c); }
    } else if (e.key === 'ArrowDown' && r < rows.length - 1 && currentRange(e.currentTarget)?.collapsed) {
      const bottom = e.currentTarget.getBoundingClientRect().bottom;
      const caret = window.getSelection().getRangeAt(0).getClientRects()[0];
      if (!caret || bottom - caret.bottom < 12) { e.preventDefault(); focusCell(r + 1, c, false); }
    } else if (mod && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      ed.onKeyDown(e, block.id, null);
    }
  };

  return (
    <div className="table-block">
      <div className="table-scroll">
        <table>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className={block.header && r === 0 ? 'th' : ''}>
                    <Cell
                      html={cell}
                      header={block.header && r === 0}
                      readOnly={readOnly}
                      onChange={(v) => setCell(r, c, v)}
                      onKey={(e) => onKey(e, r, c)}
                      cellRef={(el) => { cellEls.current[`${r}:${c}`] = el; }}
                    />
                    {!readOnly && r === 0 && (
                      <button className="col-handle" title="Column options" onClick={(e) => setMenu({ anchor: e.currentTarget, kind: 'col', index: c })}><Icon name="dots" size={12} /></button>
                    )}
                    {!readOnly && c === 0 && (
                      <button className="row-handle" title="Row options" onClick={(e) => setMenu({ anchor: e.currentTarget, kind: 'row', index: r })}><Icon name="dots" size={12} /></button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && <button className="table-add-col" title="Add column" onClick={() => addCol()}><Icon name="plus" size={12} /></button>}
      </div>
      {!readOnly && <button className="table-add-row" onClick={() => addRow()}><Icon name="plus" size={12} /> New row</button>}
      {menu && (
        <Popover anchor={menu.anchor} onClose={() => setMenu(null)} width={200}>
          {menu.kind === 'row' ? (
            <>
              <MenuItem onClick={() => { addRow(menu.index); setMenu(null); }}>Insert above</MenuItem>
              <MenuItem onClick={() => { addRow(menu.index + 1); setMenu(null); }}>Insert below</MenuItem>
              {menu.index === 0 && (
                <MenuItem onClick={() => { ed.update(block.id, { header: !block.header }); setMenu(null); }}>{block.header ? 'Turn off header row' : 'Use as header row'}</MenuItem>
              )}
              <MenuItem danger disabled={rows.length < 2} onClick={() => { delRow(menu.index); setMenu(null); }}>Delete row</MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={() => { addCol(menu.index); setMenu(null); }}>Insert left</MenuItem>
              <MenuItem onClick={() => { addCol(menu.index + 1); setMenu(null); }}>Insert right</MenuItem>
              <MenuItem danger disabled={cols < 2} onClick={() => { delCol(menu.index); setMenu(null); }}>Delete column</MenuItem>
            </>
          )}
        </Popover>
      )}
    </div>
  );
}
