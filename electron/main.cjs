const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

// Configuration constants
const CONFIG = {
  isDev: process.env.NODE_ENV === 'development',
  window: {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Querty MIDI Controller'
  },
  urls: {
    dev: 'http://localhost:8081',
    prod: '../dist/index.html'
  }
};

let mainWindow;
let tray;
let isAlwaysOnTop = true;

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
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, CONFIG.urls.prod));
  }

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent window from being closed, just hide it
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
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
  app.isQuiting = true;
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
  createWindow();
  createTray();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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