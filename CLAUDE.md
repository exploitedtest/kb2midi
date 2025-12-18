# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

kb2midi is a TypeScript-based web MIDI controller that transforms QWERTY keyboards into professional MIDI input devices. The application supports both web browser and Electron desktop deployment, featuring advanced capabilities including arpeggiator, clock sync, scale filtering, external MIDI input routing, and multiple keyboard layouts.

## Cloud/CI Quick Start

**Lightweight setup** — skips ~300MB of Electron/Playwright binaries:

```bash
npm run setup         # Fast install WITHOUT binaries (~5s vs ~60s)
npm run type-check    # Verify TypeScript compiles
npm run build         # Full production build
npm run test          # Unit tests (no browser binaries needed)
```

**Full install** (when you need Electron or E2E tests):
```bash
npm install                    # Includes Electron binary
npx playwright install         # Download Playwright browsers
npm run test:e2e               # E2E tests
npm run electron-serve         # Launch Electron app
```

### Day-1 Checklist

1. `npm run setup` — lightweight install
2. `git fetch origin && git merge origin/main` — sync before edits
3. `npm run type-check` — verify compilation
4. `npm run test` — run unit tests
5. `npm run dev` — start dev server on :8080 (if needed)

### Quick File Reference

| Path | Purpose |
|------|---------|
| `src/main.ts` | Bootstraps `MIDIController`, wires all modules |
| `src/midi-engine.ts` | Web MIDI access, port selection, note/CC send/receive |
| `src/keyboard-input.ts` | QWERTY mapping, latch mode, layout hotkeys |
| `src/arpeggiator.ts` | Patterns, swing/shuffle, ratcheting, humanization |
| `src/clock-sync.ts` | External MIDI clock handling, BPM events |
| `src/scale-filter.ts` | Scale definitions, filtering, piano highlighting |
| `src/ui-controller.ts` | DOM wiring, visual feedback, state binding |
| `tests/mocks/web-midi.mock.ts` | MIDI mock for unit tests |

### Workflow Priorities

1. **User-facing correctness**: MIDI stability, arpeggiator timing, UI feedback
2. **Bugs** affecting MIDI accuracy, latency, or state consistency
3. **Packaging/tooling** after core fixes

### Troubleshooting Quick Reference

| Symptom | Check |
|---------|-------|
| No MIDI ports | Create virtual MIDI port (IAC/loopMIDI), grant browser permissions |
| Clock not syncing | Route DAW clock to selected clock port, verify in-app selector |
| Arpeggiator silent | Enable toggle, hold notes, confirm clock running + beat indicator |
| No sound | kb2midi outputs MIDI only—load instrument in DAW, match channels |

## Development Commands

### Web Development
```bash
npm run dev           # Start Vite development server on port 8080
npm run build         # TypeScript compile + Vite build to dist/
npm run preview       # Preview production build
npm run type-check    # TypeScript type checking without output
```

## Fast Iterations on Cloud Runners

- Skip optional binaries when they are not needed for verification: set `SKIP_ELECTRON_DOWNLOAD=1` and
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` before installs.
- For documentation-only or lint-only edits, run `npm ci --ignore-scripts` to avoid heavyweight postinstall steps.
- Keep installs local to the repo (no global npm installs) to ensure reproducible environments and avoid bloat.

### Testing
```bash
# Unit Tests (Vitest)
npm run test              # Run unit tests once
npm run test:watch        # Run unit tests in watch mode
npm run test:ui           # Run tests with Vitest UI
npm run test:coverage     # Run tests with code coverage

# E2E Tests (Playwright)
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Run E2E tests with Playwright UI
npm run test:e2e:headed   # Run E2E tests in headed mode (visible browser)
npm run test:e2e:debug    # Run E2E tests in debug mode
npm run test:e2e:chromium # Run E2E tests on Chromium only
npm run test:e2e:webkit   # Run E2E tests on WebKit only
npm run test:e2e:electron # Run E2E tests for Electron

