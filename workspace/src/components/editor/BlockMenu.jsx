import { useState } from 'react';
import { COLORS, COLOR_LABEL } from '../../lib/constants.js';
import { TURN_INTO_TYPES, TEXT_TYPES } from '../../lib/blocks.js';
import Popover, { MenuItem } from '../Popover.jsx';
import Icon from '../Icon.jsx';

const LABELS = {
  paragraph: 'Text', heading_1: 'Heading 1', heading_2: 'Heading 2', heading_3: 'Heading 3',
  bulleted_list: 'Bulleted list', numbered_list: 'Numbered list', to_do: 'To-do list', toggle: 'Toggle list',
  quote: 'Quote', callout: 'Callout', code: 'Code',
};

export default function BlockMenu({ block, anchor, onClose, onTurnInto, onColor, onDuplicate, onDelete, onCopyMarkdown, onCopyLink }) {
  const [panel, setPanel] = useState(null);
  const isText = TEXT_TYPES.has(block.type);
  const colorable = isText || block.type === 'toc' || block.type === 'table_of_contents';

  return (
    <Popover anchor={anchor} onClose={onClose} width={panel ? 240 : 230} maxHeight={460} className="block-menu">
      {panel === null && (
        <>
          <div className="menu-group">{LABELS[block.type] || block.type.replace(/_/g, ' ')}</div>
          {isText && (
            <MenuItem icon={<Icon name="type" />} right={<Icon name="chevronRight" size={12} />} onClick={() => setPanel('turn')}>Turn into</MenuItem>
          )}
          {colorable && (
            <MenuItem icon={<span className="menu-color">A</span>} right={<Icon name="chevronRight" size={12} />} onClick={() => setPanel('color')}>Color</MenuItem>
          )}
          <MenuItem icon={<Icon name="duplicate" />} hint="Ctrl+D" onClick={() => { onDuplicate(); onClose(); }}>Duplicate</MenuItem>
          <MenuItem icon={<Icon name="copy" />} onClick={() => { onCopyMarkdown(); onClose(); }}>Copy as Markdown</MenuItem>
          <MenuItem icon={<Icon name="link" />} onClick={() => { onCopyLink(); onClose(); }}>Copy link to block</MenuItem>
          <div className="menu-sep" />
          <MenuItem icon={<Icon name="trash" />} danger hint="Del" onClick={() => { onDelete(); onClose(); }}>Delete</MenuItem>
        </>
      )}
      {panel === 'turn' && (
        <>
          <button className="menu-back" onClick={() => setPanel(null)}><Icon name="chevronLeft" size={12} /> Turn into</button>
          {TURN_INTO_TYPES.map((t) => (
            <MenuItem key={t} active={t === block.type} onClick={() => { onTurnInto(t); onClose(); }} right={t === block.type ? <Icon name="check" size={13} /> : null}>
              {LABELS[t]}
            </MenuItem>
          ))}
        </>
      )}
      {panel === 'color' && (
        <>
          <button className="menu-back" onClick={() => setPanel(null)}><Icon name="chevronLeft" size={12} /> Color</button>
          <div className="menu-group">Text</div>
          {['default', ...COLORS].map((c) => (
            <MenuItem key={c} icon={<span className={`color-chip color-${c}`}>A</span>} onClick={() => { onColor(c === 'default' ? null : c); onClose(); }}>
              {c === 'default' ? 'Default' : COLOR_LABEL(c)}
            </MenuItem>
          ))}
          <div className="menu-group">Background</div>
          {COLORS.map((c) => (
            <MenuItem key={c} icon={<span className={`color-chip color-${c}_bg`}>A</span>} onClick={() => { onColor(`${c}_bg`); onClose(); }}>
              {COLOR_LABEL(c)} background
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}
