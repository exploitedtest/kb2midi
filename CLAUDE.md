# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

kb2midi is a TypeScript-based web MIDI controller that transforms QWERTY keyboards into professional MIDI input devices. The application supports both web browser and Electron desktop deployment, featuring advanced capabilities including arpeggiator, clock sync, and multiple keyboard layouts.

## Development Commands

### Web Development
```bash
npm run dev           # Start Vite development server on port 8080
npm run build         # TypeScript compile + Vite build to dist/
npm run preview       # Preview production build
npm run type-check    # TypeScript type checking without output
```

### Electron Desktop App
```bash
npm run electron         # Run Electron with production build
npm run electron-dev     # Run Electron in development mode
npm run electron-build   # Build Electron distributables (use EB_ARGS to customize)
npm run electron-pack    # Build universal macOS DMG
```

### Platform-Specific Packaging
```bash
npm run electron-pack-mac-arm64 # macOS Apple Silicon (arm64) DMG
npm run electron-pack-win      # Windows NSIS installer
npm run electron-pack-all      # Build for both macOS and Windows
```

### Legacy/Alternative Serving
```bash
npm start            # Vite preview mode
npm run serve        # http-server fallback for dist/
```

## Architecture

### Module Structure

The application follows a modular TypeScript architecture with clear separation of concerns:

**src/main.ts** - Main orchestrator class (`MIDIController`) that coordinates all modules and manages application lifecycle. Handles initialization, event routing, and cleanup.

**src/midi-engine.ts** - Core MIDI communication layer (`MIDIEngine`) managing Web MIDI API connections, device selection, and message sending/receiving.

**src/keyboard-input.ts** - Keyboard event handling (`KeyboardInput`) with layout-aware key mapping, special key registration, and event filtering.

**src/ui-controller.ts** - UI state management (`UIController`) handling DOM manipulation, visual feedback, and user interactions.

**src/clock-sync.ts** - External MIDI clock synchronization (`ClockSync`) for timing-critical features like arpeggiator.

**src/arpeggiator.ts** - Advanced arpeggiator engine (`Arpeggiator`) with multiple patterns, swing, gate, and clock sync.

**src/types.ts** - Complete TypeScript type definitions for MIDI messages, state objects, and interfaces.

### Key Architectural Patterns

**Event-Driven Coordination**: Main controller subscribes to events from all modules and coordinates cross-module communication.

**State Management**: Each module maintains its own state with controlled access through getter methods.

**Layout System**: Keyboard layouts are data-driven configurations supporting different key mappings and octave controls.

**MIDI Message Abstraction**: All MIDI communication goes through a typed message interface supporting note on/off, CC, pitch bend, and program change.

**Clock Sync Integration**: External MIDI clock drives arpeggiator timing and UI beat indicators.

### TypeScript Configuration

- **Module System**: ES6 modules with Vite bundling
- **Type Safety**: Strict TypeScript with comprehensive interfaces for MIDI and application state
- **Web MIDI Types**: Uses `@types/webmidi` for Web MIDI API type definitions
- **Build Target**: Modern browsers supporting Web MIDI API
- **Path Aliases**: `@/*` maps to `src/*` for cleaner imports
- **Code Style**: 2-space indentation, 100-120 char line length, avoid `any` types

### Electron Integration

- **Multi-Platform**: Supports macOS (Intel/Apple Silicon), Windows, and Linux
- **Native Features**: System suspend/resume handling, app focus/blur events
- **Power Management**: Automatic cleanup on system suspend, resume on system wake
- **Application Lifecycle**: Handles app focus/blur with MIDI state management and note panic
- **Security**: Sandboxed renderer with secure preload script for MIDI access
- **IPC Bridge**: Secure communication for system events via contextBridge

## Key Technical Details

### MIDI Note Calculation
```typescript
const midiNote = (currentOctave * 12) + noteOffset;
```
Note offsets are layout-specific mappings from keyboard keys to semitone positions within an octave.

### Keyboard Layouts
- **Expanded Layout**: 2.5 octave range using QWERTY rows (Z-/ base, Q-P upper, 2,3,5,6,7,9,0 for sharps)
- **Simple Layout**: 1.5 octave range using home row (A-L for white keys, W,E,T,Y,U,O,P for black keys)
- **Octave Controls**: Layout-specific keys for octave shifting
  - **Expanded Layout**: ArrowLeft (down), ArrowRight (up)
  - **Simple Layout**: Z (down), X (up)
