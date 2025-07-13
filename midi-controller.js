// MIDI Controller State
let midiAccess = null;
let midiOutput = null;
let currentOctave = 4;
let sustainPressed = false;
let activeNotes = new Set();
let pressedKeys = new Set();
let currentLayout = 'classic';

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Keyboard Layouts
const simpleKeyToNote = {
    'KeyA': 0, 'KeyW': 1, 'KeyS': 2, 'KeyE': 3, 'KeyD': 4, 'KeyF': 5,
    'KeyT': 6, 'KeyG': 7, 'KeyY': 8, 'KeyH': 9, 'KeyU': 10, 'KeyJ': 11,
    'KeyK': 12, 'KeyO': 13, 'KeyL': 14, 'KeyP': 15, 'Semicolon': 16, 'Quote': 17, 'BracketRight': 18,
    // Simple layout octave controls
    'KeyZ': 'octave-down', 'KeyX': 'octave-up'
};

const expandedKeyToNote = {
    // Bottom row (C4 octave) - Z to /
    'KeyZ': 0,   // C4
    'KeyX': 2,   // D4
    'KeyC': 4,   // E4
    'KeyV': 5,   // F4
    'KeyB': 7,   // G4
    'KeyN': 9,   // A4
    'KeyM': 11,  // B4
    'Comma': 12, // C5
    'Period': 14, // D5
    'Slash': 16,  // E5
    
    // Top row (C5 octave) - Q to P
    'KeyQ': 12,  // C5
    'KeyW': 14,  // D5
    'KeyE': 16,  // E5
    'KeyR': 17,  // F5
    'KeyT': 19,  // G5
    'KeyY': 21,  // A5
    'KeyU': 23,  // B5
    'KeyI': 24,  // C6
    'KeyO': 26,  // D6
    'KeyP': 28,  // E6
    
    // Black keys for bottom row (C4 octave) - S row
    'KeyS': 1,   // C#4 (above Z=C4)
    'KeyD': 3,   // D#4 (above X=D4)
    'KeyG': 6,   // F#4 (above V=F4)
    'KeyH': 8,   // G#4 (above B=G4)
    'KeyJ': 10,  // A#4 (above N=A4)
    'KeyL': 13,  // C#5 (above ,=C5)
    'Semicolon': 15, // D#5 (above .=D5)
    
    // Black keys for top row (C5 octave) - Number row
    'Digit2': 13, // C#5 (above Q=C5)
    'Digit3': 15, // D#5 (above W=D5)
    'Digit5': 18, // F#5 (above R=F5)
    'Digit6': 20, // G#5 (above T=G5)
    'Digit7': 22, // A#5 (above Y=A5)
    'Digit9': 25, // C#6 (above I=C6)
    'Digit0': 27  // D#6 (above O=D6)
};

function getKeyToNote() {
    return currentLayout === 'expanded' ? expandedKeyToNote : simpleKeyToNote;
}

// MIDI Functions
async function initMIDI() {
    try {
        updateStatus('Requesting MIDI access...');
        midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        
        console.log('MIDI access granted!');
        midiAccess.onstatechange = handleMIDIStateChange;
        listMIDIOutputs();
        autoSelectOutput();
        
    } catch (error) {
        console.error('MIDI initialization failed:', error);
        updateStatus('MIDI not available - Check browser support', 'error');
        showMIDIHelp();
    }
}

function listMIDIOutputs() {
    const outputs = Array.from(midiAccess.outputs.values());
    console.log('Available MIDI outputs:');
    
    if (outputs.length === 0) {
        console.log('❌ No MIDI outputs found');
        updateStatus('❌ No MIDI outputs found - Need virtual MIDI port', 'error');
        showMIDIHelp();
        return;
    }
    
    outputs.forEach((output, index) => {
        console.log(`${index + 1}. ${output.name} (${output.manufacturer || 'Unknown'})`);
    });
    
    updateStatus(`✅ Found ${outputs.length} MIDI output(s)`, 'connected');
}

function autoSelectOutput() {
    const outputs = Array.from(midiAccess.outputs.values());
    
    let selectedOutput = outputs.find(output => 
        output.name.toLowerCase().includes('iac') || 
        output.name.toLowerCase().includes('bus')
    );
    
    if (!selectedOutput && outputs.length > 0) {
        selectedOutput = outputs[0];
    }
    
    if (selectedOutput) {
        midiOutput = selectedOutput;
        updateStatus(`🎹 Connected to: ${midiOutput.name}`, 'connected');
        console.log(`Auto-selected: ${midiOutput.name}`);
    }
}

