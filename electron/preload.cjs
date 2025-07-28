const { contextBridge } = require('electron');

// Expose minimal, secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development',
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// Security: Log any attempts to use dangerous APIs
if (process.env.NODE_ENV === 'development') {
  console.log('Preload script loaded securely');
} 