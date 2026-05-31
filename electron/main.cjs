/**
 * Cafyz Desktop — Electron shell loading the production web app.
 * Chromium inside Electron supports Web Bluetooth + Web USB for thermal printers.
 */
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const CAFYZ_URL = process.env.CAFYZ_URL || 'https://cafyz.ametronyx.com';
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Cafyz',
    backgroundColor: '#07060F',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: !isDev,
  });

  win.loadURL(CAFYZ_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
