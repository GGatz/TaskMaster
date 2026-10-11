// Selection / caret utilities for contentEditable blocks.

export const ZWSP = '\u200b';
export const stripZw = (s) => s.replace(/\u200b/g, '');
export const normalizeHtml = (html) => {
  const h = stripZw(html);
  return h === '<br>' || h === '' ? '' : h;
};

/** Serialise a cloned fragment, dropping the empty inline wrappers cloneContents() leaves behind. */
export function serialize(fragment) {
  const d = document.createElement('div');
  d.appendChild(fragment);
  const all = [...d.querySelectorAll('*')].reverse();
  for (const el of all) {
    if (el.tagName !== 'BR' && !el.textContent && !el.querySelector('br, img')) el.remove();
  }
  return normalizeHtml(d.innerHTML.replace(/(<br>)+$/, ''));
}

/** Remove zero-width spaces that are no longer the only content of their text node. */
export function cleanZeroWidth(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const dirty = [];
  let n;
  while ((n = walker.nextNode())) if (n.data.length > 1 && n.data.includes(ZWSP)) dirty.push(n);
  for (const node of dirty) {
    for (let i = node.data.length - 1; i >= 0; i--) if (node.data[i] === ZWSP) node.deleteData(i, 1);
  }
}

export function currentRange(within) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (within && !within.contains(r.commonAncestorContainer)) return null;
  return r;
}

/** Split an element's content at the caret (deleting any selected text in between). */
export function splitAtCaret(el) {
  const r = currentRange(el);
  if (!r) return { before: serialize(rangeOf(el, 'all').cloneContents()), after: '' };
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const post = document.createRange();
  post.selectNodeContents(el);
  post.setStart(r.endContainer, r.endOffset);
  return { before: serialize(pre.cloneContents()), after: serialize(post.cloneContents()) };
}

function rangeOf(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r;
}

export function textBeforeCaret(el) {
  const r = currentRange(el);
  if (!r) return '';
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString();
}

export function isCaretAtStart(el) {
  const r = currentRange(el);
  return !!r && r.collapsed && textBeforeCaret(el) === '' && !hasAtomBefore(el, r);
}

export function isCaretAtEnd(el) {
  const r = currentRange(el);
  if (!r || !r.collapsed) return false;
  const post = document.createRange();
  post.selectNodeContents(el);
  post.setStart(r.endContainer, r.endOffset);
  return post.toString() === '';
}

// Mentions are contenteditable=false atoms with text; they count as text already.
function hasAtomBefore() { return false; }

export function caretOffset(el) {
  const r = currentRange(el);
  if (!r) return 0;
  return textBeforeCaret(el).length;
}

/** Place the caret at 'start' | 'end' | a character offset. */
export function setCaret(el, where = 'end') {
  if (!el) return;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const n = where === 'start' ? 0 : where === 'end' ? el.value.length : where;
    el.focus({ preventScroll: false });
    el.setSelectionRange(n, n);
    return;
  }
  el.focus({ preventScroll: false });
  const sel = window.getSelection();
  const range = document.createRange();
  if (where === 'start') {
    range.selectNodeContents(el);
    range.collapse(true);
  } else if (where === 'end') {
    range.selectNodeContents(el);
    range.collapse(false);
  } else {
    let remaining = where;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    let placed = false;
    while ((node = walker.nextNode())) {
      if (remaining <= node.data.length) {
        range.setStart(node, remaining);
        range.collapse(true);
        placed = true;
        break;
      }
      remaining -= node.data.length;
    }
    if (!placed) {
      range.selectNodeContents(el);
      range.collapse(false);
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Caret rect, with a fallback for collapsed ranges in empty lines (which report a zero rect). */
export function caretRect(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return el.getBoundingClientRect();
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getClientRects()[0];
  if (rect && rect.height > 0) return rect;
  const marker = document.createElement('span');
  marker.textContent = ZWSP;
  const saved = sel.getRangeAt(0).cloneRange();
  range.insertNode(marker);
  const r = marker.getBoundingClientRect();
  marker.remove();
  sel.removeAllRanges();
  sel.addRange(saved);
  return r.height > 0 ? r : el.getBoundingClientRect();
}

function lineHeightOf(el) {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  return Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.5;
}

export function isOnFirstLine(el) {
  if (!el.textContent) return true;
  const rect = caretRect(el);
  return rect.top - el.getBoundingClientRect().top < lineHeightOf(el) * 0.9;
}

export function isOnLastLine(el) {
  if (!el.textContent) return true;
  const rect = caretRect(el);
  return el.getBoundingClientRect().bottom - rect.bottom < lineHeightOf(el) * 0.9;
}

/** Put the caret in `el` as close as possible to the horizontal position x on its first/last line. */
export function placeCaretAtX(el, x, where) {
  if (el.tagName === 'TEXTAREA') {
    setCaret(el, where === 'first' ? 'start' : 'end');
    return;
  }
  el.focus();
  const rect = el.getBoundingClientRect();
  const lh = lineHeightOf(el);
  const y = where === 'first' ? rect.top + lh / 2 : rect.bottom - lh / 2;
  let range = null;
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) {
      range = document.createRange();
      range.setStart(p.offsetNode, p.offset);
    }
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  }
  if (range && el.contains(range.startContainer)) {
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    setCaret(el, where === 'first' ? 'start' : 'end');
  }
}

/** Remove n characters immediately before the caret (text nodes only). */
export function deleteCharsBeforeCaret(el, n) {
  const r = currentRange(el);
  if (!r || !r.collapsed) return;
  let node = r.startContainer;
  let offset = r.startOffset;
  let remaining = n;
  if (node.nodeType !== Node.TEXT_NODE) {
    // Caret between elements: step into the previous text node.
    const prev = node.childNodes[offset - 1];
    if (!prev) return;
    const walker = document.createTreeWalker(prev, NodeFilter.SHOW_TEXT);
    let last = null;
    while (walker.nextNode()) last = walker.currentNode;
    if (!last) return;
    node = last;
    offset = last.data.length;
  }
  while (remaining > 0 && node) {
    const take = Math.min(remaining, offset);
    node.deleteData(offset - take, take);
    remaining -= take;
    offset -= take;
    if (remaining > 0) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      walker.currentNode = node;
      node = walker.previousNode();
      offset = node ? node.data.length : 0;
    }
  }
  if (node) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/** Find the closest ancestor (inclusive) of node matching selector, stopping at root. */
export function closestWithin(node, selector, root) {
  let n = node && node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (n && n !== root) {
    if (n.matches?.(selector)) return n;
    n = n.parentNode;
  }
  return null;
}

/** Is the entire content of el selected? */
export function isAllSelected(el) {
  const r = currentRange(el);
  if (!r) return false;
  if (r.collapsed) return !el.textContent;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  const post = document.createRange();
  post.selectNodeContents(el);
  post.setStart(r.endContainer, r.endOffset);
  return pre.toString() === '' && post.toString() === '';
}

/** Number of characters the caret can traverse in an HTML string (matches setCaret offsets). */
export function textLength(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent.length;
}