# All Tests
npm run test:all          # Run both unit and E2E tests
```

### Electron Desktop App
```bash
npm run electron              # Run Electron with production build
npm run electron-dev          # Run Electron in development mode
npm run electron-serve        # Start dev server + Electron (recommended for development)
npm run electron-serve-devtools  # Same as above with DevTools auto-open
npm run electron-preview      # Build and preview in Electron
npm run electron-build        # Build Electron distributables (use EB_ARGS to customize)
```

### Platform-Specific Packaging
```bash
npm run electron-pack-mac-universal  # macOS Universal (Intel + Apple Silicon) DMG
npm run electron-pack-mac-arm64      # macOS Apple Silicon (arm64) DMG
npm run electron-pack-win            # Windows NSIS installer
npm run electron-pack-linux          # Linux AppImage
npm run electron-pack-all            # Build for all platforms
npm run electron-pack-mas            # Mac App Store (universal)
npm run electron-pack-mas-arm64      # Mac App Store (arm64)
```

### Legacy/Alternative Serving
```bash
npm start            # Build + Vite preview mode
npm run serve        # Build + http-server fallback for dist/
```

## Architecture

### Module Structure

The application follows a modular TypeScript architecture with clear separation of concerns:

**src/main.ts** - Main orchestrator class (`MIDIController`) that coordinates all modules and manages application lifecycle. Handles initialization, event routing, and cleanup.

**src/midi-engine.ts** - Core MIDI communication layer (`MIDIEngine`) managing Web MIDI API connections, device selection, and message sending/receiving. Supports both clock input and separate note input devices.

**src/keyboard-input.ts** - Keyboard event handling (`KeyboardInput`) with layout-aware key mapping, special key registration, latch mode, and event filtering.

**src/ui-controller.ts** - UI state management (`UIController`) handling DOM manipulation, visual feedback, scale highlighting, and user interactions.

**src/clock-sync.ts** - External MIDI clock synchronization (`ClockSync`) for timing-critical features like arpeggiator.

**src/arpeggiator.ts** - Advanced arpeggiator engine (`Arpeggiator`) with multiple patterns, timing strategies, generative features, and clock sync.

**src/scale-filter.ts** - Scale filtering system (`ScaleFilter`) providing musical scale definitions, note validation, and scale-aware input filtering.

**src/types.ts** - Complete TypeScript type definitions for MIDI messages, state objects, and interfaces.

### Test Infrastructure

**tests/setup.ts** - Vitest setup file that installs the Web MIDI API mock and configures test environment globals.

**tests/mocks/web-midi.mock.ts** - Comprehensive mock implementation of the Web MIDI API including:
- `MockMIDIInput` / `MockMIDIOutput` - Mock MIDI port classes
- `MockMIDIAccess` - Mock MIDI access object with device management
- Helper methods for simulating MIDI messages (clock ticks, note events)

**tests/unit/** - Unit tests for individual modules:
- `arpeggiator.test.ts` - Arpeggiator patterns and timing tests
- `clock-sync.test.ts` - Clock synchronization tests
- `keyboard-input.test.ts` - Keyboard input handling tests
- `midi-engine.test.ts` - MIDI engine functionality tests
- `external-midi-input.test.ts` - External MIDI input routing tests

**tests/e2e/** - End-to-end tests:
- `web-app.test.ts` - Browser-based E2E tests
- `electron.test.ts` - Electron application E2E tests

### Electron Files

**electron/main.cjs** - Electron main process handling window creation, system events, and IPC.

**electron/preload.cjs** - Preload script providing secure contextBridge for renderer-to-main communication.

### Key Architectural Patterns

**Event-Driven Coordination**: Main controller subscribes to events from all modules and coordinates cross-module communication.

**State Management**: Each module maintains its own state with controlled access through getter methods.

**Layout System**: Keyboard layouts are data-driven configurations supporting different key mappings and octave controls.

**MIDI Message Abstraction**: All MIDI communication goes through a typed message interface supporting note on/off, CC, pitch bend, and program change.

**Clock Sync Integration**: External MIDI clock drives arpeggiator timing and UI beat indicators.

**Input Source Separation**: Note input (keyboard or external MIDI) is independent from clock input, allowing flexible routing configurations.

### TypeScript Configuration

- **Module System**: ES6 modules with Vite bundling
- **Type Safety**: Strict TypeScript with comprehensive interfaces for MIDI and application state
- **Web MIDI Types**: Uses `@types/webmidi` for Web MIDI API type definitions
- **Build Target**: Modern browsers supporting Web MIDI API
- **Path Aliases**: `@/*` maps to `src/*` for cleaner imports
- **Code Style**: 2-space indentation, 100-120 char line length, avoid `any` types
- **Strict Null Checks**: Enabled along with all strict mode options

### Electron Integration

- **Multi-Platform**: Supports macOS (Intel/Apple Silicon/Universal), Windows, and Linux
- **Native Features**: System suspend/resume handling, app focus/blur events
- **Power Management**: Automatic cleanup on system suspend, resume on system wake
- **Application Lifecycle**: Handles app focus/blur with MIDI state management and note panic
- **Security**: Sandboxed renderer with secure preload script for MIDI access
- **IPC Bridge**: Secure communication for system events via contextBridge
- **Mac App Store**: MAS build support with proper entitlements

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
  - Tab: Momentary arpeggiator rate boost (2x)

### Note Input Sources
- **QWERTY Keyboard**: Default input using computer keyboard
- **External MIDI**: Route notes from external MIDI controllers
- **Independent Routing**: Note input separate from clock input for flexible setups
- **Hot-swap**: Switch between sources without stopping playback

### Scale Filter
- **16 Scale Types**: Chromatic, Major/Minor modes, Pentatonic, Blues, Whole Tone, Diminished, Augmented
- **Root Note Selection**: Any of 12 chromatic notes as scale root
- **Visual Highlighting**: Scale notes highlighted on piano display
- **Note Filtering**: Non-scale notes blocked from playback when enabled
- **Integration**: Works with both keyboard and arpeggiator

### Arpeggiator Engine
- **Clock Sync**: Integrates with external MIDI clock for perfect timing synchronization
- **Live Parameter Integration**: Uses real-time UI values for MIDI channel and velocity
- **Resilient Timing**: Works without explicit DAW transport events, auto-starts on clock detection
- **Suspend/Resume Support**: Maintains state across application lifecycle events
- **Patterns**: Up, Down, Up-Down, Down-Up, Random, Chord, Stacked Chord, and Timeline modes
- **Timing Strategies**: Modular timing system supporting straight, swing, shuffle, dotted, and humanize feels
  - **Straight**: Mechanical precision (default)
  - **Swing**: Classic swing feel (delays offbeats by up to 50%)
  - **Shuffle**: Triplet feel (delays offbeats to 66.67% position)
  - **Dotted**: Dotted eighth feel (delays offbeats to 75% position)
  - **Humanize**: Tempo-adaptive random variation (±15ms @ 120 BPM, scales with tempo)
  - **Layered Timing**: Combine multiple strategies (e.g., swing + humanize for groovy but loose feel)
- **Gate Length**: Note duration control independent of step timing (minimum 5ms safety)
- **Velocity Humanization**: Random ±10 velocity unit variation per step for organic feel
- **Accent Patterns**: Velocity emphasis on specific beats (downbeats, offbeats, every 3rd)
- **Gate Probability**: Generative note skipping (0-100%) for sparse, evolving patterns
- **Ratcheting**: Note subdivision and repeat (2x, 3x, 4x) within each step
- **Latch Mode**: Toggle notes on/off instead of hold (available globally, not just arpeggiator)

### MIDI Clock Integration
- **Input Selection**: Auto-detection of best MIDI clock source with manual override via Clock Input dropdown
- **Smart Input Prioritization**: Prefers inputs matching output device names, then common virtual MIDI devices (IAC, loopMIDI), then first available
- **Resilient Clock Detection**: Auto-starts on first MIDI clock tick (0xF8) even without explicit Start/Continue messages
- **Stop Timeout**: 500ms timeout to detect clock stop when no more ticks received
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
- **Note Input Fallback**: Reverts to keyboard mode if external MIDI device disconnects

### Arpeggiator Timing Implementation

The timing system uses a simple strategy pattern with `setTimeout` scheduling:

**Architecture:**
- **TimingStrategy Interface**: Single method `getDelayOffset(globalStep, baseStepMs)` returns timing offset in milliseconds
- **Global Step Counter**: Tracks absolute step position for patterns that need it (swing delays odd steps)
- **setTimeout Integration**: Offsets applied via `setTimeout` for simplicity and browser optimization
- **No Custom Scheduler**: Uses browser's native `setTimeout` (already optimized for timing precision)
- **No Object Pooling**: Allocating 4-16 events/second is trivial for modern JavaScript GC

**Generative Features:**
- **VelocityHumanize**: Seeded PRNG applies consistent ±10 velocity variation per step
- **AccentPattern**: Pattern-based velocity multipliers (1.25x for accented beats)
- **GateProbability**: Seeded random note skipping for repeatable generative patterns
- **Tempo-Adaptive Humanization**: Scales timing variation with tempo (reference: 125ms @ 120 BPM)
- **Ratcheting**: Note subdivision using nested `setTimeout` calls (90% gate limit to prevent overlap)

**Implementation Principles:**
- Keep it simple: ~730 LOC for all timing + generative features vs complex alternatives
- Use proven patterns: `setTimeout` + `Map` tracking (reliable, debuggable)
- Strategy pattern enables extensibility (easy to add new timing types)
- Layered timing via simple addition of offsets (musically correct)
- Seeded randomization ensures repeatable patterns across sessions

**Why This Approach:**
- MIDI needs ~1ms precision; `setTimeout` easily achieves this
- Browser highly optimizes `setTimeout` for timing-critical tasks
- Simple code = fewer bugs, easier maintenance
- No premature optimization (no measurable benefit from complex scheduling)
- Seeded PRNG allows creative repeatability (change seed for variation)

## Testing

### Test Framework Stack
- **Unit Tests**: Vitest with jsdom environment
- **E2E Tests**: Playwright for cross-browser and Electron testing
- **Mocking**: Comprehensive Web MIDI API mock for unit tests
- **Coverage**: V8 coverage provider with text, JSON, and HTML reporters

### Writing Tests

**Unit Tests**: Place in `tests/unit/` directory with `.test.ts` extension
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupWebMIDIMock, MockMIDIAccess } from '../mocks/web-midi.mock';

describe('Feature', () => {
  let mockAccess: MockMIDIAccess;

  beforeEach(async () => {
    mockAccess = setupWebMIDIMock();
    // Setup code
  });

  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

**E2E Tests**: Place in `tests/e2e/` directory
```typescript
import { test, expect } from '@playwright/test';

test('feature works', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#element')).toBeVisible();
});
```

### Web MIDI Mock Usage
```typescript
import { setupWebMIDIMock, MockMIDIAccess, MockMIDIInput } from '../mocks/web-midi.mock';

// Setup mock
const mockAccess = setupWebMIDIMock();

// Add/remove mock devices
mockAccess.addInput('id', 'Device Name', 'Manufacturer');
mockAccess.removeInput('id');

// Simulate MIDI messages
const input = mockAccess.inputs.get('mock-input-1') as MockMIDIInput;
input.simulateClockTick();     // 0xF8
input.simulateClockStart();    // 0xFA
input.simulateClockStop();     // 0xFC
input.simulateMessage([0x90, 60, 100]); // Note on C4

// Check output messages
const output = mockAccess.outputs.get('mock-output-1') as MockMIDIOutput;
output.getSentMessages();      // Array of sent MIDI messages
output.wasMessageSent([0x90, 60, 100]); // Check specific message
```

### Testing Best Practices
1. **Isolate tests**: Each test should be independent and not rely on state from other tests
2. **Mock external dependencies**: Use the provided Web MIDI mock for MIDI-related tests
3. **Test behavior, not implementation**: Focus on what the code does, not how it does it
4. **Use descriptive test names**: Clearly describe what is being tested
5. **Run tests before committing**: Use `npm run test` and `npm run test:e2e` to validate changes

## Build System

- **Vite**: Modern build tool with TypeScript support and hot reloading
- **Development Server**: Port 8080 (aligned between Vite and Electron dev mode)
- **Electron Builder**: Cross-platform desktop app packaging with code signing support
- **Universal Binaries**: macOS builds support both Intel and Apple Silicon architectures
- **Source Maps**: Generated for debugging production builds
- **Output Directories**: `dist/` for web builds, `release/` for packaged desktop apps, `test-results/` for test reports
- **Type Checking**: Run `npm run type-check` before commits to ensure strict TypeScript compliance

## Browser Compatibility

- **Supported**: Chrome, Safari, Edge (Web MIDI API required)
- **Not Supported**: Firefox (limited Web MIDI API implementation)
- **Mobile**: Limited support due to Web MIDI API availability

## Code Conventions

### File Organization
- Source files in `src/` with one class per file
- Test files mirror source structure in `tests/`
- Electron-specific code in `electron/`
- Build configuration files in project root

### Naming Conventions
- **Files**: kebab-case (`midi-engine.ts`, `clock-sync.ts`)
- **Classes**: PascalCase (`MIDIController`, `ClockSync`)
- **Interfaces**: PascalCase with descriptive names (`ControllerState`, `MIDIMessage`)
- **Methods/Functions**: camelCase (`playNote`, `handleClockInputSelect`)
- **Constants**: UPPER_SNAKE_CASE (`MIDI_NOTE_ON`, `MIDI_SUSTAIN_PEDAL`)

### TypeScript Guidelines
- Avoid `any` types - use proper typing or `unknown` with type guards
- Export interfaces from `types.ts` for shared types
- Use strict null checks - handle `null` and `undefined` explicitly
- Prefer `const` over `let`, avoid `var`
- Use optional chaining (`?.`) and nullish coalescing (`??`) where appropriate
