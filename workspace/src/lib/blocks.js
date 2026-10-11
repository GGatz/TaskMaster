// Pure helpers for the block tree. A block is
//   { id, type, html, children: Block[], ...typeSpecificFields }
// Trees are treated as immutable by the editor; structural helpers clone before mutating.

import { escapeHtml, htmlToText } from './sanitize.js';

export const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14));

/** Blocks whose body is rich text edited in a contentEditable. */
export const RICH_TEXT_TYPES = new Set([
  'paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list', 'numbered_list',
  'to_do', 'toggle', 'quote', 'callout',
]);
/** Blocks that hold text and take the caret (rich text + code). */
export const TEXT_TYPES = new Set([...RICH_TEXT_TYPES, 'code']);
/** "Turn into" targets. */
export const TURN_INTO_TYPES = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list', 'numbered_list', 'to_do', 'toggle', 'quote', 'callout', 'code'];
/** Blocks that continue as the same type on Enter. */
export const CONTINUES_ON_ENTER = new Set(['bulleted_list', 'numbered_list', 'to_do']);
export const NO_CHILDREN = new Set(['column_list', 'column', 'divider', 'table']);

export function newBlock(type = 'paragraph', extra = {}) {
  const base = { id: uid(), type, html: '', children: [] };
  switch (type) {
    case 'to_do': base.checked = false; break;
    case 'toggle': base.open = true; break;
    case 'callout': base.icon = '💡'; break;
    case 'code': base.lang = 'plain text'; break;
    case 'table': base.rows = [['', ''], ['', '']]; base.header = true; break;
    case 'column_list': base.children = [newBlock('column'), newBlock('column')]; break;
    case 'column': base.children = [newBlock('paragraph')]; break;
    default: break;
  }
  return { ...base, ...extra };
}

export const cloneTree = (tree) => structuredClone(tree);

/** Deep copy with fresh ids (used by duplicate / paste). */
export function cloneWithNewIds(block) {
  const copy = structuredClone(block);
  const refresh = (b) => {
    b.id = uid();
    (b.children || []).forEach(refresh);
  };
  refresh(copy);
  return copy;
}

export function walk(tree, fn, parent = null) {
  for (const b of tree) {
    if (fn(b, parent) === false) return false;
    if (b.children?.length && walk(b.children, fn, b) === false) return false;
  }
  return true;
}

export function locate(tree, id, parent = null) {
  for (let i = 0; i < tree.length; i++) {
    if (tree[i].id === id) return { block: tree[i], list: tree, index: i, parent };
    if (tree[i].children?.length) {
      const found = locate(tree[i].children, id, tree[i]);
      if (found) return found;
    }
  }
  return null;
}

export const findBlock = (tree, id) => locate(tree, id)?.block ?? null;

/** Path-copying update: untouched branches keep their identity. */
export function updateBlock(tree, id, patch) {
  let changed = false;
  const next = tree.map((b) => {
    if (b.id === id) {
      changed = true;
      const p = typeof patch === 'function' ? patch(b) : patch;
      return { ...b, ...p };
    }
    if (b.children?.length) {
      const kids = updateBlock(b.children, id, patch);
      if (kids !== b.children) {
        changed = true;
        return { ...b, children: kids };
      }
    }
    return b;
  });
  return changed ? next : tree;
}

export function insertAfter(tree, id, block) {
  const t = cloneTree(tree);
  const loc = locate(t, id);
  if (!loc) { t.push(block); return t; }
  loc.list.splice(loc.index + 1, 0, ...[].concat(block));
  return t;
}

export function insertBefore(tree, id, block) {
  const t = cloneTree(tree);
  const loc = locate(t, id);
  if (!loc) { t.unshift(block); return t; }
  loc.list.splice(loc.index, 0, ...[].concat(block));
  return t;
}

export function insertChild(tree, parentId, block, index = Infinity) {
  const t = cloneTree(tree);
  const loc = locate(t, parentId);
  if (!loc) return t;
  loc.block.children = loc.block.children || [];
  loc.block.children.splice(Math.min(index, loc.block.children.length), 0, ...[].concat(block));
  return t;
}

export function replaceBlock(tree, id, blocks) {
  const t = cloneTree(tree);
  const loc = locate(t, id);
  if (!loc) return t;
  loc.list.splice(loc.index, 1, ...[].concat(blocks));
  return t;
}

export function removeBlock(tree, id) {
  const t = cloneTree(tree);
  const loc = locate(t, id);
  if (!loc) return { tree, removed: null };
  const [removed] = loc.list.splice(loc.index, 1);
  return { tree: cleanupColumns(t), removed };
}

