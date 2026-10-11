import { memo, useRef, useState } from 'react';
import Editable from './Editable.jsx';
import CodeBlock from './CodeBlock.jsx';
import TableBlock from './TableBlock.jsx';
import { ImageBlock, BookmarkBlock, EmbedBlock } from './MediaBlocks.jsx';
import { TocBlock, PageLinkBlock, DatabaseBlock } from './LinkBlocks.jsx';
import { useEditor, useUi } from './EditorContext.js';
import Icon from '../Icon.jsx';
import Popover from '../Popover.jsx';
import EmojiPicker from '../EmojiPicker.jsx';

const BULLETS = ['•', '◦', '▪'];
const alpha = (n) => { let s = ''; let x = n; while (x > 0) { x -= 1; s = String.fromCharCode(97 + (x % 26)) + s; x = Math.floor(x / 26); } return s; };
const roman = (n) => {
  const map = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = ''; let x = n;
  for (const [v, s] of map) while (x >= v) { out += s; x -= v; }
  return out;
};
const numberLabel = (n, depth) => [String(n), alpha(n), roman(n)][depth % 3];

const PLACEHOLDERS = {
  paragraph: "Type '/' for commands",
  heading_1: 'Heading 1',
  heading_2: 'Heading 2',
  heading_3: 'Heading 3',
  bulleted_list: 'List',
  numbered_list: 'List',
  to_do: 'To-do',
  toggle: 'Toggle',
  quote: 'Empty quote',
  callout: 'Type something…',
};

/** Renders siblings, numbering consecutive numbered-list items. */
export function BlockList({ blocks, depth = 0 }) {
  let n = 0;
  return blocks.map((b) => {
    n = b.type === 'numbered_list' ? n + 1 : 0;
    return <Block key={b.id} block={b} depth={depth} number={n} />;
  });
}

