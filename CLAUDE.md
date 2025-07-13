# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based QWERTY keyboard MIDI controller that turns your computer keyboard into a piano keyboard with real MIDI output. The application is built with vanilla HTML, CSS, and JavaScript using the Web MIDI API.

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