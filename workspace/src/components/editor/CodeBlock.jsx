import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CODE_LANGUAGES } from '../../lib/constants.js';
import { escapeHtml, unescapeHtml } from '../../lib/sanitize.js';
import { highlight } from './highlight.js';
import { useEditor, useUi } from './EditorContext.js';
import Icon from '../Icon.jsx';

/** Code is edited in a <textarea> layered over a highlighted <pre>, which keeps it plain-text safe. */
export default function CodeBlock({ block }) {
  const ed = useEditor();
  const { readOnly } = useUi();
  const taRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const text = unescapeHtml(block.html);

  useLayoutEffect(() => {
    ed.registerEl(block.id, taRef.current);
    const el = taRef.current;
    return () => ed.registerEl(block.id, null, el);
  }, [block.id, ed]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const onKeyDown = (e) => {
    const ta = e.currentTarget;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      ed.setHtml(block.id, escapeHtml(ta.value));
      return;
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const start = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      if (ta.value.slice(start, start + 2) === '  ') {
        ta.setRangeText('', start, start + 2, 'preserve');
        ed.setHtml(block.id, escapeHtml(ta.value));
      }
      return;
    }
    if (e.key === 'Escape') { ed.selectBlock(block.id); return; }
    if (mod && ['z', 'y', 'd'].includes(e.key.toLowerCase())) { ed.onKeyDown(e, block.id, ta); return; }
    const collapsed = ta.selectionStart === ta.selectionEnd;
    if (e.key === 'Backspace' && collapsed && ta.selectionStart === 0 && ta.value === '') {
      e.preventDefault();
      ed.convert(block.id, 'paragraph');
    } else if (e.key === 'ArrowUp' && collapsed && !ta.value.slice(0, ta.selectionStart).includes('\n')) {
      e.preventDefault();
      ed.moveFocus(block.id, 'up');
    } else if (e.key === 'ArrowDown' && collapsed && !ta.value.slice(ta.selectionStart).includes('\n')) {
      e.preventDefault();
      ed.moveFocus(block.id, 'down');
    } else if (e.key === 'Enter' && mod) {
      e.preventDefault();
      ed.addAfter(block.id);
    }
  };

  return (
    <div className="code-block">
      <div className="code-head">
        <select
          value={block.lang || 'plain text'}
          disabled={readOnly}
          onChange={(e) => ed.update(block.id, { lang: e.target.value })}
          aria-label="Language"
        >
          {CODE_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="code-wrap">
        <pre className="code-hl" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `${highlight(text, block.lang)}\n` }} />
        <textarea
          ref={taRef}
          className="code-input"
          value={text}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Code"
          data-editable={block.id}
          placeholder=""
          onChange={(e) => ed.setHtml(block.id, escapeHtml(e.target.value))}
          onKeyDown={onKeyDown}
          onFocus={() => ed.onFocusBlock(block.id)}
          onPaste={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
