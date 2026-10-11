import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-test-'));
process.env.DATA_DIR = dir;

let server;
let base;

before(async () => {
  const { createApp } = await import('../app.js');
  const { seed } = await import('../seed.js');
  seed();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

test('seeded workspace exposes a tree without inline databases or rows', async () => {
  const { body } = await call('GET', '/pages');
  assert.equal(body.length, 1);
  assert.equal(body[0].title, 'Getting Started');
});

test('create, read, patch a page and derive search text from blocks', async () => {
  const created = await call('POST', '/pages', { title: 'Alpha' });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const patched = await call('PATCH', `/pages/${id}`, {
    blocks: [{ id: 'b1', type: 'paragraph', html: 'The <strong>quick</strong> brown fox', children: [] }],
    icon: '🦊',
  });
  assert.equal(patched.body.icon, '🦊');
  const hits = await call('GET', '/search?q=quick%20brown');
  assert.ok(hits.body.some((h) => h.id === id));
  assert.match(hits.body.find((h) => h.id === id).snippet, /quick brown fox/);
});

test('database rows are listed through the database endpoint', async () => {
  const tree = await call('GET', '/pages');
  const home = await call('GET', `/pages/${tree.body[0].id}`);
  const dbBlock = home.body.blocks.find((b) => b.type === 'child_database');
  const rows = await call('GET', `/databases/${dbBlock.pageId}/rows`);
  assert.equal(rows.body.length, 7);
  assert.ok(rows.body[0].props.status);
  const row = await call('GET', `/pages/${rows.body[0].id}`);
  assert.equal(row.body.path.at(-1).type, 'database');
});

test('trash cascades to children and restore brings them back', async () => {
  const parent = (await call('POST', '/pages', { title: 'Parent' })).body;
  const child = (await call('POST', '/pages', { title: 'Child', parent_id: parent.id })).body;
  await call('DELETE', `/pages/${parent.id}`);
  let tree = (await call('GET', '/pages')).body;
  assert.ok(!tree.find((p) => p.id === parent.id || p.id === child.id));
  const trash = (await call('GET', '/trash')).body;
  assert.ok(trash.find((p) => p.id === parent.id));
  assert.ok(!trash.find((p) => p.id === child.id), 'children are not listed separately');
  await call('POST', `/pages/${parent.id}/restore`);
  tree = (await call('GET', '/pages')).body;
  assert.ok(tree.find((p) => p.id === child.id));
});

test('a page cannot be moved into its own descendant', async () => {
  const a = (await call('POST', '/pages', { title: 'A' })).body;
  const b = (await call('POST', '/pages', { title: 'B', parent_id: a.id })).body;
  const res = await call('PATCH', `/pages/${a.id}`, { parent_id: b.id });
  assert.equal(res.status, 400);
});

test('duplicate copies sub-pages and remaps embedded ids', async () => {
  const tree = (await call('GET', '/pages')).body;
  const copy = (await call('POST', `/pages/${tree[0].id}/duplicate`)).body;
  assert.match(copy.title, /\(copy\)$/);
  const original = (await call('GET', `/pages/${tree[0].id}`)).body;
  const origDb = original.blocks.find((b) => b.type === 'child_database').pageId;
  const copyDb = copy.blocks.find((b) => b.type === 'child_database').pageId;
  assert.notEqual(origDb, copyDb);
  const rows = (await call('GET', `/databases/${copyDb}/rows`)).body;
  assert.equal(rows.length, 7);
});

test('permanent delete removes the page', async () => {
  const p = (await call('POST', '/pages', { title: 'Gone' })).body;
  await call('DELETE', `/pages/${p.id}?permanent=1`);
  assert.equal((await call('GET', `/pages/${p.id}`)).status, 404);
});

test('image upload accepts PNG and rejects other types', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const ok = await fetch(`${base}/upload`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png });
  assert.equal(ok.status, 201);
  const { url } = await ok.json();
  const served = await fetch(base.replace('/api', '') + url);
  assert.equal(served.status, 200);
  const bad = await fetch(`${base}/upload`, { method: 'POST', headers: { 'content-type': 'image/svg+xml' }, body: '<svg/>' });
  assert.ok(bad.status >= 400);
});

test('restoring a page that is not in the trash is a no-op, unknown pages 404', async () => {
  const p = (await call('POST', '/pages', { title: 'Live' })).body;
  const ok = await call('POST', `/pages/${p.id}/restore`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.id, p.id);
  assert.equal((await call('POST', '/pages/does-not-exist/restore')).status, 404);
});

test('restore reports whether it actually changed anything', async () => {
  const p = (await call('POST', '/pages', { title: 'Flag' })).body;
  assert.equal((await call('POST', `/pages/${p.id}/restore`)).body.restored, false);
  await call('DELETE', `/pages/${p.id}`);
  assert.equal((await call('POST', `/pages/${p.id}/restore`)).body.restored, true);
});

test('clients may supply a safe id when creating a page; bad or duplicate ids are rejected', async () => {
  const id = 'client-made-id-123';
  const ok = await call('POST', '/pages', { id, title: 'Optimistic' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.id, id);
  assert.equal((await call('POST', '/pages', { id, title: 'Again' })).status, 409);
  assert.equal((await call('POST', '/pages', { id: '../etc/passwd', title: 'x' })).status, 400);
  assert.equal((await call('POST', '/pages', { id: 'short', title: 'x' })).status, 400);
});

test('host guard rejects non-loopback Host headers when enabled', async () => {
  const { createApp } = await import('../app.js');
  const guarded = createApp({ guardHosts: true, allowedHosts: ['notes.example.com'] }).listen(0);
  await new Promise((r) => guarded.once('listening', r));
  const port = guarded.address().port;
  const http = await import('node:http');
  const get = (host) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/api/health', headers: { host } }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  try {
    assert.equal(await get(`localhost:${port}`), 200);
    assert.equal(await get(`127.0.0.1:${port}`), 200);
    assert.equal(await get('evil.example.net'), 403);
    assert.equal(await get('notes.example.com'), 200);
  } finally {
    guarded.close();
  }
});
