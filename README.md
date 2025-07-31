# QWERTY MIDI Controller

A web-based MIDI controller that turns your QWERTY keyboard into a piano keyboard with real MIDI output for macOS, Windows, and Linux. Now with **external MIDI clock sync** and **arpeggiator** support!

## Features

- **Real MIDI Output**: Sends MIDI data to other software on your computer
- **External Clock Sync**: Syncs to your DAW's MIDI clock for perfect timing
- **Arpeggiator**: Automatic arpeggio patterns synced to external clock
- **Two Layout Options**: Choose between Simple (1.5 octaves) and Expanded (2.5 octaves) layouts
- **Visual Piano Interface**: Interactive piano with real-time feedback and octave numbers
- **Layout-Specific Octave Controls**: Z/X (Simple) or left/right (Expanded)
- **Sustain Pedal**: Spacebar acts as sustain pedal
- **Velocity Control**: Adjustable note velocity (1-127)
- **Multi-Channel Support**: Select any MIDI channel (1-16)
- **Dynamic Piano Display**: Visual keyboard adapts to show available note range
- **Cross-Platform**: Works on macOS, Windows 11, and Linux

## Clock Sync Features

### External MIDI Clock Sync
- **Syncs to DAW**: Automatically follows your DAW's tempo and transport
- **Real-time BPM display**: Shows current BPM from external clock
- **Visual sync status**: Green indicator when synced, red when stopped
- **No drift**: Perfect timing from your DAW's master clock

### Arpeggiator
- **External clock sync**: Arpeggiator follows DAW tempo automatically
- **Multiple patterns**: Up, down, up-down, down-up, random, chord
- **Hold notes**: Press and hold keys to create arpeggio patterns
- **Visual feedback**: Piano keys light up as arpeggiator plays
- **Automatic start/stop**: Follows DAW transport controls

## Quick Setup

### Option 1: Using npm (Recommended)
```bash
# Clone or download the files
# Navigate to the project folder
npm install
npm start
```
This will automatically open `http://localhost:8080` in your browser.

### Option 2: Using Python (if you have Python installed)
```bash
# Navigate to the project folder
python3 -m http.server 8080
# Then open http://localhost:8080 in your browser
```

### Option 3: Manual Setup
1. Save `package.json`, `index.html`, `styles.css`, and `midi-controller.js` in a folder
2. Install a local web server (like `http-server`)
3. Run the server and open the page

## Virtual MIDI Port Setup

**⚠️ Important:** Web browsers can't create MIDI devices that other software can see. You need to create a virtual MIDI port first.

### macOS (Sonoma/Ventura/Monterey/Big Sur):
1. Open **Audio MIDI Setup** (Applications > Utilities > Audio MIDI Setup)
2. Go to **Window > Show MIDI Studio**
3. Double-click the **IAC Driver** icon
4. Check **"Device is online"**
5. You should see "Bus 1" - this creates a virtual MIDI port
6. Optionally, click the **+** to add more ports or rename them

### Windows 11:

**Option A - loopMIDI (Recommended):**
1. Download **loopMIDI** from `tobias-erichsen.de/software/loopmidi.html`
2. Install and run loopMIDI
3. Click the **"+"** button to create a new virtual MIDI port
4. Name it something like "QWERTY Controller"
5. The port will appear in your DAW's MIDI inputs

**Option B - MIDI-OX + MIDI Yoke:**
1. Download **MIDI Yoke** from `midiox.com`
2. Install MIDI Yoke (creates virtual MIDI cables)
3. Download and install **MIDI-OX**
4. Use "Out To MIDI Yoke: 1" as your virtual port

**Option C - Built-in (Windows 11 22H2+):**
1. Go to **Settings > Bluetooth & devices > More devices and printer settings**
2. Right-click and select **"Add a device"**
3. Look for MIDI device options (availability varies)

### Linux (Ubuntu/Debian):
1. Install ALSA utilities: `sudo apt install alsa-utils`
2. Create virtual MIDI port: `sudo modprobe snd-virmidi`
3. Or use **QjackCtl** for more advanced MIDI routing
4. Install via: `sudo apt install qjackctl`

