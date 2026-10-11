import { randomUUID } from 'node:crypto';
import { db, tx } from './db.js';

const JSON_FIELDS = ['blocks', 'props', 'schema', 'views', 'settings'];
const PATCHABLE = new Set([
  'parent_id', 'title', 'icon', 'cover', 'blocks', 'props', 'schema', 'views',
  'settings', 'favorite', 'position', 'type', 'inline',
]);

const now = () => Date.now();

function hydrate(row) {
  if (!row) return null;
  const out = { ...row };
  for (const f of JSON_FIELDS) out[f] = JSON.parse(row[f] || (f === 'props' || f === 'settings' ? '{}' : '[]'));
  out.favorite = !!row.favorite;
  out.inline = !!row.inline;
  delete out.text;
  return out;
}

const decode = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Flatten a block tree into searchable plain text. */
export function blocksToText(blocks) {
  const out = [];
  const walk = (list) => {
    for (const b of list || []) {
      if (typeof b.html === 'string' && b.html) out.push(decode(b.html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')));
      if (b.caption) out.push(String(b.caption));
      if (b.type === 'table' && Array.isArray(b.rows)) {
        for (const r of b.rows) for (const c of r) out.push(decode(String(c).replace(/<[^>]*>/g, '')));
      }
      if (b.children) walk(b.children);
    }
  };
  walk(blocks);
  return out.join('\n').slice(0, 200_000);
}

export function getPage(id) {
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
  if (!row) return null;
  const page = hydrate(row);
  page.path = ancestors(id);
  return page;
}

/** Ancestor chain from the root down to (but excluding) the page itself. */
export function ancestors(id) {
  const rows = db.prepare(`
    WITH RECURSIVE up(id, parent_id, title, icon, type, inline, depth) AS (
      SELECT p.id, p.parent_id, p.title, p.icon, p.type, p.inline, 0 FROM pages p WHERE p.id = (SELECT parent_id FROM pages WHERE id = ?)
      UNION ALL
      SELECT p.id, p.parent_id, p.title, p.icon, p.type, p.inline, up.depth + 1 FROM pages p JOIN up ON p.id = up.parent_id WHERE up.depth < 50
    )
    SELECT id, title, icon, type, inline FROM up ORDER BY depth DESC
  `).all(id);
  return rows.map((r) => ({ ...r, inline: !!r.inline }));
}

const META_COLS = 'p.id, p.parent_id, p.type, p.title, p.icon, p.favorite, p.position, p.updated_at, p.created_at';

/** Pages shown in the sidebar: everything except database rows and inline databases. */
export function listTree() {
  const rows = db.prepare(`
    SELECT ${META_COLS} FROM pages p
    LEFT JOIN pages par ON par.id = p.parent_id
    WHERE p.trashed_at IS NULL AND p.inline = 0 AND (par.id IS NULL OR par.type != 'database')
    ORDER BY p.position ASC, p.created_at ASC
  `).all();
  return rows.map((r) => ({ ...r, favorite: !!r.favorite }));
}

export function listTrash() {
  const rows = db.prepare(`
    SELECT ${META_COLS}, p.trashed_at, p.inline FROM pages p
    LEFT JOIN pages par ON par.id = p.parent_id
    WHERE p.trashed_at IS NOT NULL AND (par.id IS NULL OR par.trashed_at IS NULL OR par.trashed_at != p.trashed_at)
    ORDER BY p.trashed_at DESC
  `).all();
  return rows.map((r) => ({ ...r, favorite: !!r.favorite, inline: !!r.inline }));
}

export function listRows(dbId) {
  const rows = db.prepare(`
    SELECT id, parent_id, type, title, icon, cover, props, position, created_at, updated_at
    FROM pages WHERE parent_id = ? AND trashed_at IS NULL AND type = 'page'
    ORDER BY position ASC, created_at ASC
  `).all(dbId);
  return rows.map((r) => ({ ...r, props: JSON.parse(r.props || '{}') }));
}

function nextPosition(parentId) {
  const row = parentId
    ? db.prepare('SELECT MAX(position) AS m FROM pages WHERE parent_id = ?').get(parentId)
    : db.prepare('SELECT MAX(position) AS m FROM pages WHERE parent_id IS NULL').get();
  return (row?.m ?? 0) + 1;
}

export function createPage(input = {}) {
  const id = input.id || randomUUID();
  const t = now();
  const blocks = input.blocks || [];
  db.prepare(`
    INSERT INTO pages (id, parent_id, type, inline, title, icon, cover, blocks, props, schema, views, settings, text, favorite, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.parent_id || null,
    input.type === 'database' ? 'database' : 'page',
    input.inline ? 1 : 0,
    String(input.title ?? ''),
    input.icon ?? null,
    input.cover ?? null,
    JSON.stringify(blocks),
    JSON.stringify(input.props || {}),
    JSON.stringify(input.schema || []),
    JSON.stringify(input.views || []),
    JSON.stringify(input.settings || {}),
    blocksToText(blocks),
    input.favorite ? 1 : 0,
    input.position ?? nextPosition(input.parent_id),
    t,
    t,
  );
  return getPage(id);
}

export function updatePage(id, patch) {
  const existing = db.prepare('SELECT id FROM pages WHERE id = ?').get(id);
  if (!existing) return null;
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(patch || {})) {
    if (!PATCHABLE.has(key)) continue;
    if (key === 'parent_id') {
      if (value === id) throw httpError(400, 'A page cannot be its own parent');
      if (value && isDescendant(value, id)) throw httpError(400, 'Cannot move a page into its own descendant');
    }
    if (JSON_FIELDS.includes(key)) {
      sets.push(`${key} = ?`);
      values.push(JSON.stringify(value));
      if (key === 'blocks') {
        sets.push('text = ?');
        values.push(blocksToText(value));
      }
    } else if (key === 'favorite' || key === 'inline') {
      sets.push(`${key} = ?`);
      values.push(value ? 1 : 0);
    } else if (key === 'type') {
      sets.push('type = ?');
      values.push(value === 'database' ? 'database' : 'page');
    } else {
      sets.push(`${key} = ?`);
      values.push(value ?? null);
    }
  }
  if (!sets.length) return getPage(id);
  sets.push('updated_at = ?');
  values.push(now());
  db.prepare(`UPDATE pages SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
  return getPage(id);
}

function isDescendant(candidateId, ancestorId) {
  const row = db.prepare(`
    WITH RECURSIVE up(id, parent_id, depth) AS (
      SELECT id, parent_id, 0 FROM pages WHERE id = ?
      UNION ALL
      SELECT p.id, p.parent_id, up.depth + 1 FROM pages p JOIN up ON p.id = up.parent_id WHERE up.depth < 100
    )
    SELECT 1 AS hit FROM up WHERE id = ? LIMIT 1
  `).get(candidateId, ancestorId);
  return !!row;
}

function descendantIds(id) {
  return db.prepare(`
    WITH RECURSIVE down(id) AS (
      SELECT id FROM pages WHERE id = ?
      UNION ALL
      SELECT p.id FROM pages p JOIN down ON p.parent_id = down.id
    )
    SELECT id FROM down
  `).all(id).map((r) => r.id);
}

/** Soft delete: the page and all its descendants share one trashed_at stamp. */
export function trashPage(id) {
  const t = now();
  return tx(() => {
    const ids = descendantIds(id);
    const mark = db.prepare('UPDATE pages SET trashed_at = ? WHERE id = ? AND trashed_at IS NULL');
    for (const pid of ids) mark.run(t, pid);
    return ids.length;
  });
}

export function restorePage(id) {
  const row = db.prepare('SELECT id, parent_id, trashed_at FROM pages WHERE id = ?').get(id);
  if (!row) return null;
  if (row.trashed_at == null) return { ...getPage(id), restored: false }; // already live: restoring is idempotent
  return tx(() => {
    const ids = db.prepare(`
      WITH RECURSIVE down(id) AS (
        SELECT id FROM pages WHERE id = ?
        UNION ALL
        SELECT p.id FROM pages p JOIN down ON p.parent_id = down.id WHERE p.trashed_at = ?
      )
      SELECT id FROM down
    `).all(id, row.trashed_at).map((r) => r.id);
    const clear = db.prepare('UPDATE pages SET trashed_at = NULL WHERE id = ?');
    for (const pid of ids) clear.run(pid);
    // If the parent is still in the trash, resurface at the top level.
    if (row.parent_id) {
      const parent = db.prepare('SELECT trashed_at FROM pages WHERE id = ?').get(row.parent_id);
      if (!parent || parent.trashed_at != null) {
        db.prepare('UPDATE pages SET parent_id = NULL, position = ? WHERE id = ?').run(nextPosition(null), id);
      }
    }
    return { ...getPage(id), restored: true };
  });
}

export function purgePage(id) {
  return tx(() => {
    const ids = descendantIds(id);
    const del = db.prepare('DELETE FROM pages WHERE id = ?');
    for (const pid of ids) del.run(pid);
    return ids.length;
  });
}

export function emptyTrash() {
  const roots = listTrash();
  let count = 0;
  for (const r of roots) count += purgePage(r.id);
  return count;
}

/** Deep copy a page, its sub-pages and database rows. Page ids referenced inside bodies are remapped. */
export function duplicatePage(id) {
  return tx(() => {
    const ids = descendantIds(id).filter((pid) => {
      const r = db.prepare('SELECT trashed_at FROM pages WHERE id = ?').get(pid);
      return r && r.trashed_at == null;
    });
    const map = new Map(ids.map((old) => [old, randomUUID()]));
    const t = now();
    for (const old of ids) {
      const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(old);
      let blocks = row.blocks;
      let views = row.views;
      for (const [from, to] of map) {
        blocks = blocks.split(from).join(to);
        views = views.split(from).join(to);
      }
      const isRoot = old === id;
      const parent = isRoot ? row.parent_id : map.get(row.parent_id) ?? row.parent_id;
      db.prepare(`
        INSERT INTO pages (id, parent_id, type, inline, title, icon, cover, blocks, props, schema, views, settings, text, favorite, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(
        map.get(old), parent, row.type, row.inline,
        isRoot ? `${row.title || 'Untitled'} (copy)` : row.title,
        row.icon, row.cover, blocks, row.props, row.schema, views, row.settings, row.text,
        isRoot ? nextPosition(row.parent_id) : row.position, t, t,
      );
    }
    return getPage(map.get(id));
  });
}

export function search(q, limit = 30) {
  const term = String(q || '').trim();
  const base = `SELECT ${META_COLS}, p.text AS text, p.inline AS inline FROM pages p WHERE p.trashed_at IS NULL`;
  if (!term) {
    return db.prepare(`${base} AND p.inline = 0 ORDER BY p.updated_at DESC LIMIT 12`).all().map((r) => ({ ...shape(r), snippet: '' }));
  }
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = db.prepare(`
    ${base} AND (p.title LIKE ? ESCAPE '\\' OR p.text LIKE ? ESCAPE '\\')
    ORDER BY (p.title LIKE ? ESCAPE '\\') DESC, p.updated_at DESC LIMIT ?
  `).all(like, like, like, limit);
  const lower = term.toLowerCase();
  return rows.map((r) => {
    let snippet = '';
    const idx = r.text.toLowerCase().indexOf(lower);
    if (idx >= 0 && !(r.title || '').toLowerCase().includes(lower)) {
      const start = Math.max(0, idx - 40);
      snippet = (start > 0 ? '…' : '') + r.text.slice(start, idx + term.length + 80).replace(/\s+/g, ' ');
    }
    return { ...shape(r), snippet };
  });
}

function shape(r) {
  const { text, ...rest } = r; // eslint-disable-line no-unused-vars
  return { ...rest, favorite: !!r.favorite, inline: !!r.inline };
}

export function countPages() {
  return db.prepare('SELECT COUNT(*) AS n FROM pages').get().n;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