function handleMIDIStateChange(event) {
    console.log(`MIDI device ${event.port.state}: ${event.port.name}`);
    if (event.port.type === 'output') {
        listMIDIOutputs();
        if (!midiOutput) {
            autoSelectOutput();
        }
    }
}

function sendMIDI(data) {
    if (midiOutput) {
        try {
            midiOutput.send(data);
            return true;
        } catch (error) {
            console.error(`MIDI send error: ${error.message}`);
            return false;
        }
    } else {
        console.log('MIDI data (no output):', data);
        return false;
    }
}

// Note Functions
function playNote(note) {
    if (activeNotes.has(note)) return;
    
    activeNotes.add(note);
    const velocity = parseInt(document.getElementById('velocity').value);
    
    sendMIDI([0x90 | getMidiChannel(), note, velocity]);
    updatePianoKey(note, true);
    
    const noteName = noteNames[note % 12];
    const octave = Math.floor(note / 12);
    console.log(`Playing note: ${noteName}${octave} (MIDI: ${note})`);
}

function stopNote(note) {
    if (!activeNotes.has(note)) return;
    
    activeNotes.delete(note);
    sendMIDI([0x80 | getMidiChannel(), note, 0]);
    updatePianoKey(note, false);
    
    const noteName = noteNames[note % 12];
    const octave = Math.floor(note / 12);
    console.log(`Stopping note: ${noteName}${octave} (MIDI: ${note})`);
}

function stopAllNotes() {
    activeNotes.forEach(note => {
        sendMIDI([0x80 | getMidiChannel(), note, 0]);
    });
    
    sendMIDI([0xB0 | getMidiChannel(), 123, 0]);
    activeNotes.clear();
    pressedKeys.clear();
    
    document.querySelectorAll('.key.active, .keyboard-key.active').forEach(key => {
        key.classList.remove('active');
    });
    
    console.log('All notes stopped');
}

// Piano UI Functions
function createPiano() {
    const piano = document.getElementById('piano');
    piano.innerHTML = '';
    
    if (currentLayout === 'simple') {
        createSimplePiano();
    } else if (currentLayout === 'expanded') {
        createExpandedPiano();
    }
}

function createSimplePiano() {
    const piano = document.getElementById('piano');
    
    // Simple layout: 19 keys total - C to F# (1.5 octaves)
    // 11 white keys: C D E F G A B C D E F
    const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F'];
    const whiteKeyOctaves = [
        currentOctave, currentOctave, currentOctave, currentOctave, currentOctave, currentOctave, currentOctave,
        currentOctave + 1, currentOctave + 1, currentOctave + 1, currentOctave + 1
    ];
    
    whiteKeys.forEach((note, index) => {
        const key = document.createElement('div');
        key.className = 'key white-key';
        key.textContent = `${note}${whiteKeyOctaves[index]}`;
        key.dataset.note = (currentOctave * 12) + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17][index];
        
        key.addEventListener('mousedown', (e) => {
            e.preventDefault();
            playNote(parseInt(key.dataset.note));
        });
        key.addEventListener('mouseup', () => stopNote(parseInt(key.dataset.note)));
        key.addEventListener('mouseleave', () => stopNote(parseInt(key.dataset.note)));
        
        piano.appendChild(key);
    });
    
    // Simple black keys: 8 keys - stops at F#
    const blackKeyPositions = [35, 75, 155, 195, 235, 315, 355, 435];
    const blackNotes = ['C#', 'D#', 'F#', 'G#', 'A#', 'C#', 'D#', 'F#'];
    const blackKeyOctaves = [
        currentOctave, currentOctave, currentOctave, currentOctave, currentOctave,
        currentOctave + 1, currentOctave + 1, currentOctave + 1
    ];
    
    blackKeyPositions.forEach((position, index) => {
        const key = document.createElement('div');
        key.className = 'key black-key';
        key.textContent = `${blackNotes[index]}${blackKeyOctaves[index]}`;
        key.style.left = position + 'px';
        key.dataset.note = (currentOctave * 12) + [1, 3, 6, 8, 10, 13, 15, 18][index];
        
        key.addEventListener('mousedown', (e) => {
            e.preventDefault();
            playNote(parseInt(key.dataset.note));
        });
        key.addEventListener('mouseup', () => stopNote(parseInt(key.dataset.note)));
        key.addEventListener('mouseleave', () => stopNote(parseInt(key.dataset.note)));
        
        piano.appendChild(key);
    });
}

