import { memo, useLayoutEffect, useRef } from 'react';
import { useEditor, useUi } from './EditorContext.js';
import { stripZw } from './caret.js';

/**
 * Uncontrolled rich-text surface. The DOM is the source of truth while typing; React only
 * writes innerHTML when the incoming `html` differs from what is already there
 * (undo, merges, programmatic edits), so the caret never jumps.
 */
const Editable = memo(function Editable({ id, html, placeholder, className = '', tag: Tag = 'div' }) {
  const ed = useEditor();
  const { readOnly } = useUi();
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    // Zero-width spaces are editing scaffolding (see inline markdown); they never count as a change.
    if (stripZw(el.innerHTML) !== html) el.innerHTML = html;
  }, [html]);

  useLayoutEffect(() => {
    const el = ref.current;
    ed.registerEl(id, el);
    return () => ed.registerEl(id, null, el);
  }, [id, ed]);

  return (
    <Tag
      ref={ref}
      className={`editable ${className}`}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder || 'Text'}
      data-placeholder={placeholder}
      data-editable={id}
      onInput={(e) => ed.onInput(e, id, ref.current)}
      onKeyDown={(e) => ed.onKeyDown(e, id, ref.current)}
      onPaste={(e) => ed.onPaste(e, id, ref.current)}
      onFocus={() => ed.onFocusBlock(id)}
      onClick={(e) => ed.onTextClick(e)}
    />
  );
});

export default Editable;
