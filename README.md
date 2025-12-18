# kb2midi

A professional web-based MIDI controller that transforms your QWERTY keyboard into a full-featured musical instrument with real MIDI output. Available as both a web app and native desktop application for macOS, Windows, and Linux.

## Features

### Core MIDI
- **Real MIDI Output**: Send MIDI data to DAWs and music software via virtual MIDI ports
- **Multi-Channel Support**: Select any MIDI channel (1-16)
- **Velocity Control**: Adjustable note velocity (1-127)
- **Sustain Pedal**: Spacebar acts as sustain pedal (CC64)
- **Expression Controls**: Mod wheel (Arrow Up) and pitch bend (Arrow Down)

### Keyboard Layouts
- **Expanded Layout**: 2.5 octaves using full QWERTY keyboard (Z-/ base, Q-P upper)
- **Simple Layout**: 1.5 octaves focused on home row (A-L white keys)
- **Visual Piano Interface**: Interactive display with real-time feedback and octave indicators
- **Layout-Specific Octave Controls**: Arrow keys (Expanded) or Z/X (Simple)

### External Clock Sync
- **DAW Sync**: Automatically follow your DAW's tempo and transport
- **Real-time BPM Display**: Shows current tempo from external MIDI clock
- **Visual Sync Status**: Beat indicator synchronized to quarter notes
- **Smart Input Selection**: Auto-detects best clock source with manual override

### Arpeggiator
- **8 Patterns**: Up, Down, Up-Down, Down-Up, Random, Chord, Stacked Chord, Timeline
- **Clock-Synced**: Perfect timing from external MIDI clock
- **Timing Strategies**: Straight, Swing, Shuffle, Dotted feels
- **Humanization**: Timing and velocity variation for organic feel
- **Generative Features**: Accent patterns, gate probability, ratcheting (2x-4x)
- **Gate Control**: Adjustable note duration independent of step timing
- **Latch Mode**: Toggle notes on/off instead of holding keys
- **Rate Boost**: Tab key for momentary 2x speed

### Scale Filter
- **16 Scale Types**: Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian, Harmonic Minor, Melodic Minor, Pentatonic Major/Minor, Blues, Whole Tone, Diminished, Augmented, Chromatic
- **Root Note Selection**: Any of 12 chromatic notes
- **Visual Highlighting**: Scale notes highlighted on piano display
- **Note Filtering**: Non-scale notes blocked when enabled

### Input Sources
- **QWERTY Keyboard**: Default computer keyboard input
- **External MIDI**: Route notes from hardware MIDI controllers
- **Hot-Swap**: Switch between sources without stopping playback
- **Independent Routing**: Separate clock and note input selection

### Desktop App (Electron)
- **Native Performance**: Dedicated app with system integration
- **Always on Top**: Optional floating window mode
- **Power Management**: Automatic suspend/resume handling
- **Cross-Platform**: macOS (Intel/Apple Silicon), Windows, Linux

## Quick Start

### Web App
```bash
npm install
npm run dev
```
Opens at `http://localhost:8080`

### Desktop App
```bash
npm install
npm run electron-serve    # Development mode
npm run electron-preview  # Production preview
```

## Virtual MIDI Port Setup

Web browsers cannot create MIDI devices visible to other software. You must create a virtual MIDI port first.

### macOS
1. Open **Audio MIDI Setup** (Applications > Utilities)
2. Go to **Window > Show MIDI Studio**
3. Double-click **IAC Driver**
4. Check **"Device is online"**

### Windows
Download **loopMIDI** from `tobias-erichsen.de/software/loopmidi.html`:
1. Install and run loopMIDI
2. Click **"+"** to create a new virtual MIDI port
3. Name it (e.g., "kb2midi")

### Linux
```bash
sudo modprobe snd-virmidi
# Or use QjackCtl: sudo apt install qjackctl
```

## Usage