function createExpandedPiano() {
    const piano = document.getElementById('piano');
    
    // Expanded layout: Extended range - use current octave as base
    const whiteKeys = [
        `C${currentOctave}`, `D${currentOctave}`, `E${currentOctave}`, `F${currentOctave}`, `G${currentOctave}`, `A${currentOctave}`, `B${currentOctave}`,
        `C${currentOctave + 1}`, `D${currentOctave + 1}`, `E${currentOctave + 1}`, `F${currentOctave + 1}`, `G${currentOctave + 1}`, `A${currentOctave + 1}`, `B${currentOctave + 1}`,
        `C${currentOctave + 2}`, `D${currentOctave + 2}`, `E${currentOctave + 2}`
    ];
    
    const whiteKeyNotes = [
        0, 2, 4, 5, 7, 9, 11,        // C4 octave
        12, 14, 16, 17, 19, 21, 23,  // C5 octave
        24, 26, 28                   // C6 partial
    ];
    
    whiteKeys.forEach((note, index) => {
        const key = document.createElement('div');
        key.className = 'key white-key';
        key.textContent = note;
        key.dataset.note = (currentOctave * 12) + whiteKeyNotes[index];
        
        key.addEventListener('mousedown', (e) => {
            e.preventDefault();
            playNote(parseInt(key.dataset.note));
        });
        key.addEventListener('mouseup', () => stopNote(parseInt(key.dataset.note)));
        key.addEventListener('mouseleave', () => stopNote(parseInt(key.dataset.note)));
        
        piano.appendChild(key);
    });
    
    // Expanded black keys - positioned for extended range
    const blackKeyPositions = [
        35, 75,                      // C#4, D#4
        155, 195, 235,               // F#4, G#4, A#4
        315, 355,                    // C#5, D#5
        435, 475, 515,               // F#5, G#5, A#5
        595, 635                     // C#6, D#6
    ];
    
    const blackNotes = [
        `C#${currentOctave}`, `D#${currentOctave}`, `F#${currentOctave}`, `G#${currentOctave}`, `A#${currentOctave}`,
        `C#${currentOctave + 1}`, `D#${currentOctave + 1}`, `F#${currentOctave + 1}`, `G#${currentOctave + 1}`, `A#${currentOctave + 1}`, 
        `C#${currentOctave + 2}`, `D#${currentOctave + 2}`
    ];
    
    const blackKeyNotes = [
        1, 3, 6, 8, 10,              // C4 octave sharps
        13, 15, 18, 20, 22,          // C5 octave sharps
        25, 27                       // C6 octave sharps
    ];
    
    blackKeyPositions.forEach((position, index) => {
        const key = document.createElement('div');
        key.className = 'key black-key';
        key.textContent = blackNotes[index];
        key.style.left = position + 'px';
        key.dataset.note = (currentOctave * 12) + blackKeyNotes[index];
        
        key.addEventListener('mousedown', (e) => {
            e.preventDefault();
            playNote(parseInt(key.dataset.note));
        });
        key.addEventListener('mouseup', () => stopNote(parseInt(key.dataset.note)));
        key.addEventListener('mouseleave', () => stopNote(parseInt(key.dataset.note)));
        
        piano.appendChild(key);
    });
}

function updatePianoKey(note, active) {
    const pianoKey = document.querySelector(`[data-note="${note}"]`);
    if (pianoKey) {
        if (active) {
            pianoKey.classList.add('active');
        } else {
            pianoKey.classList.remove('active');
        }
    }
}

// Layout Functions
function switchLayout() {
    currentLayout = document.getElementById('layoutSelect').value;
    updateKeyboardMapping();
    createPiano(); // Recreate piano with new layout range
    console.log(`Switched to ${currentLayout} layout`);
}