- **Expression Controls**: 
  - ArrowUp: Momentary Mod Wheel (CC1) with visual feedback
  - ArrowDown: Momentary Pitch Bend Down with visual feedback
  - Space: Sustain pedal

### Arpeggiator Engine
- **Clock Sync**: Integrates with external MIDI clock for perfect timing synchronization
- **Live Parameter Integration**: Uses real-time UI values for MIDI channel and velocity
- **Resilient Timing**: Works without explicit DAW transport events, auto-starts on clock detection
- **Suspend/Resume Support**: Maintains state across application lifecycle events
- **Patterns**: Up, Down, Up-Down, Down-Up, Random, and Chord modes
- **Swing/Shuffle**: Configurable timing offset for humanized feel
- **Gate Length**: Note duration control independent of step timing

### MIDI Clock Integration
- **Input Selection**: Auto-detection of best MIDI clock source with manual override via Clock Input dropdown
- **Smart Input Prioritization**: Prefers inputs matching output device names, then common virtual MIDI devices (IAC, loopMIDI), then first available
- **Resilient Clock Detection**: Auto-starts on first MIDI clock tick (0xF8) even without explicit Start/Continue messages
- **Stop Timeout**: 500ms timeout to detect clock停止 when no more ticks received
- **Hot-plug Support**: Dynamic device list updates with automatic fallback when selected devices disconnect
- **BPM Detection**: Real-time tempo analysis from incoming MIDI clock messages
- **Beat Indicators**: Visual feedback synchronized to quarter note pulses

## Virtual MIDI Port Requirements

The Web MIDI API cannot create MIDI devices visible to other applications. Users must create virtual MIDI ports:

- **macOS**: IAC Driver in Audio MIDI Setup
- **Windows**: loopMIDI, MIDI-OX with MIDI Yoke, or built-in Windows 11 options
- **Linux**: ALSA virtual MIDI (`snd-virmidi`) or QjackCtl

## Application Lifecycle Management

### Suspend/Resume System
- **Web Browser**: Handles page visibility changes, focus/blur events, and bfcache navigation
- **Electron Desktop**: Integrates with system power management and application focus events
- **Cleanup Process**: Stops all notes, clears MIDI connections, removes event listeners, resets controllers
- **Resume Process**: Reinitializes MIDI connections, reattaches event handlers, refreshes device lists, restores UI state
- **Safety Measures**: All-notes-off, sustain pedal reset, mod wheel/pitch bend reset on blur/suspend

### Device Hot-Plug Support
- **Dynamic Discovery**: Automatically detects new MIDI devices and removes disconnected ones
- **Smart Fallback**: Auto-switches to best available device when selected device disconnects
- **UI Synchronization**: Updates device dropdowns in real-time without user intervention

## Testing Approach

No formal test framework is configured. Testing is performed by:
1. **Web Testing**: `npm run dev` + virtual MIDI port connection, verify note on/off, sustain, octave controls, arpeggiator, and clock sync
2. **Electron Testing**: `npm run electron-dev`, confirm window behavior, "Always on Top" functionality, and MIDI access
3. **MIDI Verification**: Use DAW software or MIDI monitor applications to validate output
4. **Console Monitoring**: Check browser/Electron console for errors during testing
5. **Cross-platform testing**: macOS, Windows, and Linux compatibility
6. **Browser compatibility**: Chrome, Safari, Edge (Firefox not supported)
7. **Power management**: Suspend/resume, focus/blur scenarios
8. **Device hot-plug**: Connect/disconnect during operation

## Build System

- **Vite**: Modern build tool with TypeScript support and hot reloading
- **Development Server**: Port 8080 (aligned between Vite and Electron dev mode)
- **Electron Builder**: Cross-platform desktop app packaging with code signing support
- **Universal Binaries**: macOS builds support both Intel and Apple Silicon architectures
- **Source Maps**: Generated for debugging production builds
- **Output Directories**: `dist/` for web builds, `release/` for packaged desktop apps
- **Type Checking**: Run `npm run type-check` before commits to ensure strict TypeScript compliance

## Browser Compatibility

- **Supported**: Chrome, Safari, Edge (Web MIDI API required)
- **Not Supported**: Firefox (limited Web MIDI API implementation)
- **Mobile**: Limited support due to Web MIDI API availability
