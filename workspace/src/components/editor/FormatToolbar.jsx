import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { COLORS, COLOR_LABEL } from '../../lib/constants.js';
import { activeEditable, applyColor, currentLink, exec, formatState, setLink, toggleCode } from './format.js';
import Icon from '../Icon.jsx';

/** Floating toolbar shown over a non-empty text selection inside one block. */
export default function FormatToolbar({ suppressed, linkRequest }) {
  const [state, setState] = useState(null); // { rect, fmt }
  const [mode, setMode] = useState(null); // null | 'link' | 'color'
  const [url, setUrl] = useState('');
  const barRef = useRef(null);
  const savedRange = useRef(null);
  const modeRef = useRef(null);
  modeRef.current = mode;

  useEffect(() => {
    const update = () => {
      if (modeRef.current === 'link') return; // keep the bar steady while typing a URL
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !activeEditable()) {
        if (!barRef.current?.contains(document.activeElement)) { setState(null); setMode(null); }
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      setState({ rect, fmt: formatState() });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  const openLink = () => {
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
    setUrl(currentLink());
    setMode('link');
  };

  useEffect(() => { if (linkRequest) openLink(); }, [linkRequest]);

  if (!state || suppressed) return null;

  const restore = () => {
    const sel = window.getSelection();
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };
  const run = (fn) => (e) => { e.preventDefault(); fn(); setState((s) => s && { ...s, fmt: formatState() }); };

  const rect = state.rect;
  const style = {
    left: Math.max(8, Math.min(window.innerWidth - 8, rect.left + rect.width / 2)),
    top: Math.max(8, rect.top - 8),
  };

  return createPortal(
    <div ref={barRef} className="format-toolbar" style={style} onMouseDown={(e) => { if (mode !== 'link') e.preventDefault(); }} role="toolbar" aria-label="Text formatting">
      {mode === 'link' ? (
        <form
          className="link-form"
          onSubmit={(e) => { e.preventDefault(); restore(); setLink(url.trim()); setMode(null); }}
        >
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link…" aria-label="Link URL" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); restore(); setMode(null); } }} />
          <button type="submit" className="btn-small">Apply</button>
          {currentLink() && <button type="button" className="btn-small" onClick={() => { restore(); setLink(''); setMode(null); }}>Remove</button>}
        </form>
      ) : mode === 'color' ? (
        <div className="color-panel">
          <div className="color-title">Text color</div>
          <div className="color-row">
            {['default', ...COLORS].map((c) => (
              <button key={c} title={COLOR_LABEL(c)} className={`swatch tc-${c}`} onMouseDown={run(() => applyColor('tc', c))}>A</button>
            ))}
          </div>
          <div className="color-title">Highlight</div>
          <div className="color-row">
            {['default', ...COLORS].map((c) => (
              <button key={c} title={COLOR_LABEL(c)} className={`swatch bgsw bg-${c}`} onMouseDown={run(() => applyColor('bg', c))}>A</button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <button type="button" className={state.fmt.bold ? 'on' : ''} title="Bold (Ctrl/⌘ B)" onMouseDown={run(() => exec('bold'))}><b>B</b></button>
          <button type="button" className={state.fmt.italic ? 'on' : ''} title="Italic (Ctrl/⌘ I)" onMouseDown={run(() => exec('italic'))}><i>I</i></button>
          <button type="button" className={state.fmt.underline ? 'on' : ''} title="Underline (Ctrl/⌘ U)" onMouseDown={run(() => exec('underline'))}><u>U</u></button>
          <button type="button" className={state.fmt.strike ? 'on' : ''} title="Strikethrough (Ctrl/⌘ Shift S)" onMouseDown={run(() => exec('strikeThrough'))}><s>S</s></button>
          <button type="button" className={state.fmt.code ? 'on' : ''} title="Code (Ctrl/⌘ E)" onMouseDown={run(toggleCode)}>{'</>'}</button>
          <span className="tb-sep" />
          <button type="button" className={state.fmt.link ? 'on' : ''} title="Link (Ctrl/⌘ K)" onMouseDown={(e) => { e.preventDefault(); openLink(); }}><Icon name="link" size={14} /></button>
          <button type="button" title="Color" onMouseDown={(e) => { e.preventDefault(); setMode('color'); }}><span className="tb-color">A</span></button>
        </>
      )}
    </div>,
    document.body,
  );
}