function getSimpleLayout() {
    return `
        <h3>Simple Piano Layout</h3>
        <div class="key-row">
            <div class="keyboard-key" data-key="KeyW">W<br>C#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyE">E<br>D#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyT">T<br>F#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyY">Y<br>G#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyU">U<br>A#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyO">O<br>C#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyP">P<br>D#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="BracketRight">]<br>F#${currentOctave + 1}</div>
        </div>
        <div class="key-row">
            <div class="keyboard-key" data-key="KeyA">A<br>C${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyS">S<br>D${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyD">D<br>E${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyF">F<br>F${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyG">G<br>G${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyH">H<br>A${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyJ">J<br>B${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyK">K<br>C${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyL">L<br>D${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Semicolon">;<br>E${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Quote">'<br>F${currentOctave + 1}</div>
        </div>
        <div class="key-row">
            <div class="keyboard-key" data-key="KeyZ">Z<br>Oct-</div>
            <div class="keyboard-key" data-key="KeyX">X<br>Oct+</div>
            <div class="keyboard-key" data-key="Space">SPACE<br>Sustain</div>
        </div>
    `;
}

function getExpandedLayout() {
    return `
        <h3>Expanded Layout</h3>
        <div class="key-row">
            <div class="keyboard-key" data-key="Digit2">2<br>C#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Digit3">3<br>D#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Digit5">5<br>F#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Digit6">6<br>G#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Digit7">7<br>A#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Digit9">9<br>C#${currentOctave + 2}</div>
            <div class="keyboard-key" data-key="Digit0">0<br>D#${currentOctave + 2}</div>
        </div>
        <div class="key-row">
            <div class="keyboard-key" data-key="KeyS">S<br>C#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyD">D<br>D#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyG">G<br>F#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyH">H<br>G#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyJ">J<br>A#${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyL">L<br>C#${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Semicolon">;<br>D#${currentOctave + 1}</div>
        </div>
        ${getExpandedKeysHTML()}
        ${getControlKeysHTML()}
    `;
}

function getExpandedKeysHTML() {
    return `
        <div class="key-row">
            <div class="keyboard-key" data-key="KeyQ">Q<br>C${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyW">W<br>D${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyE">E<br>E${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyR">R<br>F${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyT">T<br>G${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyY">Y<br>A${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyU">U<br>B${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="KeyI">I<br>C${currentOctave + 2}</div>
            <div class="keyboard-key" data-key="KeyO">O<br>D${currentOctave + 2}</div>
            <div class="keyboard-key" data-key="KeyP">P<br>E${currentOctave + 2}</div>
        </div>
        <div class="key-row">
            <div class="keyboard-key" data-key="KeyZ">Z<br>C${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyX">X<br>D${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyC">C<br>E${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyV">V<br>F${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyB">B<br>G${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyN">N<br>A${currentOctave}</div>
            <div class="keyboard-key" data-key="KeyM">M<br>B${currentOctave}</div>
            <div class="keyboard-key" data-key="Comma">,<br>C${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Period">.<br>D${currentOctave + 1}</div>
            <div class="keyboard-key" data-key="Slash">/<br>E${currentOctave + 1}</div>
        </div>
    `;
}

function getControlKeysHTML() {
    return `
        <div class="key-row">
            <div class="keyboard-key" data-key="Minus">-<br>Oct-</div>
            <div class="keyboard-key" data-key="Equal">=<br>Oct+</div>
            <div class="keyboard-key" data-key="Space">SPACE<br>Sustain</div>
        </div>
    `;
}

function updateKeyboardMapping() {
    const mappingDiv = document.getElementById('keyboardMapping');
    
    if (currentLayout === 'simple') {
        mappingDiv.innerHTML = getSimpleLayout();
    } else if (currentLayout === 'expanded') {
        mappingDiv.innerHTML = getExpandedLayout();
    }
}

// Event Handlers
function handleKeyDown(e) {
    if (pressedKeys.has(e.code)) return;
    pressedKeys.add(e.code);
    
    updateKeyVisual(e.code, true);
    
    const keyToNote = getKeyToNote();
    
    // Handle octave controls based on layout
    if (currentLayout === 'simple' && e.code === 'KeyZ') {
        changeOctave(-1);
    } else if (currentLayout === 'simple' && e.code === 'KeyX') {
        changeOctave(1);
    } else if (currentLayout === 'expanded' && e.code === 'Minus') {
        changeOctave(-1);
    } else if (currentLayout === 'expanded' && e.code === 'Equal') {
        changeOctave(1);
    } else if (e.code === 'Space') {
        handleSustainOn();
    } else if (keyToNote.hasOwnProperty(e.code)) {
        const noteValue = keyToNote[e.code];
        // Skip octave control strings
        if (typeof noteValue === 'number') {
            const note = (currentOctave * 12) + noteValue;
            playNote(note);
        }
    }
}

