import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  CONTINUES_ON_ENTER, RICH_TEXT_TYPES, TEXT_TYPES,
  cloneWithNewIds, convertBlock, findBlock, focusOrder, headings, indentBlock, insertAfter, insertChild,
  isEmptyHtml, locate, moveBlock, newBlock, outdentBlock, ownedPageIds, removeBlock, replaceBlock, selectableOrder,
  updateBlock, walk,
} from '../../lib/blocks.js';
import { api } from '../../lib/api.js';
import { newDatabaseSetup } from '../../lib/dbdefaults.js';
import { blocksToMarkdown, looksLikeMarkdown, markdownToBlocks } from '../../lib/markdown.js';
import { pageUrl } from '../../lib/router.js';
import { sanitizeHtml, escapeHtml } from '../../lib/sanitize.js';
import { useWorkspace } from '../../lib/store.jsx';
import { SearchModal } from '../Modals.jsx';
import { BlockList } from './Block.jsx';
import BlockMenu from './BlockMenu.jsx';
import FormatToolbar from './FormatToolbar.jsx';
import { MentionMenu, SlashMenu, filterCommands } from './SlashMenu.jsx';
import { EditorCtx, UiCtx } from './EditorContext.js';
import {
  ZWSP, caretOffset, caretRect, cleanZeroWidth, deleteCharsBeforeCaret, isAllSelected, isCaretAtEnd, isCaretAtStart, isOnFirstLine,
  isOnLastLine, normalizeHtml, placeCaretAtX, setCaret, splitAtCaret, textBeforeCaret, textLength,
} from './caret.js';
import { exec, toggleCode } from './format.js';

const MAX_HISTORY = 200;
const BLOCKS_MIME = 'application/x-taskmaster-blocks';
const DELETE_ON_BACKSPACE = new Set(['divider', 'image', 'bookmark', 'embed', 'table_of_contents', 'link_to_page']);

/** Sanitize rich text coming from storage once, on mount. */
function prepare(blocks) {
  const fix = (list) => list.map((b) => {
    const out = { ...b, children: b.children ? fix(b.children) : [] };
    if (RICH_TEXT_TYPES.has(b.type)) out.html = sanitizeHtml(b.html || '');
    if (b.type === 'table') out.rows = (b.rows || [['']]).map((r) => r.map((c) => sanitizeHtml(c || '')));
    return out;
  });
  const fixed = fix(Array.isArray(blocks) ? blocks : []);
  return fixed.length ? fixed : [newBlock('paragraph')];
}

const lastVisible = (b) => {
  let cur = b;
  while (cur.children?.length && cur.type !== 'column_list' && !(cur.type === 'toggle' && !cur.open)) cur = cur.children[cur.children.length - 1];
  return cur;
};

