import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = join(DIST, relative);
  if (!file.startsWith(DIST)) return null;
  return file;
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end('Bad request');
    return;
  }

  const pathname = req.url === '/' ? '/index.html' : req.url;
  const filePath = resolveFile(pathname);
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
    return;
  } catch {
    // SPA fallback — client-side routes
  }

  try {
    const html = await readFile(join(DIST, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    console.error('dist/index.html missing — run npm run build before start', err);
    res.writeHead(503).end('App not built');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cafyz web serving dist on port ${PORT}`);
});