## Usage

### Step 1: Connect MIDI
1. **Set up virtual MIDI port** (see above)
2. **Open the controller** in a modern browser (Chrome/Safari recommended)
3. **Click "Connect MIDI"** to enable MIDI output
4. **Grant MIDI permissions** when prompted

### Step 2: Enable Clock Sync
1. **In your DAW**: Enable MIDI clock output to the virtual MIDI port
2. **Press play in DAW**: Controller automatically syncs to DAW tempo
3. **Check status**: Green indicator shows "Synced to DAW (120 BPM)"

### Step 3: Use Arpeggiator
1. **Enable arpeggiator**: Click "Enable Arpeggiator" button
2. **Hold notes**: Press and hold keys on your keyboard
3. **Press play in DAW**: Arpeggiator starts automatically
4. **Watch visual feedback**: Piano keys light up as arpeggiator plays

### Step 4: Choose Layout

#### Simple Layout (Default with Z/X octave control)
- **Range:** 1.5 octaves (19 keys total)
- **White keys:** A S D F G H J K L ; ' (C through F)
- **Black keys:** W E T Y U O P ] (C# through F#)
- **Octave:** Z (down) / X (up)
- **Perfect for:** Beginners, focused single-octave work

#### Expanded Layout (with -/= octave control)
- **Range:** 2.5 octaves (29 keys total)
- **Bottom row:** Z-/ (base octave)
- **Top row:** Q-P (upper octave)
- **Black keys:** Number row (2 3 5 6 7 9 0) + S D G H J L ;
- **Octave:** - (down) / = (up)
- **Perfect for:** Complex melodies, chord progressions

### Step 5: Connect to Your DAW

**Logic Pro/GarageBand:**
1. Create new Software Instrument track
2. Select the virtual MIDI port as input
3. Enable MIDI clock output to the same port
4. Start playing!

**Ableton Live:**
1. Go to Preferences > Link/Tempo/MIDI > MIDI Ports
2. Enable the virtual port for both input and output
3. Create MIDI track and select the port
4. Enable "Clock" output for the virtual port

**FL Studio:**
1. Options > MIDI Settings
2. Enable the virtual MIDI port in Input
3. Enable "Send Master Sync" to the virtual port
4. Create instrument and start playing

**Reaper:**
1. Options > Preferences > MIDI Devices
2. Enable the virtual port
3. Enable "Send MIDI clock" to the virtual port
4. Create track with MIDI input

## Clock Sync Setup

### DAW Configuration
1. **Enable MIDI Clock Output** in your DAW's MIDI preferences
2. **Route clock to virtual MIDI port** (same port used for controller input)
3. **Press play in DAW** - controller automatically syncs

### Controller Usage
1. **Press keys** to set arpeggiator notes
2. **Press play in DAW** - arpeggiator starts automatically
3. **Change DAW tempo** - arpeggiator follows automatically
4. **Stop DAW** - arpeggiator stops automatically

## Keyboard Layouts

### Simple Layout Mapping:
```
Black Keys: W E   T Y U   O P ]
White Keys: A S D F G H J K L ; '
Notes:      C D E F G A B C D E F
Octave:     Z (down)  X (up)  SPACE (sustain)
```

### Expanded Layout Mapping:
```
Numbers:    2 3   5 6 7   9 0     (C5 octave sharps)
QWERTY:     Q W E R T Y U I O P   (C5 octave)
ASDF:       S D   G H J   L ;     (C4 octave sharps)  
ZXCV:       Z X C V B N M , . /   (C4 octave)
Controls:   - (oct down)  = (oct up)  SPACE (sustain)
```

## File Structure

- **index.html** - Main HTML structure and setup instructions
- **styles.css** - All CSS styling and visual design
- **src/main.ts** - Main controller and application logic
- **src/midi-engine.ts** - MIDI communication and clock sync
- **src/clock-sync.ts** - External MIDI clock synchronization
- **src/arpeggiator.ts** - Arpeggiator engine with clock sync
- **src/keyboard-input.ts** - Keyboard input handling
- **src/ui-controller.ts** - User interface management
- **src/types.ts** - TypeScript type definitions
- **package.json** - npm configuration and dependencies

## Troubleshooting

### MIDI Not Working
- Make sure you clicked "Connect MIDI" and granted permissions
- Try refreshing the page and reconnecting
- Ensure your browser supports Web MIDI API (Chrome/Edge work best)
- Check if your DAW is set to receive MIDI from the virtual port

### Clock Sync Not Working
- **Enable MIDI clock output** in your DAW's MIDI preferences
- **Route clock to the same virtual port** used for controller input
- **Check DAW documentation** for MIDI clock output settings
- **Verify virtual MIDI port** is properly set up for both input and output

### Arpeggiator Not Working
- **Enable arpeggiator** by clicking the toggle button
- **Hold down keys** to set arpeggiator notes
- **Press play in DAW** to start the arpeggiator
- **Check clock sync status** - should show green "Synced to DAW"

### No Sound
- The controller only sends MIDI data, not audio
- Make sure your DAW has a software instrument loaded
- Check that the MIDI channel matches between controller and DAW
- Verify the virtual MIDI port is properly set up

### Piano Not Drawing
- The page automatically toggles layouts on load to ensure proper initialization
- If issues persist, manually switch layouts once

## Browser Compatibility

- ✅ **Chrome/Chromium** (Recommended)
- ✅ **Safari** (macOS)
- ✅ **Edge**
- ❌ **Firefox** (Limited MIDI support)

## Technical Notes

- Uses Web MIDI API for real MIDI output
- **External clock sync** - follows DAW timing, no internal drift
- **Arpeggiator syncs to external clock** - perfect timing from DAW
- Optimized for macOS, Windows, and Linux
- Prevents key repeat for smooth playing
- All notes stop when window loses focus (safety feature)
- Console logging shows MIDI messages for debugging
- Dynamic piano keyboard adjusts range based on selected layout
- Layout-specific octave controls for intuitive operation

## Development

To modify the controller:
1. Edit files as needed:
   - `index.html` for structure
   - `styles.css` for styling  
   - `src/*.ts` for functionality
2. Use `npm run dev` for development with auto-refresh
3. Check browser console for MIDI debug messages

## Key Features Summary

- **🎹 Dual Layouts**: Simple (19 keys) and Expanded (29 keys)
- **🎵 Real MIDI**: True MIDI output to DAWs and music software
- **⏰ External Clock Sync**: Perfect timing from DAW master clock
- **🎼 Arpeggiator**: Automatic patterns synced to external clock
- **⌨️ Smart Controls**: Layout-specific octave controls (Z/X or -/=)
- **📱 Cross-Platform**: Works on macOS, Windows 11, and Linux
- **🎚️ Professional**: Velocity control, sustain pedal, 16 MIDI channels
- **👁️ Visual**: Dynamic piano display with octave numbers
- **🔧 Easy Setup**: Comprehensive setup instructions for all platforms

---

**Enjoy making music with your QWERTY keyboard! 🎹**

### **Key Application Points for Debugging:**

1. **MIDI Connection Issues**
   ```typescript
   // Set breakpoint in midi-engine.ts
   async initialize(): Promise<boolean> {
     // Debug MIDI access here
   }
   ```

2. **Keyboard Input Issues**
   ```typescript
   // Set breakpoint in keyboard-input.ts
   private handleKeyDown(event: KeyboardEvent): void {
     // Debug key events here
   }
   ```

3. **UI State Issues**
   ```typescript
   // Set breakpoint in ui-controller.ts
   updatePianoKey(note: number, active: boolean): void {
     // Debug piano key updates here
   }
   ```

4. **Main Controller Logic**
   ```typescript
   // Set breakpoint in main.ts
   private playNote(note: number, velocityOverride?: number): void {
     // Debug note playing logic here
   }
   ```

### **Useful Debug Configurations:**

- **Chrome**: Best for general debugging
- **Firefox**: Good for Web MIDI API testing
- **Edge**: Alternative browser debugging
- **Attach**: Connect to existing browser session

The debugger configuration includes source maps support, so you can debug your TypeScript code directly even though it's compiled to JavaScript by Vite. This makes debugging much more intuitive! 🐛✨
