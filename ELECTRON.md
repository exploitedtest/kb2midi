# kb2midi - 2.5 octave QWERTY keyboard MIDI controller

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

## Mac App Store (MAS) Versioning

- CFBundleVersion is tied to `package.json` `version` via electron-builder (`bundleVersion: ${version}`).
- For every MAS upload, bump `package.json` `version` so it increases (e.g., 2.0.1 → 2.0.2).
- Use numeric dot-separated versions (e.g., `2.1.0`); avoid pre-release tags when submitting to MAS.
- Build commands:
  - Universal MAS: `npm run electron-pack-mas`
  - Apple Silicon only MAS: `npm run electron-pack-mas-arm64`
- These scripts set `MAS=1`, build the web app, and output artifacts to `release/`.

## Notarization (non‑MAS builds)

- Purpose: Required by Gatekeeper for apps distributed outside the Mac App Store.
- Scope: Applies to `dmg/zip` targets (e.g., `electron-pack-mac-arm64`, `electron-pack-mac-universal`). MAS builds are not notarized.

Prerequisites
- Apple Developer account and Team ID.
- "Developer ID Application" certificate in your login Keychain.
- Entitlements are already configured (`build/entitlements.mac.plist`, hardened runtime enabled).

Credentials (recommended: App Store Connect API key)
- Set environment variables before running the pack script:
  - `APPLE_API_KEY_ID=ABC123DEFG`
  - `APPLE_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
  - `APPLE_API_KEY=/absolute/path/to/AuthKey_ABC123DEFG.p8`
- Alternative (Apple ID + app-specific password):
  - `APPLE_ID=you@example.com`
  - `APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx` (app-specific)
  - `APPLE_TEAM_ID=TEAMID`

Build and notarize
- `package.json` enables notarization via `mac.notarize: true`.
- Run one of:
  - `npm run electron-pack-mac-arm64`
  - `npm run electron-pack-mac-universal`
- electron-builder signs, uploads for notarization, and staples the result to the artifact.

Verify
- Validate staple: `xcrun stapler validate release/<your-dmg>.dmg`
- Gatekeeper check: `spctl -a -vvv release/<your-dmg>.dmg` (should say "accepted").

Tips
- Keep the `.p8` API key file outside the repo and out of version control.
- If notarization fails with hardened runtime errors, ensure `"hardenedRuntime": true` and correct entitlements.

## Troubleshooting

### Development Issues
- Make sure Vite dev server is running on port 8081
- Check console for any errors
- Use `Cmd+Option+I` to open DevTools

### Build Issues
- Ensure all dependencies are installed
- Check that the `dist` directory exists after build
- Verify icon files are in the correct format 
