import { createApp } from './app.js';
import { countPages } from './pages.js';
import { seed } from './seed.js';

if (countPages() === 0) {
  seed();
  console.log('Seeded a fresh workspace.');
}

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const loopbackOnly = /^(127\.|localhost$|::1$)/i.test(HOST);
const allowedHosts = (process.env.ALLOWED_HOSTS || '').split(',');

createApp({ guardHosts: loopbackOnly, allowedHosts }).listen(PORT, HOST, () => {
  console.log(`TaskMaster workspace API on http://${HOST}:${PORT}`);
});
