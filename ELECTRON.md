# Querty MIDI Controller - Electron Desktop App

## Development

### Running in Development Mode
```bash
# Start the Vite dev server
npm run dev

# In another terminal, start Electron
npm run electron-dev
```

### Building for Production
```bash
# Build the web app and create desktop app
npm run electron-pack
```

## Features

### Always on Top
- Window stays above other applications
- Toggle via menu: File > Always on Top
- Perfect for musicians who need quick access

### System Tray
- App minimizes to system tray (menu bar on Mac)
- Double-click tray icon to show window
- Right-click for context menu

### Native Integration
- Proper app menu with keyboard shortcuts
- Single instance lock (prevents multiple windows)
- Native window controls

### Window Behavior
- Close button hides window (doesn't quit)
- Quit via menu or tray context menu
- Auto-focus when shown from tray

## Building Icons

You'll need to create icons for different platforms:

- **macOS**: `assets/icon.icns` (512x512)
- **Windows**: `assets/icon.ico` (256x256)
- **Linux**: `assets/icon.png` (512x512)

## Distribution

The built app will be in the `release` directory:
- **macOS**: `.dmg` installer
- **Windows**: `.exe` installer
- **Linux**: `.AppImage` file

## Troubleshooting

### Development Issues
- Make sure Vite dev server is running on port 8081
- Check console for any errors
- Use `Cmd+Option+I` to open DevTools

### Build Issues
- Ensure all dependencies are installed
- Check that the `dist` directory exists after build
- Verify icon files are in the correct format 