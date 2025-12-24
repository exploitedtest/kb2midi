const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal, secure API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development',
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  onThemeChange: (callback) => ipcRenderer.on('theme-updated', (_event, theme) => callback?.(theme)),
  onSystemResume: (callback) => ipcRenderer.on('system-resume', () => callback?.()),
  onSystemSuspend: (callback) => ipcRenderer.on('system-suspend', () => callback?.()),
  onAppFocus: (callback) => ipcRenderer.on('app-focus', () => callback?.()),
  onAppBlur: (callback) => ipcRenderer.on('app-blur', () => callback?.())
});

// Security: Log any attempts to use dangerous APIs
if (process.env.NODE_ENV === 'development') {
  console.log('Preload script loaded securely');
} 
