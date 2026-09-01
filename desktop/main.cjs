/**
 * Cafyz desktop shell (Windows + macOS).
 *
 * The renderer is the same web-v2 build the browser and mobile apps use. It is
 * served over a loopback HTTP server rather than loaded from file://, because
 * the app uses history routing and file:// breaks both that and same-origin
 * requests. The server binds 127.0.0.1 on an ephemeral port, so nothing is
 * reachable from outside the machine.
 */
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

// Packaged: resources/web-v2/dist. Dev (electron .): ../web-v2/dist.
const DIST = process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'web-v2', 'dist'))
  ? path.join(process.resourcesPath, 'web-v2', 'dist')
  : path.join(__dirname, '..', 'web-v2', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.csv': 'text/csv; charset=utf-8',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        // Contain traversal: resolve inside DIST or fall back to the SPA entry.
        const candidate = path.normalize(path.join(DIST, urlPath));
        let file = candidate.startsWith(DIST) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
          ? candidate
          : path.join(DIST, 'index.html');
        const body = await fs.promises.readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch (e) {
        res.writeHead(500).end('Internal error');
      }
    });
    server.on('error', reject);
    // Port 0 = let the OS pick a free one, so two windows never collide.
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function createWindow() {
  const server = await startServer();
  const { port } = server.address();

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0a0e1a',
    title: 'Cafyz',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      // The renderer is our own build, but it loads Google's sign-in script —
      // keep it sandboxed with no Node access regardless.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://127.0.0.1:${port}/`);

  // External links (Google sign-in, support, legal) open in the real browser
  // instead of hijacking the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.on('closed', () => server.close());
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ]));
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
