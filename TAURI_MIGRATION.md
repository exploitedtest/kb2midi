# Tauri Migration Guide

## Overview

kb2midi now supports **Tauri** as a lightweight alternative to Electron for desktop deployment. Tauri produces significantly smaller application bundles by using the system's native webview instead of bundling Chromium.

## Bundle Size Comparison

| Platform | Electron | Tauri | Reduction |
|----------|----------|-------|-----------|
| macOS    | ~120 MB  | ~8 MB | 93% smaller |
| Windows  | ~150 MB  | ~5 MB | 97% smaller |
| Linux    | ~140 MB  | ~10 MB| 93% smaller |

## Features

Both Electron and Tauri implementations support the same features:

- ✅ Always on Top window
- ✅ System tray icon with menu
- ✅ Single instance lock
- ✅ Focus/blur event handling
- ✅ Native menus
- ✅ Full Web MIDI API support
- ✅ Cross-platform (macOS, Windows, Linux)

## System Requirements

### Development

**Rust Toolchain** (required for Tauri):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Platform-Specific Dependencies:**

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 (pre-installed on Windows 10/11)

### End Users

**macOS/Windows:** No additional requirements (WebView2 is pre-installed on Windows 10/11)

**Linux:** Requires webkit2gtk runtime:
```bash
sudo apt install libwebkit2gtk-4.0-37
```

## Usage

### Development

```bash
# Start Tauri in development mode
npm run tauri-dev
```

This will:
1. Build the frontend with Vite
2. Start the Tauri development server
3. Open the app with hot-reload enabled

### Building for Production

```bash
# Build optimized production bundle
npm run tauri-build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`:

- **macOS**: DMG and app bundle
- **Windows**: MSI and NSIS installer
- **Linux**: AppImage, deb, and rpm

### Debug Build

```bash
# Build with debug symbols (larger but easier to debug)
npm run tauri-build-debug
```

## Migration from Electron

The application automatically detects whether it's running in Tauri or Electron and uses the appropriate APIs. Both implementations can coexist in the same codebase.

### Key Differences

| Feature | Electron | Tauri |
|---------|----------|-------|
| Runtime | Node.js + Chromium | Rust + System WebView |
| Bundle Size | ~100-150 MB | ~5-15 MB |
| Memory Usage | ~150-200 MB | ~50-100 MB |
| Startup Time | ~2-3 seconds | ~0.5-1 second |
| Update Size | Full app (~100 MB) | Smaller differential updates |
| Security | Sandboxed renderer | Rust-based security |

### Code Changes

The TypeScript code automatically detects the runtime:

```typescript
const inTauri = '__TAURI_INTERNALS__' in window;
const inElectron = typeof window.electronAPI !== 'undefined';
```

Event listeners are registered for both platforms:

```typescript
// Tauri events
if (inTauri) {
  const { listen } = await import('@tauri-apps/api/event');
  await listen('app-focus', () => controller.resume());
  await listen('app-blur', () => controller.allNotesOff());
}

// Electron events (legacy support)
if (electronAPI) {
  electronAPI.onAppFocus?.(() => controller.resume());
  electronAPI.onAppBlur?.(() => controller.allNotesOff());
}
```

## Architecture

### Tauri Backend (`src-tauri/src/lib.rs`)

Written in Rust, handles:
- Window management
- System tray
- Event emission to frontend
- Single instance enforcement
- Platform-specific features

### Frontend Integration

The frontend uses `@tauri-apps/api` to communicate with the Rust backend:
- Event listeners for focus/blur
- No direct API calls needed for basic features
- Future commands can be added for advanced features

## Troubleshooting

### Build Fails on Linux

**Error:** "Package gdk-3.0 was not found"

**Solution:**
```bash
sudo apt install libwebkit2gtk-4.0-dev libgtk-3-dev
```

### Tauri Dev Server Won't Start

**Error:** Port 8080 already in use

**Solution:**
```bash
# Kill any process using port 8080
lsof -ti:8080 | xargs kill -9
```

### Windows Build Issues

**Error:** "MSVC not found"

**Solution:** Install [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

## Migrating Users

Users can migrate from Electron to Tauri by:

1. Uninstalling the Electron version
2. Installing the Tauri version from the new releases
3. All settings and MIDI configurations work the same way (Web MIDI API is identical)

## Future Enhancements

Potential Tauri-specific features:
- Auto-updates with smaller delta updates
- Native MIDI support (bypassing Web MIDI API limitations)
- Better performance monitoring
- Reduced memory footprint

## Keeping Electron Support

The Electron implementation remains fully functional and can still be built using:

```bash
npm run electron-dev        # Development
npm run electron-build      # Production build
```

Both can be maintained in parallel with minimal overhead.
