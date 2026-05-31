const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('cafyzElectron', true);