function handleKeyUp(e) {
    pressedKeys.delete(e.code);
    updateKeyVisual(e.code, false);
    
    const keyToNote = getKeyToNote();
    
    if (e.code === 'Space') {
        handleSustainOff();
    } else if (keyToNote.hasOwnProperty(e.code)) {
        const noteValue = keyToNote[e.code];
        // Skip octave control strings
        if (typeof noteValue === 'number') {
            const note = (currentOctave * 12) + noteValue;
            stopNote(note);
        }
    }
}

function updateKeyVisual(keyCode, active) {
    const keyElement = document.querySelector(`[data-key="${keyCode}"]`);
    if (keyElement) {
        if (active) {
            keyElement.classList.add('active');
        } else {
            keyElement.classList.remove('active');
        }
    }
}

function handleSustainOn() {
    sustainPressed = true;
    sendMIDI([0xB0 | getMidiChannel(), 64, 127]);
}

function handleSustainOff() {
    sustainPressed = false;
    sendMIDI([0xB0 | getMidiChannel(), 64, 0]);
}

// Setup Functions
function setupEventListeners() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    setupVelocitySlider();
    setupKeyPrevention();
    setupPianoContextMenu();
}

function setupVelocitySlider() {
    const velocitySlider = document.getElementById('velocity');
    velocitySlider.addEventListener('input', (e) => {
        document.getElementById('velocityValue').textContent = e.target.value;
    });
}

function setupKeyPrevention() {
    document.addEventListener('keydown', (e) => {
        const keyToNote = getKeyToNote();
        const controlKeys = currentLayout === 'simple' 
            ? ['KeyZ', 'KeyX', 'Space'] 
            : ['Minus', 'Equal', 'Space'];
        
        if (keyToNote.hasOwnProperty(e.code) || controlKeys.includes(e.code)) {
            e.preventDefault();
        }
    });
}

function setupPianoContextMenu() {
    document.getElementById('piano').addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Utility Functions
function updateStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

function getMidiChannel() {
    return parseInt(document.getElementById('midiChannel').value);
}

function changeOctave(direction) {
    const newOctave = currentOctave + direction;
    if (newOctave >= 0 && newOctave <= 8) {
        currentOctave = newOctave;
        createPiano();
        updateKeyboardMapping(); // Update keyboard mapping to show new octave numbers
    }
}

function showMIDIHelp() {
    const helpDiv = document.createElement('div');
    helpDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9); color: white; padding: 30px;
        border-radius: 15px; max-width: 500px; text-align: center;
        z-index: 1000; backdrop-filter: blur(10px); border: 2px solid #4CAF50;
    `;
    
    helpDiv.innerHTML = `
        <h3>🎹 MIDI Setup Required</h3>
        <p><strong>To use this controller with your DAW, you need a virtual MIDI port:</strong></p>
        <ol style="text-align: left; margin: 20px 0;">
            <li>Open <strong>Audio MIDI Setup</strong> (Applications > Utilities)</li>
            <li>Go to <strong>Window > Show MIDI Studio</strong></li>
            <li>Double-click <strong>IAC Driver</strong></li>
            <li>Check <strong>"Device is online"</strong></li>
            <li>Click <strong>"Connect MIDI"</strong> again</li>
        </ol>
        <button onclick="this.parentElement.remove(); initMIDI();" style="
            background: #4CAF50; color: white; border: none; padding: 10px 20px;
            border-radius: 5px; cursor: pointer; font-weight: bold;
        ">Try Again</button>
        <button onclick="this.parentElement.remove();" style="
            background: #666; color: white; border: none; padding: 10px 20px;
            border-radius: 5px; cursor: pointer; margin-left: 10px;
        ">Close</button>
    `;
    
    document.body.appendChild(helpDiv);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateKeyboardMapping();
    createPiano();
    setupEventListeners();
    
    // Toggle layout to ensure proper initialization
    setTimeout(() => {
        const layoutSelect = document.getElementById('layoutSelect');
        const originalValue = layoutSelect.value;
        
        // Switch to the other layout and back to force re-initialization
        layoutSelect.value = originalValue === 'expanded' ? 'simple' : 'expanded';
        switchLayout();
        
        layoutSelect.value = originalValue;
        switchLayout();
    }, 100);
    
    updateStatus('Ready! Click "Connect MIDI" to enable output');
});

// Cleanup
window.addEventListener('blur', () => {
    stopAllNotes();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAllNotes();
    }
});