const Editor = forwardRef(function Editor({ pageId, initialBlocks, onChange, readOnly = false, onExitTop }, ref) {
  const ws = useWorkspace();
  const wsRef = useRef(ws);
  wsRef.current = ws;

  const [, force] = useReducer((n) => n + 1, 0);
  const blocksRef = useRef(null);
  if (blocksRef.current === null) blocksRef.current = prepare(initialBlocks);
  const hist = useRef({ past: [], future: [], key: null, at: 0 });
  const els = useRef(new Map());
  const focusReq = useRef(null);
  const lastFocused = useRef(null);
  const rootRef = useRef(null);
  const dragId = useRef(null);

  const [selected, setSelectedState] = useState(() => new Set());
  const selectedRef = useRef(selected);
  const setSelected = (s) => { selectedRef.current = s; setSelectedState(s); };
  const [drop, setDrop] = useState(null);
  const dropRef = useRef(null);
  const [slash, setSlashState] = useState(null);
  const slashRef = useRef(null);
  const [mention, setMentionState] = useState(null);
  const mentionRef = useRef(null);
  const [blockMenu, setBlockMenu] = useState(null);
  const [picker, setPicker] = useState(null);
  const [linkRequest, setLinkRequest] = useState(0);

  const setSlash = (v) => { slashRef.current = v; setSlashState(v); };
  const setMention = (v) => { mentionRef.current = v; setMentionState(v); };

  const impl = useRef({});

  /* ------------------------------------------------------------------ state */

  const syncOwnedPages = (prev, next) => {
    const before = ownedPageIds(prev);
    const after = ownedPageIds(next);
    const refresh = () => wsRef.current.refresh();
    // Removing the block trashes the page it owns; undoing (or pasting) it brings the page back.
    for (const id of before) if (!after.has(id)) api.trashPage(id).then(refresh, () => {});
    for (const id of after) if (!before.has(id)) api.restorePage(id).then((p) => p.restored && refresh(), () => {});
  };

  const commit = (next, opts = {}) => {
    const prev = blocksRef.current;
    if (next === prev) return;
    const h = hist.current;
    const t = Date.now();
    if (opts.typing) {
      const key = typeof opts.typing === 'string' ? opts.typing : 'typing';
      if (h.key !== key || t - h.at > 1000) h.past.push(prev);
      h.key = key;
      h.at = t;
    } else {
      h.past.push(prev);
      h.key = null;
    }
    if (h.past.length > MAX_HISTORY) h.past.shift();
    h.future = [];
    blocksRef.current = next;
    if (opts.focus) focusReq.current = opts.focus;
    if (!opts.typing) syncOwnedPages(prev, next);
    onChange?.(next);
    force();
  };

  const restore = (tree) => {
    const prev = blocksRef.current;
    blocksRef.current = tree.length ? tree : [newBlock('paragraph')];
    syncOwnedPages(prev, blocksRef.current);
    const id = lastFocused.current;
    if (id && findBlock(blocksRef.current, id)) focusReq.current = { id, pos: 'end' };
    onChange?.(blocksRef.current);
    force();
  };

  const undo = () => {
    const h = hist.current;
    if (!h.past.length) return;
    h.future.push(blocksRef.current);
    h.key = null;
    restore(h.past.pop());
  };
  const redo = () => {
    const h = hist.current;
    if (!h.future.length) return;
    h.past.push(blocksRef.current);
    h.key = null;
    restore(h.future.pop());
  };

  useLayoutEffect(() => {
    const req = focusReq.current;
    if (!req) return;
    if (req.cellOf) {
      // Tables are not text blocks: focus their first cell once rendered.
      const cell = rootRef.current?.querySelector(`[data-block-id="${req.cellOf}"] .cell-edit`);
      if (cell) {
        focusReq.current = null;
        setCaret(cell, 'start');
      }
      return;
    }
    const el = els.current.get(req.id);
    if (el) {
      focusReq.current = null;
      setCaret(el, req.pos ?? 'end');
      el.scrollIntoView?.({ block: 'nearest' });
    }
  });

  const tree = () => blocksRef.current;

  /* --------------------------------------------------------------- helpers */

  const focusBlock = (id, pos = 'end') => {
    const el = els.current.get(id);
    if (el) setCaret(el, pos); else { focusReq.current = { id, pos }; force(); }
  };

  const moveFocus = (id, dir, x) => {
    const order = focusOrder(tree());
    const i = order.findIndex((b) => b.id === id);
    const target = order[i + (dir === 'up' ? -1 : 1)];
    if (!target) {
      if (dir === 'up') onExitTop?.();
      return;
    }
    const el = els.current.get(target.id);
    if (!el) return;
    if (x == null) setCaret(el, dir === 'up' ? 'end' : 'start');
    else placeCaretAtX(el, x, dir === 'up' ? 'last' : 'first');
  };

  const removeIds = (ids) => {
    let t = tree();
    const order = focusOrder(t);
    const firstIdx = Math.min(...ids.map((id) => order.findIndex((b) => b.id === id)).filter((i) => i >= 0), Infinity);
    for (const id of ids) t = removeBlock(t, id).tree;
    if (!t.length) t = [newBlock('paragraph')];
    const remaining = focusOrder(t);
    const neighbour = remaining.find((b) => !ids.includes(b.id) && order.findIndex((o) => o.id === b.id) >= firstIdx)
      || [...remaining].reverse().find((b) => order.findIndex((o) => o.id === b.id) < firstIdx);
    commit(t, { focus: neighbour ? { id: neighbour.id, pos: 'start' } : null });
    setSelected(new Set());
  };

  const duplicate = (id) => {
    const block = findBlock(tree(), id);
    if (!block) return;
    const copy = cloneWithNewIds(block);
    // Duplicating a sub-page link would alias the page; keep it simple and copy the block only.
    commit(insertAfter(tree(), id, copy), { focus: TEXT_TYPES.has(copy.type) ? { id: copy.id, pos: 'end' } : null });
  };

  const insertBlocksAfter = (id, blocks, { replaceIfEmpty = true } = {}) => {
    const cur = findBlock(tree(), id);
    const fresh = blocks.map(cloneWithNewIds);
    const last = lastVisible(fresh[fresh.length - 1]);
    const focus = TEXT_TYPES.has(last.type) ? { id: last.id, pos: 'end' } : null;
    if (replaceIfEmpty && cur && TEXT_TYPES.has(cur.type) && isEmptyHtml(cur.html) && !cur.children?.length) {
      commit(replaceBlock(tree(), id, fresh), { focus });
    } else {
      commit(insertAfter(tree(), id, fresh), { focus });
    }
  };

  const uploadAndInsert = async (files, afterId) => {
    const images = [...files].filter((f) => /^image\/(png|jpe?g|gif|webp|avif)$/.test(f.type));
    if (!images.length) return false;
    let anchor = afterId || lastVisible(tree()[tree().length - 1]).id;
    for (const file of images) {
      try {
        const url = await api.upload(file);
        const block = newBlock('image', { url });
        const cur = findBlock(tree(), anchor);
        if (cur && TEXT_TYPES.has(cur.type) && isEmptyHtml(cur.html) && !cur.children?.length) commit(replaceBlock(tree(), anchor, block));
        else commit(insertAfter(tree(), anchor, block));
        anchor = block.id;
      } catch (e) {
        wsRef.current.showToast(`Upload failed: ${e.message}`);
      }
    }
    return true;
  };

  /* ---------------------------------------------------------------- typing */

  const setHtml = (id, html) => commit(updateBlock(tree(), id, { html }), { typing: id });

  const tryBlockShortcut = (id, el, block, inputData) => {
    if (block.type === 'code' || !RICH_TEXT_TYPES.has(block.type)) return false;
    const text = el.textContent.replace(/\u00a0/g, ' ');
    const hasMarkup = el.children.length > 0;
    if (hasMarkup) return false;
    const rules = [
      [/^#\s$/, 'heading_1'], [/^##\s$/, 'heading_2'], [/^###\s$/, 'heading_3'],
      [/^[-*+]\s$/, 'bulleted_list'], [/^\d+[.)]\s$/, 'numbered_list'],
      [/^\[\s?\]\s$/, 'to_do'], [/^>\s$/, 'toggle'], [/^["“”]\s$/, 'quote'],
    ];
    if (inputData === ' ' || inputData === '\u00a0') {
      if (block.type === 'numbered_list' && /^\d+[.)]\s$/.test(text)) return false;
      for (const [re, type] of rules) {
        if (re.test(text)) {
          if (type === block.type) return false;
          commit(updateBlock(tree(), id, (b) => ({ ...convertBlock(b, type), html: '' })), { focus: { id, pos: 'start' } });
          return true;
        }
      }
    }
    if (text === '---') {
      const t1 = updateBlock(tree(), id, { type: 'divider', html: '' });
      const nb = newBlock('paragraph');
      commit(insertAfter(t1, id, nb), { focus: { id: nb.id, pos: 'start' } });
      return true;
    }
    if (text === '```') {
      commit(updateBlock(tree(), id, (b) => ({ ...convertBlock(b, 'code'), html: '' })), { focus: { id, pos: 'start' } });
      return true;
    }
    return false;
  };

  /** `**bold**`, `*italic*`, `_italic_`, `` `code` `` and `~strike~` while typing. */
  const tryInlineMarkdown = (id, el) => {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !el.contains(node)) return false;
    if (node.parentElement.closest('code')) return false;
    const offset = sel.anchorOffset;
    const before = node.data.slice(0, offset);
    const patterns = [
      [/(^|[^*])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, 'strong'],
      [/(^|[^*])\*([^*\s](?:[^*]*[^*\s])?)\*$/, 'em'],
      [/(^|[^_\w])_([^_\s](?:[^_]*[^_\s])?)_$/, 'em'],
      [/(^|[^`])`([^`]+)`$/, 'code'],
      [/(^|[^~])~~?([^~\s](?:[^~]*[^~\s])?)~~?$/, 's'],
    ];
    for (const [re, tag] of patterns) {
      const m = before.match(re);
      if (!m) continue;
      const start = offset - (m[0].length - m[1].length);
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, offset);
      range.deleteContents();
      const wrapper = document.createElement(tag);
      wrapper.textContent = m[2];
      range.insertNode(wrapper);
      // A zero-width space after the element keeps the caret (and further typing) outside it.
      const after = document.createTextNode(ZWSP);
      wrapper.after(after);
      const r = document.createRange();
      r.setStart(after, 1);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      setHtml(id, normalizeHtml(el.innerHTML));
      return true;
    }
    return false;
  };

  const detectMenus = (id, el, e) => {
    const before = textBeforeCaret(el);
    const block = findBlock(tree(), id);
    if (!block || block.type === 'code') return;
    const sm = before.match(/(?:^|\s)\/([^/]{0,30})$/);
    // Queries may contain spaces ("/to do"), but a menu with no matches steps aside so ordinary text isn't hijacked.
    if (sm && !sm[1].startsWith(' ') && filterCommands(sm[1]).length === 0 && sm[1].length >= 3) {
      if (slashRef.current) setSlash(null);
    } else if (sm && !sm[1].startsWith(' ') && (slashRef.current || e?.data === '/')) {
      const rect = caretRect(el);
      const prev = slashRef.current;
      setSlash({ blockId: id, query: sm[1], rect: prev?.blockId === id ? prev.rect : rect, index: prev && prev.query === sm[1] ? prev.index : 0 });
      setMention(null);
      return;
    }
    if (slashRef.current) setSlash(null);
    const mm = before.match(/(?:^|\s)@([^\s@]{0,30})$/);
    if (mm && (mentionRef.current || e?.data === '@')) {
      const prev = mentionRef.current;
      setMention({ blockId: id, query: mm[1], rect: prev?.blockId === id ? prev.rect : caretRect(el), index: prev && prev.query === mm[1] ? prev.index : 0 });
      return;
    }
    if (mentionRef.current) setMention(null);
  };

  const onInput = (e, id, el) => {
    if (!el.textContent && !el.querySelector('img, a.mention') && el.innerHTML !== '') el.innerHTML = '';
    cleanZeroWidth(el);
    const html = normalizeHtml(el.innerHTML);
    setHtml(id, html);
    const native = e.nativeEvent;
    if (native.isComposing) return;
    const block = findBlock(tree(), id);
    if (!block) return;
    if (native.inputType === 'insertText' || native.inputType === 'insertCompositionText') {
      if (tryBlockShortcut(id, el, block, native.data)) { setSlash(null); return; }
      if (['*', '_', '`', '~'].includes(native.data) && tryInlineMarkdown(id, el)) return;
    }
    detectMenus(id, el, native);
  };

  /* ------------------------------------------------------- slash & mentions */

  const slashItems = slash ? filterCommands(slash.query) : [];
  const mentionItems = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return ws.pages.filter((p) => (p.title || 'Untitled').toLowerCase().includes(q) && p.id !== pageId).slice(0, 8);
  }, [mention, ws.pages, pageId]);

  const place = (blockId, htmlNow, newBlk, { focusNew = false, focusCell = false } = {}) => {
    const cur = findBlock(tree(), blockId);
    const empty = isEmptyHtml(htmlNow);
    let t = tree();
    if (cur && !empty) t = updateBlock(t, blockId, { html: htmlNow });
    t = empty ? replaceBlock(t, blockId, newBlk) : insertAfter(t, blockId, newBlk);
    const arr = [].concat(newBlk);
    const last = arr[arr.length - 1];
    // Keep a text block after the last block so the caret always has somewhere to go.
    const loc = locate(t, last.id);
    let focus = focusNew && TEXT_TYPES.has(arr[0].type) ? { id: arr[0].id, pos: 'start' } : null;
    if (loc && loc.index === loc.list.length - 1 && !TEXT_TYPES.has(last.type) && last.type !== 'column_list') {
      const tail = newBlock('paragraph');
      t = insertAfter(t, last.id, tail);
      focus = focus || { id: tail.id, pos: 'start' };
    }
    if (focusCell) focus = { cellOf: arr[0].id };
    commit(t, { focus });
    return focus;
  };

  const runCommand = async (cmdId, blockId, htmlNow) => {
    const block = findBlock(tree(), blockId);
    if (!block) return;
    const empty = isEmptyHtml(htmlNow);
    const textTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list', 'numbered_list', 'to_do', 'toggle', 'quote', 'callout', 'code'];
    if (textTypes.includes(cmdId)) {
      if (empty) {
        commit(updateBlock(tree(), blockId, (b) => ({ ...convertBlock({ ...b, html: '' }, cmdId) })), { focus: { id: blockId, pos: 'start' } });
      } else {
        const nb = newBlock(cmdId);
        commit(insertAfter(updateBlock(tree(), blockId, { html: htmlNow }), blockId, nb), { focus: { id: nb.id, pos: 'start' } });
      }
      return;
    }
    switch (cmdId) {
      case 'divider': place(blockId, htmlNow, newBlock('divider')); break;
      case 'table': {
        place(blockId, htmlNow, newBlock('table'), { focusCell: true });
        break;
      }
      case 'image': case 'bookmark': case 'embed': case 'table_of_contents':
        place(blockId, htmlNow, newBlock(cmdId)); break;
      case 'columns_2': case 'columns_3': {
        const cl = newBlock('column_list');
        if (cmdId === 'columns_3') cl.children.push(newBlock('column'));
        place(blockId, htmlNow, cl);
        focusReq.current = { id: cl.children[0].children[0].id, pos: 'start' };
        force();
        break;
      }
      case 'today': {
        const el = els.current.get(blockId);
        el?.focus();
        document.execCommand('insertText', false, new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
        break;
      }
      case 'page': {
        try {
          const page = await wsRef.current.createPage({ parent_id: pageId });
          place(blockId, htmlNow, newBlock('child_page', { pageId: page.id }));
          wsRef.current.go(page.id);
        } catch (err) { wsRef.current.showToast(err.message); }
        break;
      }
      case 'link_to_page':
        setPicker({ blockId, htmlNow });
        break;
      case 'db_page': {
        try {
          const page = await wsRef.current.createPage({ parent_id: pageId, type: 'database', title: '', ...newDatabaseSetup('table') });
          place(blockId, htmlNow, newBlock('child_page', { pageId: page.id }));
          wsRef.current.go(page.id);
        } catch (err) { wsRef.current.showToast(err.message); }
        break;
      }
      default:
        if (cmdId.startsWith('db_')) {
          const type = cmdId.slice(3);
          try {
            const setup = newDatabaseSetup(type);
            const page = await wsRef.current.createPage({ parent_id: pageId, type: 'database', inline: true, title: '', ...setup });
            place(blockId, htmlNow, newBlock('child_database', { pageId: page.id }));
          } catch (err) { wsRef.current.showToast(err.message); }
        }
    }
  };

  const pickSlash = (cmd) => {
    const s = slashRef.current;
    if (!s || !cmd) return;
    const el = els.current.get(s.blockId);
    if (el) {
      el.focus();
      deleteCharsBeforeCaret(el, s.query.length + 1);
    }
    const htmlNow = el ? normalizeHtml(el.innerHTML) : '';
    setSlash(null);
    runCommand(cmd.id, s.blockId, htmlNow);
  };

  const pickMention = (page) => {
    const m = mentionRef.current;
    if (!m || !page) return;
    const el = els.current.get(m.blockId);
    setMention(null);
    if (!el) return;
    el.focus();
    deleteCharsBeforeCaret(el, m.query.length + 1);
    const a = `<a class="mention" data-page="${page.id}" contenteditable="false">${page.icon ? `${escapeHtml(page.icon)} ` : ''}${escapeHtml(page.title || 'Untitled')}</a>&nbsp;`;
    document.execCommand('insertHTML', false, a);
  };

  const menuKey = (e) => {
    const s = slashRef.current;
    const m = mentionRef.current;
    const items = s ? filterCommands(s.query) : mentionItems;
    const state = s || m;
    if (!state) return false;
    const set = s ? setSlash : setMention;
    if (e.key === 'ArrowDown') { e.preventDefault(); set({ ...state, index: items.length ? (state.index + 1) % items.length : 0 }); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); set({ ...state, index: items.length ? (state.index - 1 + items.length) % items.length : 0 }); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (!items.length) { set(null); return true; }
      if (s) pickSlash(items[Math.min(state.index, items.length - 1)]); else pickMention(items[Math.min(state.index, items.length - 1)]);
      return true;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); set(null); return true; }
    return false;
  };

  /* ------------------------------------------------------------ structure ops */

  const handleEnter = (e, block, el) => {
    e.preventDefault();
    const id = block.id;
    const { before, after } = splitAtCaret(el);
    const empty = isEmptyHtml(before) && isEmptyHtml(after);
    const t = tree();
    if (empty && block.type !== 'paragraph') {
      const loc = locate(t, id);
      if (loc?.parent && loc.parent.type !== 'column' && CONTINUES_ON_ENTER.has(block.type)) {
        commit(outdentBlock(t, id), { focus: { id, pos: 'start' } });
      } else {
        commit(updateBlock(t, id, (b) => ({ ...convertBlock(b, 'paragraph'), html: '' })), { focus: { id, pos: 'start' } });
      }
      return;
    }
    const hasKids = block.children?.length > 0 && !(block.type === 'toggle' && !block.open);
    if ((block.type === 'toggle' && block.open) || (CONTINUES_ON_ENTER.has(block.type) && hasKids && isEmptyHtml(after))) {
      const nb = newBlock(block.type === 'toggle' ? 'paragraph' : block.type, { html: after });
      commit(insertChild(updateBlock(t, id, { html: before }), id, nb, 0), { focus: { id: nb.id, pos: 'start' } });
      return;
    }
    const type = CONTINUES_ON_ENTER.has(block.type) ? block.type : 'paragraph';
    const nb = newBlock(type, { html: after, ...(block.color && CONTINUES_ON_ENTER.has(block.type) ? { color: block.color } : {}) });
    commit(insertAfter(updateBlock(t, id, { html: before }), id, nb), { focus: { id: nb.id, pos: 'start' } });
  };

  const handleBackspaceStart = (e, block) => {
    e.preventDefault();
    const id = block.id;
    const t = tree();
    if (block.type !== 'paragraph') {
      commit(updateBlock(t, id, (b) => convertBlock(b, 'paragraph')), { focus: { id, pos: 'start' } });
      return;
    }
    const loc = locate(t, id);
    if (!loc) return;
    let target = null;
    let fromParent = false;
    if (loc.index > 0) target = lastVisible(loc.list[loc.index - 1]);
    else if (loc.parent && loc.parent.type !== 'column') { target = loc.parent; fromParent = true; }
    if (!target) return;

    if (RICH_TEXT_TYPES.has(target.type)) {
      const pos = textLength(target.html);
      let next = removeBlock(t, id).tree;
      next = updateBlock(next, target.id, (b) => ({
        html: b.html + block.html,
        children: fromParent ? [...block.children, ...b.children] : [...b.children, ...block.children],
      }));
      commit(next, { focus: { id: target.id, pos } });
    } else if (target.type === 'code') {
      if (isEmptyHtml(block.html)) commit(removeBlock(t, id).tree, { focus: { id: target.id, pos: 'end' } });
      else focusBlock(target.id, 'end');
    } else if (DELETE_ON_BACKSPACE.has(target.type)) {
      commit(removeBlock(t, target.id).tree, { focus: { id, pos: 'start' } });
    } else {
      const order = focusOrder(t);
      const prev = order[order.findIndex((b) => b.id === id) - 1];
      if (prev) focusBlock(prev.id, 'end');
    }
  };

  const handleDeleteEnd = (e, block) => {
    const t = tree();
    const order = selectableOrder(t);
    const next = order[order.findIndex((b) => b.id === block.id) + 1];
    if (!next || !RICH_TEXT_TYPES.has(next.type)) return;
    e.preventDefault();
    const pos = textLength(block.html);
    let nt = removeBlock(t, next.id).tree;
    nt = updateBlock(nt, block.id, (b) => ({ html: b.html + next.html, children: [...b.children, ...next.children] }));
    commit(nt, { focus: { id: block.id, pos } });
  };

  const moveUpDown = (id, dir) => {
    const t = tree();
    const loc = locate(t, id);
    if (!loc) return;
    const sibling = loc.list[loc.index + (dir === 'up' ? -1 : 1)];
    if (!sibling) return;
    const off = els.current.get(id) && TEXT_TYPES.has(loc.block.type) ? caretOffset(els.current.get(id)) : 'end';
    commit(moveBlock(t, id, sibling.id, dir === 'up' ? 'before' : 'after'), { focus: { id, pos: off } });
  };

  const selectAllBlocks = () => {
    setSelected(new Set(tree().map((b) => b.id)));
    document.activeElement?.blur?.();
    rootRef.current?.focus({ preventScroll: true });
  };

  const selectBlock = (id) => {
    setSelected(new Set([id]));
    setSlash(null);
    setMention(null);
    document.activeElement?.blur?.();
    rootRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (e, id, el) => {
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
    const block = findBlock(tree(), id);
    if (!block) return;
    if ((slashRef.current || mentionRef.current) && menuKey(e)) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key;

    if (mod) {
      const k = key.toLowerCase();
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 'd' && !e.shiftKey) { e.preventDefault(); duplicate(id); return; }
      if (key === 'Enter') {
        e.preventDefault();
        if (block.type === 'to_do') commit(updateBlock(tree(), id, { checked: !block.checked }), { focus: { id, pos: caretOffset(el) } });
        else if (block.type === 'toggle') commit(updateBlock(tree(), id, { open: !block.open }), { focus: { id, pos: caretOffset(el) } });
        return;
      }
      if ((key === 'ArrowUp' || key === 'ArrowDown') && e.shiftKey) { e.preventDefault(); moveUpDown(id, key === 'ArrowUp' ? 'up' : 'down'); return; }
      if (!el || el.tagName === 'TEXTAREA') return;
      if (k === 'b') { e.preventDefault(); exec('bold'); return; }
      if (k === 'i') { e.preventDefault(); exec('italic'); return; }
      if (k === 'u') { e.preventDefault(); exec('underline'); return; }
      if (k === 'e') { e.preventDefault(); toggleCode(); return; }
      if (k === 's' && e.shiftKey) { e.preventDefault(); exec('strikeThrough'); return; }
      if (k === 'k' && !window.getSelection().isCollapsed) { e.preventDefault(); setLinkRequest((n) => n + 1); return; }
      if (k === 'a') {
        if (isAllSelected(el)) { e.preventDefault(); selectAllBlocks(); }
        return;
      }
      return;
    }

    if (!el) return;
    const collapsed = window.getSelection().isCollapsed;

    switch (key) {
      case 'Escape': e.preventDefault(); selectBlock(id); return;
      case 'Enter':
        if (e.shiftKey) return; // soft line break handled natively
        handleEnter(e, block, el); return;
      case 'Backspace':
        if (collapsed && isCaretAtStart(el)) handleBackspaceStart(e, block);
        return;
      case 'Delete':
        if (collapsed && isCaretAtEnd(el)) handleDeleteEnd(e, block);
        return;
      case 'Tab': {
        e.preventDefault();
        const off = caretOffset(el);
        const next = e.shiftKey ? outdentBlock(tree(), id) : indentBlock(tree(), id);
        if (next !== tree()) commit(next, { focus: { id, pos: off } });
        return;
      }
      case 'ArrowUp':
        if (!e.shiftKey && collapsed && isOnFirstLine(el)) {
          e.preventDefault();
          moveFocus(id, 'up', caretRect(el).left);
        }
        return;
      case 'ArrowDown':
        if (!e.shiftKey && collapsed && isOnLastLine(el)) {
          e.preventDefault();
          moveFocus(id, 'down', caretRect(el).left);
        }
        return;
      case 'ArrowLeft':
        if (!e.shiftKey && collapsed && isCaretAtStart(el)) { e.preventDefault(); moveFocus(id, 'up'); }
        return;
      case 'ArrowRight':
        if (!e.shiftKey && collapsed && isCaretAtEnd(el)) { e.preventDefault(); moveFocus(id, 'down'); }
        return;
      default:
    }
  };

  /* ------------------------------------------------------------------ paste */

  const onPaste = (e, id, el) => {
    const dt = e.clipboardData;
    if (!dt) return;
    const block = findBlock(tree(), id);
    if (dt.files?.length && [...dt.files].some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      uploadAndInsert(dt.files, id);
      return;
    }
    const internal = dt.getData(BLOCKS_MIME);
    if (internal) {
      try {
        const blocks = JSON.parse(internal);
        e.preventDefault();
        insertBlocksAfter(id, blocks);
        return;
      } catch { /* fall through to text paste */ }
    }
    const text = dt.getData('text/plain');
    const html = dt.getData('text/html');
    const sel = window.getSelection();
    e.preventDefault();

    if (/^https?:\/\/\S+$/i.test(text.trim())) {
      if (!sel.isCollapsed) document.execCommand('createLink', false, text.trim());
      else document.execCommand('insertHTML', false, `<a href="${escapeHtml(text.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtml(text.trim())}</a>`);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const multiline = /\n/.test(text.trim());
    if (multiline || looksLikeMarkdown(text)) {
      let blocks = looksLikeMarkdown(text)
        ? markdownToBlocks(text)
        : text.split(/\r?\n/).filter((l) => l.trim()).map((l) => newBlock('paragraph', { html: escapeHtml(l.trim()) }));
      if (blocks.length) {
        // The first block merges into the current one when it is plain text and the caret is mid-line.
        if (blocks.length === 1 && blocks[0].type === 'paragraph') {
          document.execCommand('insertHTML', false, blocks[0].html);
          return;
        }
        const { before, after } = splitAtCaret(el);
        if (!isEmptyHtml(after) || (!isEmptyHtml(before) && block.type !== 'paragraph')) {
          const afterBlock = isEmptyHtml(after) ? [] : [newBlock(block.type === 'code' ? 'paragraph' : block.type === 'to_do' ? 'to_do' : 'paragraph', { html: after })];
          let t = updateBlock(tree(), id, { html: before });
          t = insertAfter(t, id, [...blocks.map(cloneWithNewIds), ...afterBlock]);
          commit(t);
          return;
        }
        if (!isEmptyHtml(before)) {
          // Append to the current block's text, then insert the rest after it.
          const first = blocks[0];
          if (first.type === 'paragraph') {
            document.execCommand('insertHTML', false, first.html);
            blocks = blocks.slice(1);
          }
          if (blocks.length) insertBlocksAfter(id, blocks, { replaceIfEmpty: false });
          return;
        }
        insertBlocksAfter(id, blocks);
        return;
      }
    }
    if (html && /<(b|strong|i|em|u|s|a|code|span|br)\b/i.test(html)) {
      document.execCommand('insertHTML', false, sanitizeHtml(html));
    } else {
      document.execCommand('insertText', false, text);
    }
  };

  /* ---------------------------------------------------------------- DnD */

  const dragStart = (e, id, rowEl) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ' ');
    try {
      const rect = rowEl.getBoundingClientRect();
      e.dataTransfer.setDragImage(rowEl, e.clientX - rect.left, e.clientY - rect.top);
    } catch { /* drag image unsupported */ }
    document.body.classList.add('dragging-block');
  };
  const setDropTarget = (v) => {
    const cur = dropRef.current;
    if ((cur?.id ?? null) === (v?.id ?? null) && (cur?.pos ?? null) === (v?.pos ?? null)) return;
    dropRef.current = v;
    setDrop(v);
  };
  const dragOver = (e, id, bodyEl) => {
    const dragged = dragId.current;
    if (!dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id === dragged || (findBlock(tree(), dragged) && locate([findBlock(tree(), dragged)], id))) { setDropTarget(null); return; }
    const row = e.currentTarget.getBoundingClientRect();
    const body = bodyEl.getBoundingClientRect();
    const edge = Math.min(48, body.width * 0.08);
    let pos;
    if (e.clientX < body.left + edge * 0.5 && e.clientX >= body.left) pos = 'left';
    else if (e.clientX > body.right - edge) pos = 'right';
    else pos = e.clientY < row.top + row.height / 2 ? 'before' : 'after';
    setDropTarget({ id, pos });
  };
  const dragEnd = () => {
    dragId.current = null;
    setDropTarget(null);
    document.body.classList.remove('dragging-block');
  };
  const dropOn = (e, id) => {
    const target = dropRef.current;
    const dragged = dragId.current;
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
      if (target && target.id === id) commit(moveBlock(tree(), dragged, id, target.pos), { focus: TEXT_TYPES.has(findBlock(tree(), dragged)?.type) ? { id: dragged, pos: 'end' } : null });
      dragEnd();
    } else if (e.dataTransfer?.files?.length) {
      e.preventDefault();
      e.stopPropagation();
      uploadAndInsert(e.dataTransfer.files, id);
    }
  };

  /* ----------------------------------------------------- block-level actions */

  const addBelow = (id) => {
    const nb = newBlock('paragraph');
    commit(insertAfter(tree(), id, nb), { focus: { id: nb.id, pos: 'start' } });
    setTimeout(() => {
      const el = els.current.get(nb.id);
      if (el) { el.focus(); document.execCommand('insertText', false, '/'); }
    }, 0);
  };
  const addChild = (id) => {
    const nb = newBlock('paragraph');
    commit(insertChild(updateBlock(tree(), id, { open: true }), id, nb), { focus: { id: nb.id, pos: 'start' } });
  };
  const addAfter = (id) => {
    const nb = newBlock('paragraph');
    commit(insertAfter(tree(), id, nb), { focus: { id: nb.id, pos: 'start' } });
  };

  const copyBlocks = (ids) => {
    const blocks = ids.map((id) => findBlock(tree(), id)).filter(Boolean);
    return { md: blocksToMarkdown(blocks), json: JSON.stringify(blocks) };
  };

  /* -------------------------------------------- selection-mode root handlers */

  const onRootKeyDown = (e) => {
    const sel = selectedRef.current;
    if (!sel.size || e.target !== rootRef.current) return;
    const order = selectableOrder(tree());
    const ids = order.filter((b) => sel.has(b.id)).map((b) => b.id);
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeIds(ids); }
    else if (e.key === 'Escape') { setSelected(new Set()); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const first = findBlock(tree(), ids[0]);
      setSelected(new Set());
      if (first && TEXT_TYPES.has(first.type)) focusBlock(first.id, 'end');
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      let t = tree();
      let anchor = ids[ids.length - 1];
      for (const id of ids) { const copy = cloneWithNewIds(findBlock(t, id)); t = insertAfter(t, anchor, copy); anchor = copy.id; }
      commit(t);
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAllBlocks();
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const up = e.key === 'ArrowUp';
      const edge = order.findIndex((b) => b.id === (up ? ids[0] : ids[ids.length - 1]));
      const next = order[edge + (up ? -1 : 1)];
      if (!next) return;
      setSelected(e.shiftKey ? new Set([...sel, next.id]) : new Set([next.id]));
    }
  };
  const onCopyCut = (e) => {
    const sel = selectedRef.current;
    if (!sel.size || document.activeElement !== rootRef.current) return;
    e.preventDefault();
    const ids = selectableOrder(tree()).filter((b) => sel.has(b.id)).map((b) => b.id);
    const { md, json } = copyBlocks(ids);
    e.clipboardData.setData('text/plain', md);
    e.clipboardData.setData(BLOCKS_MIME, json);
    if (e.type === 'cut') removeIds(ids);
  };
  const onRootPaste = (e) => {
    const sel = selectedRef.current;
    if (!sel.size || document.activeElement !== rootRef.current) return;
    const internal = e.clipboardData.getData(BLOCKS_MIME);
    const text = e.clipboardData.getData('text/plain');
    const ids = selectableOrder(tree()).filter((b) => sel.has(b.id)).map((b) => b.id);
    const anchor = ids[ids.length - 1];
    let blocks = null;
    try { blocks = internal ? JSON.parse(internal) : text ? markdownToBlocks(text) : null; } catch { blocks = null; }
    if (blocks?.length) { e.preventDefault(); insertBlocksAfter(anchor, blocks, { replaceIfEmpty: false }); setSelected(new Set()); }
  };

  /* --------------------------------------------------------- facade for children */

  impl.current = {
    registerEl: (id, el, prev) => {
      if (el) els.current.set(id, el);
      else if (els.current.get(id) === prev) els.current.delete(id);
    },
    onInput, onKeyDown, onPaste,
    onFocusBlock: (id) => {
      lastFocused.current = id;
      if (selectedRef.current.size) setSelected(new Set());
    },
    onTextClick: (e) => {
      const mention = e.target.closest?.('a.mention');
      if (mention) { e.preventDefault(); wsRef.current.go(mention.getAttribute('data-page')); return; }
      const link = e.target.closest?.('a[href]');
      if (link && (e.metaKey || e.ctrlKey)) { e.preventDefault(); window.open(link.href, '_blank', 'noopener'); }
    },
    setHtml,
    update: (id, patch, opts = {}) => commit(updateBlock(tree(), id, patch), opts.typing ? { typing: `${id}:${Object.keys(patch)[0]}` } : {}),
    convert: (id, type) => commit(updateBlock(tree(), id, (b) => convertBlock(b, type)), { focus: { id, pos: 'start' } }),
    selectBlock, moveFocus, addAfter, addBelow, addChild,
    dragStart, dragOver, drop: dropOn, dragEnd,
    onRowMouseDown: () => { if (selectedRef.current.size) setSelected(new Set()); },
    openBlockMenu: (id, anchor) => setBlockMenu({ id, anchor }),
    openPage: (id) => wsRef.current.go(id),
  };
  const ed = useMemo(() => new Proxy({}, { get: (_, k) => (...args) => impl.current[k](...args) }), []);

  useImperativeHandle(ref, () => ({
    focusStart: () => {
      const first = focusOrder(tree())[0];
      if (first) focusBlock(first.id, 'start');
    },
  }));

  useEffect(() => {
    const hide = () => { setSlash(null); setMention(null); };
    window.addEventListener('blur', hide);
    return () => window.removeEventListener('blur', hide);
  }, []);

  const blocks = blocksRef.current;
  const hasToc = useMemo(() => {
    let found = false;
    walk(blocks, (b) => { if (b.type === 'table_of_contents') found = true; return !found; });
    return found;
  }, [blocks]);
  const headingList = hasToc ? headings(blocks) : null;
  const headingSig = headingList ? JSON.stringify(headingList) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableHeadings = useMemo(() => headingList, [headingSig]);
  const onlyBlockId = blocks.length === 1 && blocks[0].type === 'paragraph' && isEmptyHtml(blocks[0].html) ? blocks[0].id : null;

  const ui = useMemo(
    () => ({ selected, drop, readOnly, headings: stableHeadings, onlyBlockId }),
    [selected, drop, readOnly, stableHeadings, onlyBlockId],
  );

  const menuBlock = blockMenu ? findBlock(blocks, blockMenu.id) : null;

  const onTailClick = () => {
    if (readOnly) return;
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'paragraph' && isEmptyHtml(last.html)) focusBlock(last.id, 'end');
    else {
      const nb = newBlock('paragraph');
      commit([...blocks, nb], { focus: { id: nb.id, pos: 'start' } });
    }
  };

  return (
    <EditorCtx.Provider value={ed}>
      <UiCtx.Provider value={ui}>
        <div
          className="editor"
          ref={rootRef}
          tabIndex={-1}
          onKeyDown={onRootKeyDown}
          onCopy={onCopyCut}
          onCut={onCopyCut}
          onPaste={onRootPaste}
          onMouseDown={(e) => { if (e.target === e.currentTarget && selectedRef.current.size) setSelected(new Set()); }}
          onDragOver={(e) => { if (!dragId.current && e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
          onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); uploadAndInsert(e.dataTransfer.files); } else if (dragId.current) dragEnd(); }}
        >
          <BlockList blocks={blocks} />
          {!readOnly && <div className="editor-tail" onClick={onTailClick} aria-hidden="true" />}
        </div>
        {!readOnly && <FormatToolbar suppressed={!!slash || !!mention} linkRequest={linkRequest} />}
        {slash && (
          <SlashMenu items={slashItems} index={Math.min(slash.index, Math.max(0, slashItems.length - 1))} rect={slash.rect} onPick={pickSlash} onHover={(i) => setSlash({ ...slash, index: i })} />
        )}
        {mention && (
          <MentionMenu items={mentionItems} index={Math.min(mention.index, Math.max(0, mentionItems.length - 1))} rect={mention.rect} onPick={pickMention} onHover={(i) => setMention({ ...mention, index: i })} />
        )}
        {blockMenu && menuBlock && (
          <BlockMenu
            block={menuBlock}
            anchor={blockMenu.anchor}
            onClose={() => setBlockMenu(null)}
            onTurnInto={(type) => commit(updateBlock(tree(), menuBlock.id, (b) => convertBlock(b, type)), { focus: { id: menuBlock.id, pos: 'end' } })}
            onColor={(color) => commit(updateBlock(tree(), menuBlock.id, { color }))}
            onDuplicate={() => duplicate(menuBlock.id)}
            onDelete={() => removeIds([menuBlock.id])}
            onCopyMarkdown={() => navigator.clipboard?.writeText(blocksToMarkdown([menuBlock]))}
            onCopyLink={() => { navigator.clipboard?.writeText(`${pageUrl(pageId)}?block=${menuBlock.id}`); wsRef.current.showToast('Link copied'); }}
          />
        )}
        {picker && (
          <SearchModal
            excludeId={pageId}
            placeholder="Link to page…"
            onClose={() => setPicker(null)}
            onPick={(p) => place(picker.blockId, picker.htmlNow, newBlock('link_to_page', { pageId: p.id }))}
          />
        )}
      </UiCtx.Provider>
    </EditorCtx.Provider>
  );
});

export default Editor;
