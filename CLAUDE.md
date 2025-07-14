# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a professional web-based QWERTY keyboard MIDI controller that transforms your computer keyboard into a high-quality MIDI input device for DAWs and music production software. Built to be a reliable, expressive controller with advanced features rivaling hardware controllers.

## Development Commands

### Start Development Server
```bash
npm run dev
```
- Starts http-server on port 8080 with live reload (cache disabled)
- Automatically opens in browser

### Start Production Server
```bash
npm start
```
- Starts http-server on port 8080
- Opens in browser

### Alternative Local Server
```bash
python3 -m http.server 8080
```
- Use if npm is not available

## Architecture

### Core Components

**index.html** - Main HTML structure containing:
- Control interface (velocity, MIDI channel, layout selection)
- Piano visual interface container
- Keyboard mapping display
- Setup instructions for virtual MIDI ports

**midi-controller.js** - Complete JavaScript functionality:
- MIDI state management and Web MIDI API integration
- Two keyboard layouts: Simple (19 keys) and Expanded (29 keys)
- Key mapping systems for both layouts
- Piano UI generation and visual feedback
- Event handling for keyboard and mouse input
- Octave control and sustain pedal functionality

**styles.css** - Visual styling:
- Gradient background and glass-morphism effects
- Piano key styling (white/black keys with active states)
- Keyboard mapping visualization
- Responsive control layout

### Key Architecture Patterns

**Layout System**: Two distinct keyboard layouts with different key mappings:
- Simple layout: Uses Z/X for octave control, covers 1.5 octaves
- Expanded layout: Uses -/= for octave control, covers 2.5 octaves

**MIDI Integration**: 
- Uses Web MIDI API for real MIDI output
- Automatic virtual MIDI port detection (prioritizes IAC Driver on macOS)
- MIDI channel selection (1-16) and velocity control

**State Management**:
- Active notes tracking to prevent duplicate note triggers
- Pressed keys tracking for keyboard repeat prevention
- Current octave and layout state

## Key Technical Details

### MIDI Note Calculation
Notes are calculated as: `(currentOctave * 12) + noteValue`
- Each octave spans 12 semitones
- Note values are offsets within the octave (C=0, C#=1, D=2, etc.)

### Layout-Specific Controls
- Simple layout: Z (octave down), X (octave up) 
- Expanded layout: - (octave down), = (octave up)
- Both layouts: Space (sustain pedal)

### Browser Compatibility
- Requires Web MIDI API support (Chrome/Safari/Edge)
- Does NOT work in Firefox due to limited MIDI support

## Common Development Tasks

### Adding New Keyboard Layout
1. Define new key mapping object in `midi-controller.js`
2. Add layout option to `switchLayout()` function
3. Create corresponding UI generation function
4. Update keyboard mapping display function

### Modifying Piano Range
- Adjust `createSimplePiano()` or `createExpandedPiano()` functions
- Update key positioning arrays for black keys
- Modify note calculation arrays

### MIDI Functionality Changes
- MIDI sending logic is centralized in `sendMIDI()` function
- Note on/off handled by `playNote()` and `stopNote()`
- Sustain pedal controlled via `handleSustainOn()/handleSustainOff()`

## Virtual MIDI Port Setup

The application requires a virtual MIDI port for output since browsers cannot create MIDI devices directly:

**macOS**: Use IAC Driver in Audio MIDI Setup
**Windows**: Use loopMIDI or MIDI-OX with MIDI Yoke
**Linux**: Use ALSA virtual MIDI or QjackCtl

## Testing

No formal test suite exists. Testing is done manually by:
1. Checking MIDI output with a DAW or MIDI monitor
2. Testing keyboard layouts and octave controls
3. Verifying piano visual feedback
4. Testing sustain pedal functionality

## Browser Console

The application logs MIDI messages to browser console for debugging:
- Note on/off events with note names and MIDI values
- MIDI output device detection and selection
- Error messages for MIDI-related issues

## Future Vision - Professional MIDI Controller

### Enhanced MIDI Output Capabilities
- **Velocity curves** (linear, exponential, logarithmic, custom)
- **Aftertouch simulation** via key hold duration
- **Configurable note-off velocity**
- **MIDI channel splitting** for multi-timbral control

### Professional Performance Features
- **Arpeggiator Engine**
  - Multiple patterns (up, down, up/down, random, chord)
  - Rate sync to BPM or free-running
  - Gate length control
  - Swing/shuffle timing
  - Note order customization
- **Latency compensation** and monitoring
- **Note priority modes** (last, highest, lowest)
- **Glide/portamento** control between notes
- **Configurable key repeat** for rolls/trills

### Advanced Control Mappings
- **CC controls** via modifier keys (Shift+key for mod wheel, etc.)
- **Assignable MIDI CC** using mouse wheel over keys
- **Program change** shortcuts
- **Multiple pedal controls** (sustain, sostenuto, soft)

### Improved Visual Feedback
- **Real-time velocity visualization** on keys
- **MIDI activity indicators**
- **Octave range highlighting**
- **Current scale/mode visualization**
- **Arpeggiator pattern visualization**

### DAW Integration Features
- **MIDI clock sync** indicator
- **Transport controls** (play/stop/record via F-keys)
- **Multiple virtual MIDI port** support
- **Preset system** for different DAW configurations

### Quality of Life Improvements
- **Settings persistence** via localStorage
- **MIDI panic button** (all notes off)
- **Keyboard shortcut customization**
- **Export/import configuration** files

### Technical Architecture Improvements
- **TypeScript migration** for better type safety and developer experience
- **Modular ES6 architecture** with clear separation of concerns:
  - Core MIDI engine module
  - UI/visualization module
  - Arpeggiator module
  - Settings/preset module
- **Service Worker** for offline functionality and PWA capabilities
- **WebAssembly modules** for critical low-latency operations:
  - Arpeggiator timing engine
  - MIDI message processing
  - Velocity curve calculations
- **Event-driven architecture** for better performance
- **Web Workers** for non-blocking MIDI processing

### Implementation Priorities
1. TypeScript conversion with proper interfaces for MIDI objects
2. Modular refactoring of existing code
3. Arpeggiator implementation with WebAssembly timing
4. Advanced velocity and expression controls
5. Preset system and configuration management
6. Service Worker for offline capability