### Basic Setup
1. Create virtual MIDI port (see above)
2. Open kb2midi in browser or launch desktop app
3. Select output device in kb2midi
4. Configure your DAW to receive from the virtual port
5. Start playing!

### Clock Sync
1. Enable MIDI clock output in your DAW
2. Route clock to the virtual MIDI port
3. kb2midi auto-syncs when clock is detected
4. Green beat indicator shows sync status

### Arpeggiator
1. Click **Enable Arpeggiator**
2. Hold notes on keyboard
3. Start DAW playback - arpeggiator follows automatically
4. Adjust pattern, timing, and generative settings

### Scale Filter
1. Click **Enable Scale Filter**
2. Select root note and scale type
3. Scale notes highlight on piano
4. Non-scale notes are blocked from playback

## Keyboard Layouts

### Expanded Layout
```
Black Keys:  2 3   5 6 7   9 0        (upper octave sharps)
White Keys:  Q W E R T Y U I O P      (upper octave)
Black Keys:    S D   G H J   L ;      (base octave sharps)
White Keys:  Z X C V B N M , . /      (base octave)

Controls: Arrow Left/Right (octave), Space (sustain)
          Arrow Up (mod wheel), Arrow Down (pitch bend)
          Tab (arp rate boost)
```

### Simple Layout
```
Black Keys: W E   T Y U   O P
White Keys: A S D F G H J K L ; '
Notes:      C D E F G A B C D E F

Controls: Z/X (octave), Space (sustain)
```

## DAW Configuration

### Logic Pro / GarageBand
1. Create Software Instrument track
2. Select virtual MIDI port as input
3. Enable MIDI clock output (Preferences > MIDI > Sync)

### Ableton Live
1. Preferences > Link/Tempo/MIDI > MIDI Ports
2. Enable virtual port for Track and Sync (In/Out)

### FL Studio
1. Options > MIDI Settings
2. Enable virtual port for Input
3. Enable "Send Master Sync" to port

### Reaper
1. Options > Preferences > MIDI Devices
2. Enable virtual port
3. Enable "Send MIDI clock" output

## Browser Compatibility

- **Chrome/Chromium** - Recommended
- **Safari** - macOS
- **Edge** - Windows
- **Firefox** - Not supported (limited Web MIDI API)

## Development

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run type-check    # TypeScript validation

# Testing
npm run test          # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)

# Desktop builds
npm run electron-pack-mac-universal  # macOS DMG
npm run electron-pack-win            # Windows installer
npm run electron-pack-linux          # Linux AppImage
```

## CI and installation performance

- Skip optional binaries when you only need type-checking, tests, or web builds:

  ```bash
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  npm ci
  ```

- Cache Playwright browsers in CI for faster e2e runs:

  ```yaml
  env:
    PLAYWRIGHT_BROWSERS_PATH: ~/.cache/ms-playwright
  steps:
    - uses: actions/cache@v4
      with:
        path: ~/.cache/ms-playwright
        key: ${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}
    - run: npx playwright install --with-deps
  ```

- pnpm typically installs 2-3x faster than npm. If your environment has pnpm available, you can swap to `pnpm install` and `pnpm run build` in your local or CI workflows for quicker iterations.

## Troubleshooting

### No MIDI Output
- Verify virtual MIDI port is set up and online
- Check browser granted MIDI permissions
- Ensure DAW is receiving from correct port

### Clock Not Syncing
- Enable MIDI clock output in DAW
- Route clock to same virtual port
- Check kb2midi clock input dropdown

### Arpeggiator Not Playing
- Enable arpeggiator toggle
- Hold keys to set notes
- Start DAW playback (arpeggiator follows transport)
- Verify clock sync (green beat indicator)

### No Sound
- kb2midi sends MIDI data only, not audio
- Load a software instrument in your DAW
- Match MIDI channels between kb2midi and DAW

## License

MIT

---

**Enjoy making music with your QWERTY keyboard!**
