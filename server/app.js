import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as pages from './pages.js';
import { UPLOAD_DIR } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '..', 'dist');

const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|\[::1\]|::1)$/i;

/**
 * There is no login, so when the server only listens on loopback it also refuses requests whose Host
 * header is not loopback (or explicitly allowed). That blocks DNS-rebinding attacks from web pages.
 */
function hostGuard(extra = []) {
  const allowed = new Set(extra.map((h) => h.trim().toLowerCase()).filter(Boolean));
  return (req, res, next) => {
    const host = String(req.headers.host || '').toLowerCase();
    const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
    if (LOOPBACK.test(name) || allowed.has(host) || allowed.has(name)) return next();
    res.status(403).json({ error: 'Host not allowed' });
  };
}

export function createApp({ guardHosts = false, allowedHosts = [] } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (guardHosts) app.use(hostGuard(allowedHosts));
  app.use(express.json({ limit: '25mb' }));

  const api = express.Router();

  api.get('/health', (req, res) => res.json({ ok: true }));

  // Sidebar tree (metadata only)
  api.get('/pages', (req, res) => res.json(pages.listTree()));

  api.get('/trash', (req, res) => res.json(pages.listTrash()));
  api.delete('/trash', (req, res) => res.json({ purged: pages.emptyTrash() }));

  api.get('/search', (req, res) => res.json(pages.search(req.query.q, Math.min(Number(req.query.limit) || 30, 100))));

  api.post('/pages', (req, res) => {
    const body = req.body || {};
    if (body.parent_id && !pages.getPage(body.parent_id)) throw pages.httpError(404, 'Parent not found');
    if (body.id !== undefined) {
      if (typeof body.id !== 'string' || !/^[\w-]{8,64}$/.test(body.id)) throw pages.httpError(400, 'Invalid id');
      if (pages.getPage(body.id)) throw pages.httpError(409, 'A page with this id already exists');
    }
    res.status(201).json(pages.createPage(body));
  });

  api.get('/pages/:id', (req, res) => {
    const page = pages.getPage(req.params.id);
    if (!page) throw pages.httpError(404, 'Page not found');
    res.json(page);
  });

  api.patch('/pages/:id', (req, res) => {
    const page = pages.updatePage(req.params.id, req.body);
    if (!page) throw pages.httpError(404, 'Page not found');
    res.json(page);
  });

  // Move to trash (soft delete)
  api.delete('/pages/:id', (req, res) => {
    if (!pages.getPage(req.params.id)) throw pages.httpError(404, 'Page not found');
    if (req.query.permanent === '1') return res.json({ purged: pages.purgePage(req.params.id) });
    res.json({ trashed: pages.trashPage(req.params.id) });
  });

  api.post('/pages/:id/restore', (req, res) => {
    const page = pages.restorePage(req.params.id);
    if (!page) throw pages.httpError(404, 'Page not found');
    res.json(page);
  });

  api.post('/pages/:id/duplicate', (req, res) => {
    if (!pages.getPage(req.params.id)) throw pages.httpError(404, 'Page not found');
    res.status(201).json(pages.duplicatePage(req.params.id));
  });

  api.get('/databases/:id/rows', (req, res) => {
    const db = pages.getPage(req.params.id);
    if (!db || db.type !== 'database') throw pages.httpError(404, 'Database not found');
    res.json(pages.listRows(req.params.id));
  });

  // Image uploads: raw body, content type decides the extension (SVG is deliberately excluded).
  api.post(
    '/upload',
    express.raw({ type: Object.keys(IMAGE_TYPES), limit: '20mb' }),
    (req, res) => {
      const ext = IMAGE_TYPES[(req.headers['content-type'] || '').split(';')[0].trim()];
      if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) throw pages.httpError(415, 'Unsupported or empty image');
      const name = `${randomUUID()}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
      res.status(201).json({ url: `/uploads/${name}` });
    },
  );

  app.use('/api', api);

  app.use(
    '/uploads',
    express.static(UPLOAD_DIR, {
      index: false,
      immutable: true,
      maxAge: '1y',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  if (fs.existsSync(path.join(DIST, 'index.html'))) {
    app.use(express.static(DIST));
    app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  return app;
}