/** A column_list with a single column collapses; empty columns disappear. */
function cleanupColumns(tree) {
  const out = [];
  for (const b of tree) {
    if (b.children?.length) b.children = cleanupColumns(b.children);
    if (b.type === 'column_list') {
      b.children = b.children.filter((c) => c.children.length > 0);
      if (b.children.length === 0) continue;
      if (b.children.length === 1) {
        out.push(...b.children[0].children);
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

export function isDescendantOrSelf(tree, ancestorId, id) {
  const a = findBlock(tree, ancestorId);
  if (!a) return false;
  let hit = false;
  walk([a], (b) => {
    if (b.id === id) hit = true;
    return !hit;
  });
  return hit;
}

/** Move `id` next to / into `targetId`. pos: 'before' | 'after' | 'inside' | 'left' | 'right' */
export function moveBlock(tree, id, targetId, pos) {
  if (id === targetId || isDescendantOrSelf(tree, id, targetId)) return tree;
  const { tree: without, removed } = removeBlock(tree, id);
  if (!removed) return tree;
  // A remove may have collapsed columns; if the target vanished, give up.
  if (!findBlock(without, targetId)) return tree;
  if (pos === 'inside') return insertChild(without, targetId, removed);
  if (pos === 'left' || pos === 'right') return wrapInColumns(without, targetId, removed, pos);
  return pos === 'before' ? insertBefore(without, targetId, removed) : insertAfter(without, targetId, removed);
}

function wrapInColumns(tree, targetId, moved, side) {
  const t = cloneTree(tree);
  const loc = locate(t, targetId);
  if (!loc) return tree;
  // Already inside a column: add a sibling column next to it.
  if (loc.parent?.type === 'column') {
    const colLoc = locate(t, loc.parent.id);
    const col = newBlock('column', { children: [moved] });
    colLoc.list.splice(colLoc.index + (side === 'right' ? 1 : 0), 0, col);
    return t;
  }
  const target = loc.list[loc.index];
  const colA = newBlock('column', { children: [target] });
  const colB = newBlock('column', { children: [moved] });
  const list = newBlock('column_list', { children: side === 'left' ? [colB, colA] : [colA, colB] });
  loc.list.splice(loc.index, 1, list);
  return t;
}

export function indentBlock(tree, id) {
  const t = cloneTree(tree);
  const loc = locate(t, id);
  if (!loc || loc.index === 0) return tree;
  const prev = loc.list[loc.index - 1];
  if (NO_CHILDREN.has(prev.type) || NO_CHILDREN.has(loc.block.type)) return tree;
  loc.list.splice(loc.index, 1);
  prev.children = prev.children || [];
  prev.children.push(loc.block);
  if (prev.type === 'toggle') prev.open = true;
  return t;
}

export function outdentBlock(tree, id) {
  const t = cloneTree(tree);
  const loc = locate(t, id);
  if (!loc || !loc.parent || loc.parent.type === 'column') return tree;
  const parentLoc = locate(t, loc.parent.id);
  loc.list.splice(loc.index, 1);
  parentLoc.list.splice(parentLoc.index + 1, 0, loc.block);
  return t;
}

/** Focusable blocks in reading order. Collapsed toggles hide their children. */
export function focusOrder(tree) {
  const out = [];
  const visit = (list) => {
    for (const b of list) {
      if (TEXT_TYPES.has(b.type)) out.push(b);
      if (b.children?.length && !(b.type === 'toggle' && !b.open)) visit(b.children);
    }
  };
  visit(tree);
  return out;
}

/** All blocks (not just focusable ones) in reading order, for range selection. */
export function selectableOrder(tree) {
  const out = [];
  const visit = (list) => {
    for (const b of list) {
      out.push(b);
      if (b.children?.length && !(b.type === 'toggle' && !b.open) && b.type !== 'column_list' && b.type !== 'column') visit(b.children);
    }
  };
  visit(tree);
  return out;
}

export const isEmptyHtml = (html) => !html || htmlToText(html).trim() === '' && !/<img/i.test(html);

export function plainText(block) {
  return htmlToText(block.html || '');
}

/** Change a block's type, converting between rich text and code. */
export function convertBlock(block, type) {
  const next = { ...block, type };
  if (type === 'code') {
    next.html = escapeHtml(htmlToText(block.html));
    next.lang = block.lang || 'plain text';
  } else if (block.type === 'code') {
    next.html = block.html; // already escaped plain text
  }
  if (type === 'to_do') next.checked = !!block.checked;
  if (type === 'toggle') next.open = block.type === 'toggle' ? block.open : true;
  if (type === 'callout') next.icon = block.icon || '💡';
  return next;
}

/** Page ids of embedded sub-pages / inline databases, to keep trash state in sync. */
export function ownedPageIds(tree) {
  const ids = new Set();
  walk(tree, (b) => {
    if ((b.type === 'child_page' || b.type === 'child_database') && b.pageId) ids.add(b.pageId);
  });
  return ids;
}

export function headings(tree) {
  const out = [];
  walk(tree, (b) => {
    if (b.type === 'heading_1' || b.type === 'heading_2' || b.type === 'heading_3') {
      out.push({ id: b.id, level: Number(b.type.slice(-1)), text: plainText(b) });
    }
  });
  return out;
}
