// Inline formatting on the current selection (always within a single contentEditable block).

import { COLORS } from '../../lib/constants.js';

export function activeEditable() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const node = sel.anchorNode && (sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode);
  const el = node?.closest?.('[contenteditable="true"][data-editable]');
  if (!el) return null;
  const end = sel.focusNode && (sel.focusNode.nodeType === Node.TEXT_NODE ? sel.focusNode.parentElement : sel.focusNode);
  return end?.closest?.('[contenteditable="true"][data-editable]') === el ? el : null;
}

const notify = (el) => el?.dispatchEvent(new Event('input', { bubbles: true }));

export function exec(cmd) {
  const el = activeEditable();
  document.execCommand(cmd, false, null);
  // execCommand fires its own input event in Chromium/Firefox; this keeps Safari in sync too.
  notify(el);
}

const ancestor = (node, selector, root) => {
  let n = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (n && n !== root) {
    if (n.matches?.(selector)) return n;
    n = n.parentElement;
  }
  return null;
};

export function formatState() {
  const el = activeEditable();
  const sel = window.getSelection();
  if (!el || !sel.rangeCount) return {};
  const anchor = sel.anchorNode;
  return {
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    strike: document.queryCommandState('strikeThrough'),
    code: !!ancestor(anchor, 'code', el),
    link: !!ancestor(anchor, 'a[href]', el),
  };
}

function replaceSelection(el, transform) {
  const sel = window.getSelection();
  const range = sel.getRangeAt(0);
  const frag = range.extractContents();
  const out = transform(frag);
  range.insertNode(out);
  const nr = document.createRange();
  nr.selectNodeContents(out);
  sel.removeAllRanges();
  sel.addRange(nr);
  notify(el);
}

const unwrapAll = (frag, selector) => {
  frag.querySelectorAll(selector).forEach((n) => n.replaceWith(...n.childNodes));
  return frag;
};

export function toggleCode() {
  const el = activeEditable();
  if (!el) return;
  const sel = window.getSelection();
  const existing = ancestor(sel.anchorNode, 'code', el);
  if (existing) {
    const kids = [...existing.childNodes];
    existing.replaceWith(...kids);
    const range = document.createRange();
    range.setStartBefore(kids[0]);
    range.setEndAfter(kids[kids.length - 1]);
    sel.removeAllRanges();
    sel.addRange(range);
    notify(el);
    return;
  }
  if (sel.isCollapsed) return;
  replaceSelection(el, (frag) => {
    const code = document.createElement('code');
    code.appendChild(unwrapAll(frag, 'code'));
    return code;
  });
}

/** kind: 'tc' (text colour) | 'bg' (highlight). color: one of COLORS or 'default'. */
export function applyColor(kind, color) {
  const el = activeEditable();
  if (!el || window.getSelection().isCollapsed) return;
  replaceSelection(el, (frag) => {
    unwrapAll(frag, `span[class^="${kind}-"]`);
    const span = document.createElement('span');
    if (color !== 'default' && COLORS.includes(color)) span.className = `${kind}-${color}`;
    span.appendChild(frag);
    return span;
  });
}
export function setLink(url) {
  const el = activeEditable();
  if (!el) return;
  if (!url) {
    document.execCommand('unlink');
  } else {
    // Only web, mail and phone links are kept as written; anything else (javascript:, data:, …) is treated as a host name.
    const safe = /^(https?:|mailto:|tel:)/i.test(url) || url.startsWith('/') || url.startsWith('#');
    const href = safe ? url : `https://${url.replace(/^[a-z][a-z0-9+.-]*:\/*/i, '')}`;
    document.execCommand('createLink', false, href);
    el.querySelectorAll('a[href]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  }
  notify(el);
}

export function currentLink() {
  const el = activeEditable();
  const sel = window.getSelection();
  if (!el || !sel.rangeCount) return '';
  return ancestor(sel.anchorNode, 'a[href]', el)?.getAttribute('href') || '';
}
