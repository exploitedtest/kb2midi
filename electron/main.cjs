const { app, BrowserWindow, Menu, Tray, nativeImage, powerMonitor, nativeTheme, ipcMain } = require('electron');
const path = require('path');

// Silence Chromium logging in production or if QUIET_LOGS=1 is set
if (process.env.NODE_ENV !== 'development' || process.env.QUIET_LOGS === '1') {
  try {
    app.commandLine.appendSwitch('disable-logging');
    app.commandLine.appendSwitch('log-level', '3');
  } catch (_) {}
}

// Configuration constants
const CONFIG = {
  isDev: process.env.NODE_ENV === 'development',
  window: {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'kb2midi'
  },
  urls: {
    dev: 'http://localhost:8080',
    prod: '../dist/index.html'
  }
};

let mainWindow;
let tray;
let isAlwaysOnTop = false;
app.isQuitting = false;

const getSystemTheme = () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

function broadcastTheme() {
  if (mainWindow) {
    mainWindow.webContents.send('theme-updated', getSystemTheme());
  }
}

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      ...CONFIG.window,
      alwaysOnTop: isAlwaysOnTop,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.cjs'),
        sandbox: false, // Required for Web MIDI API access
        webSecurity: true,
        allowRunningInsecureContent: false
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      show: false
    });
  } catch (error) {
    console.error('Failed to create main window:', error);
    app.quit();
    return;
  }

  // Load the app
  if (CONFIG.isDev) {
    mainWindow.loadURL(CONFIG.urls.dev);
    if (process.env.OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, CONFIG.urls.prod));
  }

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // macOS: ensure focus and inform renderer around fullscreen transitions
  mainWindow.on('enter-full-screen', () => {
    try {
      mainWindow.focus();
      mainWindow.webContents.send('app-focus');
      // Temporarily disable always-on-top while in native fullscreen
      // to avoid potential input/focus issues on macOS
      mainWindow.setAlwaysOnTop(false);
    } catch {}
  });
  mainWindow.on('leave-full-screen', () => {
    try {
      mainWindow.focus();
      mainWindow.webContents.send('app-focus');
      // Restore preferred always-on-top state when exiting fullscreen
      mainWindow.setAlwaysOnTop(isAlwaysOnTop);
    } catch {}
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent window from being closed, just hide it
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

// Utility functions
function showAndFocusWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function toggleAlwaysOnTop(checked) {
  isAlwaysOnTop = checked;
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(checked);
  }
}

function quitApp() {
  app.isQuitting = true;
  app.quit();
}

function createTray() {
  const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show MIDI Controller',
      click: showAndFocusWindow
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: (menuItem) => toggleAlwaysOnTop(menuItem.checked)
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: quitApp
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip(CONFIG.window.title);
  tray.on('double-click', showAndFocusWindow);
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: isAlwaysOnTop,
          click: (menuItem) => {
            toggleAlwaysOnTop(menuItem.checked);
            // Update the menu item state to stay in sync
            menuItem.checked = isAlwaysOnTop;
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: quitApp
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// App event handlers
app.whenReady().then(() => {
  nativeTheme.themeSource = 'system';
  ipcMain.handle('get-system-theme', () => getSystemTheme());
  nativeTheme.on('updated', () => {
    broadcastTheme();
  });

  createWindow();
  createTray();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      showAndFocusWindow();
    }
  });

  // Forward focus/blur events to renderer so it can resume/stop notes
  app.on('browser-window-focus', () => {
    if (mainWindow) mainWindow.webContents.send('app-focus');
  });
  app.on('browser-window-blur', () => {
    if (mainWindow) mainWindow.webContents.send('app-blur');
  });

  // Power events: resume/suspend/lock/unlock
  try {
    powerMonitor.on('resume', () => {
      if (mainWindow) mainWindow.webContents.send('system-resume');
    });
    powerMonitor.on('unlock-screen', () => {
      if (mainWindow) mainWindow.webContents.send('system-resume');
    });
    powerMonitor.on('suspend', () => {
      if (mainWindow) mainWindow.webContents.send('system-suspend');
    });
    powerMonitor.on('lock-screen', () => {
      if (mainWindow) mainWindow.webContents.send('system-suspend');
    });
  } catch (err) {
    console.warn('Power monitor not available:', err);
  }
});

// Ensure app.isQuitting is set on quit (for macOS)
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
} 