const Block = memo(function Block({ block, depth, number }) {
  const ed = useEditor();
  const ui = useUi();
  const rowRef = useRef(null);
  const bodyRef = useRef(null);
  const [emoji, setEmoji] = useState(null);
  const { readOnly } = ui;
  const selected = ui.selected.has(block.id);
  const drop = ui.drop?.id === block.id ? ui.drop.pos : null;
  const { type } = block;
  const isOnlyEmptyPage = ui.onlyBlockId === block.id;
  const ph = isOnlyEmptyPage && type === 'paragraph' ? "Type '/' for commands, or just start writing…" : PLACEHOLDERS[type];

  const text = (extraClass = '') => <Editable id={block.id} html={block.html} placeholder={ph} className={`${extraClass}${isOnlyEmptyPage ? ' show-ph' : ''}`} />;

  let content;
  switch (type) {
    case 'heading_1': case 'heading_2': case 'heading_3':
      content = text(`h${type.slice(-1)}`); break;
    case 'bulleted_list':
      content = <div className="li"><span className="marker bullet" aria-hidden="true">{BULLETS[depth % 3]}</span>{text()}</div>; break;
    case 'numbered_list':
      content = <div className="li"><span className="marker num" aria-hidden="true">{numberLabel(number, depth)}.</span>{text()}</div>; break;
    case 'to_do':
      content = (
        <div className={`li todo${block.checked ? ' checked' : ''}`}>
          <button
            type="button"
            role="checkbox"
            aria-checked={!!block.checked}
            aria-label="Toggle to-do"
            className={`checkbox${block.checked ? ' on' : ''}`}
            disabled={readOnly}
            onClick={() => ed.update(block.id, { checked: !block.checked })}
          >
            {block.checked && <Icon name="check" size={12} />}
          </button>
          {text()}
        </div>
      ); break;
    case 'toggle':
      content = (
        <div className="li toggle">
          <button
            type="button"
            className={`toggle-arrow${block.open ? ' open' : ''}`}
            aria-expanded={!!block.open}
            aria-label={block.open ? 'Collapse' : 'Expand'}
            onClick={() => ed.update(block.id, { open: !block.open })}
          >
            <Icon name="chevronRight" size={14} />
          </button>
          {text()}
        </div>
      ); break;
    case 'quote':
      content = <div className="quote">{text()}</div>; break;
    case 'callout':
      content = (
        <div className={`callout${block.color ? ` color-${block.color}` : ''}`}>
          <button type="button" className="callout-icon" disabled={readOnly} onClick={(e) => setEmoji(e.currentTarget)} aria-label="Change icon">{block.icon || '💡'}</button>
          {text()}
          {emoji && (
            <Popover anchor={emoji} onClose={() => setEmoji(null)} width={320}>
              <EmojiPicker showRemove={false} onPick={(e) => ed.update(block.id, { icon: e })} onClose={() => setEmoji(null)} />
            </Popover>
          )}
        </div>
      ); break;
    case 'divider':
      content = <hr className="divider" />; break;
    case 'code': content = <CodeBlock block={block} />; break;
    case 'image': content = <ImageBlock block={block} />; break;
    case 'bookmark': content = <BookmarkBlock block={block} />; break;
    case 'embed': content = <EmbedBlock block={block} />; break;
    case 'table': content = <TableBlock block={block} />; break;
    case 'table_of_contents': content = <TocBlock block={block} />; break;
    case 'child_page': case 'link_to_page': content = <PageLinkBlock block={block} />; break;
    case 'child_database': content = <DatabaseBlock block={block} />; break;
    case 'column_list':
      return (
        <div className={`block block-column_list${selected ? ' selected' : ''}`} data-block-id={block.id}>
          <div className="columns">
            {block.children.map((col) => (
              <div className="column" key={col.id} data-block-id={col.id} style={{ flex: col.width ? `${col.width} 1 0` : '1 1 0' }}>
                <BlockList blocks={col.children} depth={depth} />
              </div>
            ))}
          </div>
        </div>
      );
    default:
      content = text();
  }

  const showChildren = block.children?.length > 0 && !(type === 'toggle' && !block.open);
  const colorClass = block.color ? ` color-${block.color}` : '';

  return (
    <div
      className={`block block-${type}${selected ? ' selected' : ''}${drop ? ` drop-${drop}` : ''}`}
      data-block-id={block.id}
      id={`b-${block.id}`}
    >
      <div
        className="block-row"
        ref={rowRef}
        onDragOver={(e) => ed.dragOver(e, block.id, bodyRef.current)}
        onDrop={(e) => ed.drop(e, block.id)}
        onMouseDown={(e) => ed.onRowMouseDown(e, block.id)}
      >
        {!readOnly && (
          <div className="block-gutter" contentEditable={false}>
            <button type="button" className="gutter-btn" title="Click to add a block below" aria-label="Add block below" onClick={() => ed.addBelow(block.id)}>
              <Icon name="plus" size={14} />
            </button>
            <button
              type="button"
              className="gutter-btn grip"
              title="Drag to move · click for options"
              aria-label="Block options"
              draggable
              onDragStart={(e) => ed.dragStart(e, block.id, rowRef.current)}
              onDragEnd={ed.dragEnd}
              onClick={(e) => ed.openBlockMenu(block.id, e.currentTarget)}
            >
              <Icon name="grip" size={14} />
            </button>
          </div>
        )}
        <div className={`block-body${type === 'callout' ? '' : colorClass}`} ref={bodyRef}>{content}</div>
      </div>
      {type === 'toggle' && block.open && !block.children?.length && !readOnly && (
        <button type="button" className="toggle-empty" onClick={() => ed.addChild(block.id)}>Empty toggle. Click to add a block inside.</button>
      )}
      {showChildren && (
        <div className="block-children">
          <BlockList blocks={block.children} depth={depth + 1} />
        </div>
      )}
    </div>
  );
});

export default Block;
