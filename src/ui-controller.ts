import { KeyboardLayout, getMIDINoteName } from './types';

// Unified control configuration interface
interface UIControl {
  id: string;
  type: 'range' | 'select' | 'button';
  setter?: (value: string) => void;
  getter?: () => string | number;
  displayId?: string; // For range controls that show values
  displayFormatter?: (value: number) => string;
}

/**
 * Manages all user interface elements and interactions
 * Handles piano visualization, keyboard mapping display, and UI state management
 * Now includes clock sync status display
 */
export class UIController {
  private pianoContainer: HTMLElement;
  private keyboardMappingContainer: HTMLElement;
  private statusElement: HTMLElement;
  private octaveDisplay: HTMLElement;
  private velocitySlider: HTMLInputElement;
  private midiChannelSelect: HTMLSelectElement;
  private layoutSelect: HTMLSelectElement;
  private clockStatusElement: HTMLElement;
  private midiClockInputSelect: HTMLSelectElement | null = null;
  private midiNoteInputSelect: HTMLSelectElement | null = null;
  private beatIndicatorTimeout?: ReturnType<typeof setTimeout>; // Store timeout to prevent overlapping pulses
  private modIndicator: HTMLElement | null = null;
  private pitchIndicator: HTMLElement | null = null;
  private octaveDownIndicator: HTMLElement | null = null;
  private octaveUpIndicator: HTMLElement | null = null;

  private pianoKeyElements = new Map<number, HTMLElement>(); // Maps MIDI note numbers to piano key DOM elements
  private keyElements = new Map<string, HTMLElement>(); // Maps keyboard key codes to keyboard mapping DOM elements

  // Scale highlighting
  private scaleNotes: Set<number> = new Set();
  private scaleHighlightEnabled: boolean = false;
  
  // Unified control registry
  private controls = new Map<string, UIControl>();
  
  // Velocity change handlers
  private onVelocityChangeHandlers: ((velocity: number) => void)[] = [];
  
  // UI update batching for performance
  private pendingPianoUpdates = new Map<number, boolean>();
  private pendingKeyVisualUpdates = new Map<string, boolean>();
  private updateScheduled = false;

  constructor() {
    this.pianoContainer = document.getElementById('piano')!;
    this.keyboardMappingContainer = document.getElementById('keyboard-mapping')!;
    this.statusElement = document.getElementById('status')!;
    this.octaveDisplay = document.getElementById('current-octave')!;
    this.velocitySlider = document.getElementById('velocity') as HTMLInputElement;
    this.midiChannelSelect = document.getElementById('midi-channel') as HTMLSelectElement;
    this.layoutSelect = document.getElementById('layout-select') as HTMLSelectElement;
    this.clockStatusElement = document.getElementById('clock-status')!;
    this.midiClockInputSelect = document.getElementById('midi-clock-input') as HTMLSelectElement | null;
    this.midiNoteInputSelect = document.getElementById('midi-note-input') as HTMLSelectElement | null;
    this.modIndicator = document.getElementById('mod-indicator');
    this.pitchIndicator = document.getElementById('pitch-indicator');
    this.octaveDownIndicator = document.getElementById('octave-down-indicator');
    this.octaveUpIndicator = document.getElementById('octave-up-indicator');
    this.createClockStatusElement();
    this.setupUIEventListeners();
    this.setupButtonPressEffects();
    this.initializeControls();
  }

  /**
   * Creates the clock status display element if it doesn't exist
   */
  private createClockStatusElement(): void {
    if (!this.clockStatusElement) {
      this.clockStatusElement = document.createElement('div');
      this.clockStatusElement.id = 'clock-status';
      this.clockStatusElement.className = 'clock-status';
      this.clockStatusElement.textContent = '🔴 No Clock Sync';
      
      // Add beat indicator
      const beatIndicator = document.createElement('div');
      beatIndicator.id = 'beat-indicator';
      beatIndicator.className = 'beat-indicator';
      this.clockStatusElement.appendChild(beatIndicator);
      
      // Insert after the status element
      this.statusElement.parentNode?.insertBefore(
        this.clockStatusElement, 
        this.statusElement.nextSibling
      );
    }
  }

  /**
   * Sets up UI event listeners using the unified control system
   */
  private setupUIEventListeners(): void {
    // Wire up velocity control with display update and change notification
    this.wireControl({
      id: 'velocity',
      type: 'range',
      setter: (value) => {
        this.velocitySlider.value = value;
        // Notify velocity change handlers
        const numValue = parseInt(value);
        this.onVelocityChangeHandlers.forEach(handler => handler(numValue));
      },
      getter: () => this.velocitySlider.value,
      displayId: 'velocity-value',
      displayFormatter: (value) => value.toString()
    });

    // Prevent form submission on enter
    document.querySelectorAll('input, select').forEach(element => {
      element.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          e.preventDefault();
        }
      });
    });
  }

  /**
   * Sets up press-and-hold visual effects for buttons
   * Provides immediate visual feedback with green glow and scaling
   */
  private setupButtonPressEffects(): void {
    const buttons = document.querySelectorAll('button');
    
    buttons.forEach((button) => {
      let isPressed = false;
      
      // Mouse events
      button.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent focus on mouse down
        isPressed = true;
        button.classList.add('button-pressed');
      });
      
      button.addEventListener('mouseup', () => {
        if (isPressed) {
          isPressed = false;
          button.classList.remove('button-pressed');
        }
      });
      
      button.addEventListener('mouseleave', () => {
        if (isPressed) {
          isPressed = false;
          button.classList.remove('button-pressed');
        }
      });
      
      // Touch events for mobile devices
      button.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent mouse events from firing
        isPressed = true;
        button.classList.add('button-pressed');
      });
      
      button.addEventListener('touchend', () => {
        if (isPressed) {
          isPressed = false;
          button.classList.remove('button-pressed');
        }
      });
      
      button.addEventListener('touchcancel', () => {
        if (isPressed) {
          isPressed = false;
          button.classList.remove('button-pressed');
        }
      });
    });
  }

  /**
   * Wires up a single control using the unified system
   * @param control - The control configuration
   */
  private wireControl(control: UIControl): void {
    const element = document.getElementById(control.id);
    if (!element) {
      console.warn(`Control element not found: ${control.id}`);
      return;
    }

    // Use appropriate event per control type (mobile + desktop friendly)
    const eventType = control.type === 'range' ? 'input' : control.type === 'button' ? 'click' : 'change';
    
    element.addEventListener(eventType, () => {
      const value = (element as HTMLInputElement | HTMLSelectElement).value;
      
      // Call setter if provided
      if (control.setter) {
        control.setter(value);
      }
      
      // Update display if configured
      if (control.displayId && control.displayFormatter) {
        const displayElement = document.getElementById(control.displayId);
        if (displayElement) {
          const numValue = parseInt(value);
          displayElement.textContent = control.displayFormatter(numValue);
        }
      }
    });
  }

  /**
   * Updates the status message displayed to the user
   * @param message - The status message to display
   * @param type - The type of status ('info', 'error', 'success')
   */
  updateStatus(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
    this.statusElement.textContent = message;
    this.statusElement.className = `status ${type}`;
  }

  /**
   * Updates the octave display in the UI
   * @param octave - The current octave number to display
   */
  updateOctaveDisplay(octave: number): void {
    this.octaveDisplay.textContent = octave.toString();
  }

  /**
   * Gets the current velocity value from the slider
   * @returns number - Current velocity value (1-127)
   */
  getVelocity(): number {
    return parseInt(this.velocitySlider.value);
  }

  /**
   * Gets the current MIDI channel from the UI
   * @returns number - The MIDI channel (1-16)
   */
  getMidiChannel(): number {
    return parseInt(this.midiChannelSelect.value);
  }

  /**
   * Creates the piano keyboard visualization based on the current layout
   * Clears existing piano and creates new keys for the specified layout and octave
   * @param layout - The keyboard layout configuration
   * @param baseOctave - The base octave for the piano display
   */
  createPiano(layout: KeyboardLayout, baseOctave: number): void {
    this.pianoContainer.innerHTML = '';
    this.pianoKeyElements.clear();
    
    if (layout.name === 'simple') {
      this.createSimplePiano(layout, baseOctave);
    } else {
      this.createExpandedPiano(layout, baseOctave);
    }
  }

  /**
   * Creates the simple layout piano (1.5 octaves)
   * Generates white and black keys with proper positioning and labels
   * @param _layout - The keyboard layout (unused parameter for consistency)
   * @param baseOctave - The base octave for note calculations
   */
  private createSimplePiano(_layout: KeyboardLayout, baseOctave: number): void {
    const whiteNotes = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17];
    const keyboardKeys = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\''];
    
    // Create white keys
    whiteNotes.forEach((noteOffset, index) => {
      const key = this.createPianoKey(noteOffset, baseOctave, keyboardKeys[index]);
      this.pianoContainer.appendChild(key);
      this.pianoKeyElements.set((baseOctave * 12) + noteOffset, key);
    });
    
    // Create black keys with correct positioning from original JavaScript
    const blackKeyData = [
      { note: 1, left: 35, key: 'W' },   // C#
      { note: 3, left: 75, key: 'E' },   // D#
      { note: 6, left: 155, key: 'T' },  // F#
      { note: 8, left: 195, key: 'Y' },  // G#
      { note: 10, left: 235, key: 'U' }, // A#
      { note: 13, left: 315, key: 'O' }, // C#
      { note: 15, left: 355, key: 'P' }, // D#
      { note: 18, left: 435, key: ']' }  // F# (second F#)
    ];
    
    blackKeyData.forEach(({ note, left, key }) => {
      const keyElement = this.createPianoKey(note, baseOctave, key, true, left);
      this.pianoContainer.appendChild(keyElement);
      this.pianoKeyElements.set((baseOctave * 12) + note, keyElement);
    });
  }

  /**
   * Creates the expanded layout piano (2.5 octaves)
   * Generates two rows of keys with proper positioning and labels
   * @param _layout - The keyboard layout (unused parameter for consistency)
   * @param baseOctave - The base octave for note calculations
   */
  private createExpandedPiano(_layout: KeyboardLayout, baseOctave: number): void {
    // Bottom row white keys (lower octave)
    const bottomWhiteNotes = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
    const bottomKeys = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'];
    
    // Top row white keys (upper octave)  
    const topWhiteNotes = [12, 14, 16, 17, 19, 21, 23, 24, 26, 28, 29, 31];
    const topKeys = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'];
    
    // Create bottom row (lower notes)
    const bottomRow = document.createElement('div');
    bottomRow.className = 'piano-row bottom-row';
    
    bottomWhiteNotes.forEach((noteOffset, index) => {
      const key = this.createPianoKey(noteOffset, baseOctave, bottomKeys[index]);
      bottomRow.appendChild(key);
      this.pianoKeyElements.set((baseOctave * 12) + noteOffset, key);
    });
    
    // Create top row (higher notes) - shifted left by 3 white keys to overlap duplicates
    const topRow = document.createElement('div');
    topRow.className = 'piano-row top-row';
    topRow.style.marginLeft = '-123px'; // Shift left by 3 white keys (3 × 41px)
    
    topWhiteNotes.forEach((noteOffset, index) => {
      const key = this.createPianoKey(noteOffset, baseOctave, topKeys[index]);
      topRow.appendChild(key);
      this.pianoKeyElements.set((baseOctave * 12) + noteOffset, key);
    });
    
    // Add rows in correct order: bottom (lower notes) first, then top (higher notes)
    this.pianoContainer.appendChild(bottomRow);
    this.pianoContainer.appendChild(topRow);
    
    // Add black keys
    this.addExpandedBlackKeys(baseOctave);
  }

  /**
   * Adds black keys to the expanded piano layout
   * Positions black keys between white keys with proper spacing
   * @param baseOctave - The base octave for note calculations
   */
  private addExpandedBlackKeys(baseOctave: number): void {
    // Bottom row black keys (C4 octave) - positioned between white keys
    const bottomBlackNotes = [
      { note: 1, left: 25, key: 'S' },   // C#4 (between Z and X)
      { note: 3, left: 66, key: 'D' },   // D#4 (between X and C)
      { note: 6, left: 148, key: 'G' },  // F#4 (between C and V)
      { note: 8, left: 189, key: 'H' },  // G#4 (between V and B)
      { note: 10, left: 230, key: 'J' }, // A#4 (between B and N)
      { note: 13, left: 312, key: 'L' }, // C#5 (between M and ,)
      { note: 15, left: 353, key: ';' }  // D#5 (between , and .)
    ];
    
    // Top row black keys (C5 octave) - positioned between white keys
    const topBlackNotes = [
      { note: 13, left: 25, key: '2' },   // C#5 (between Q and W)
      { note: 15, left: 66, key: '3' },   // D#5 (between W and E)
      { note: 18, left: 148, key: '5' },  // F#5 (between E and R)
      { note: 20, left: 189, key: '6' },  // G#5 (between R and T)
      { note: 22, left: 230, key: '7' },  // A#5 (between T and Y)
      { note: 25, left: 312, key: '9' },  // C#6 (between U and I)
      { note: 27, left: 353, key: '0' },  // D#6 (between I and O)
      { note: 30, left: 435, key: '=' }   // F#6 (between P and [)
    ];
    
    const bottomRow = this.pianoContainer.querySelector('.bottom-row')!;
    const topRow = this.pianoContainer.querySelector('.top-row')!;
    
    // Add black keys to bottom row
    bottomBlackNotes.forEach(({ note: noteOffset, left, key: keyBinding }) => {
      const key = this.createPianoKey(noteOffset, baseOctave, keyBinding, true, left);
      bottomRow.appendChild(key);
      this.pianoKeyElements.set((baseOctave * 12) + noteOffset, key);
    });
    
    // Add black keys to top row
    topBlackNotes.forEach(({ note: noteOffset, left, key: keyBinding }) => {
      const key = this.createPianoKey(noteOffset, baseOctave, keyBinding, true, left);
      topRow.appendChild(key);
      this.pianoKeyElements.set((baseOctave * 12) + noteOffset, key);
    });
  }

  /**
   * Creates a piano key element with proper event listeners and styling
   * @param note - The MIDI note number
   * @param noteOffset - The note offset within the octave
   * @param baseOctave - The base octave for note calculations
   * @param keyBinding - The keyboard key binding to display
   * @param isBlack - Whether this is a black key
   * @param leftPosition - Optional left position for black keys
   * @returns The created key element
   */
  private createPianoKey(
    noteOffset: number,
    baseOctave: number,
    keyBinding: string,
    isBlack: boolean = false,
    leftPosition?: number
  ): HTMLElement {
    const key = document.createElement('div');
    key.className = `key ${isBlack ? 'black-key' : 'white-key'}`;
    const note = (baseOctave * 12) + noteOffset;
    key.dataset.note = note.toString();

    if (leftPosition !== undefined) {
      key.style.left = `${leftPosition}px`;
    }

    const label = document.createElement('div');
    label.className = isBlack ? 'black-key-label' : 'key-label';

    if (isBlack) {
      label.textContent = keyBinding;
    } else {
      label.innerHTML = `<span class="note-label">${getMIDINoteName(note)}</span><br><span class="key-binding">${keyBinding}</span>`;
    }

    key.appendChild(label);

    // Add event listeners
    key.addEventListener('mousedown', () => this.handlePianoClick(note, true));
    key.addEventListener('mouseup', () => this.handlePianoClick(note, false));
    key.addEventListener('mouseleave', () => this.handlePianoClick(note, false));

    // Apply scale highlighting if enabled
    this.updateKeyScaleHighlight(key, note);

    return key;
  }

  /**
   * Updates the visual state of a piano key (active/inactive)
   * Uses batched updates for better performance during high-speed sequences
   * @param note - The MIDI note number to update
   * @param active - Whether the key should appear active (pressed)
   */
  updatePianoKey(note: number, active: boolean): void {
    // Batch the update instead of applying immediately
    this.pendingPianoUpdates.set(note, active);
    this.scheduleUpdate();
  }

  /**
   * Immediately updates a piano key (for cases where batching isn't desired)
   * @param note - The MIDI note number to update
   * @param active - Whether the key should appear active (pressed)
   */
  updatePianoKeyImmediate(note: number, active: boolean): void {
    const keyElement = this.pianoKeyElements.get(note);
    if (keyElement) {
      if (active) {
        keyElement.classList.add('active');
      } else {
        keyElement.classList.remove('active');
      }
    }
  }

  /**
   * Updates the keyboard mapping display to show the current layout
   * Creates a visual representation of the QWERTY keyboard with key bindings
   * @param layout - The keyboard layout to display
   */
  updateKeyboardMapping(layout: KeyboardLayout): void {
    this.keyboardMappingContainer.innerHTML = '';
    this.keyElements.clear();
    
    const wrapper = document.createElement('div');
    wrapper.className = 'keyboard-wrapper';
    
    if (layout.name === 'simple') {
      wrapper.innerHTML = this.getSimpleLayoutHTML();
    } else {
      wrapper.innerHTML = this.getExpandedLayoutHTML();
    }
    
    this.keyboardMappingContainer.appendChild(wrapper);
    
    // Store references to key elements
    wrapper.querySelectorAll('.kb-key').forEach(element => {
      const keyCode = element.getAttribute('data-key');
      if (keyCode) {
        this.keyElements.set(keyCode, element as HTMLElement);
      }
    });
  }

  /**
   * Generates HTML for the simple layout keyboard mapping
   * @returns string - HTML representation of the simple keyboard layout
   */
  private getSimpleLayoutHTML(): string {
    return `
      <div class="keyboard-row">
        <div class="kb-key white-bg" data-key="KeyQ">Q</div>
        <div class="kb-key black-bg" data-key="KeyW">W</div>
        <div class="kb-key black-bg" data-key="KeyE">E</div>
        <div class="kb-key white-bg" data-key="KeyR">R</div>
        <div class="kb-key black-bg" data-key="KeyT">T</div>
        <div class="kb-key black-bg" data-key="KeyY">Y</div>
        <div class="kb-key black-bg" data-key="KeyU">U</div>
        <div class="kb-key white-bg" data-key="KeyI">I</div>
        <div class="kb-key black-bg" data-key="KeyO">O</div>
        <div class="kb-key black-bg" data-key="KeyP">P</div>
        <div class="kb-key white-bg" data-key="BracketLeft">[</div>
        <div class="kb-key black-bg" data-key="BracketRight">]</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key white-bg" data-key="KeyA">A</div>
        <div class="kb-key white-bg" data-key="KeyS">S</div>
        <div class="kb-key white-bg" data-key="KeyD">D</div>
        <div class="kb-key white-bg" data-key="KeyF">F</div>
        <div class="kb-key white-bg" data-key="KeyG">G</div>
        <div class="kb-key white-bg" data-key="KeyH">H</div>
        <div class="kb-key white-bg" data-key="KeyJ">J</div>
        <div class="kb-key white-bg" data-key="KeyK">K</div>
        <div class="kb-key white-bg" data-key="KeyL">L</div>
        <div class="kb-key white-bg" data-key="Semicolon">;</div>
        <div class="kb-key white-bg" data-key="Quote">'</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key control-key" data-key="KeyZ">Z ↓</div>
        <div class="kb-key control-key" data-key="KeyX">X ↑</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key control-key" data-key="ArrowDown">↓</div>
        <div class="kb-key control-key" data-key="ArrowUp">↑</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key control-key wide" data-key="Space">SPACE (Sustain)</div>
      </div>
    `;
  }

  /**
   * Generates HTML for the expanded layout keyboard mapping
   * @returns string - HTML representation of the expanded keyboard layout
   */
  private getExpandedLayoutHTML(): string {
    return `
      <div class="keyboard-row">
        <div class="kb-key black-bg" data-key="Digit2">2</div>
        <div class="kb-key black-bg" data-key="Digit3">3</div>
        <div class="kb-key white-bg" data-key="Digit4">4</div>
        <div class="kb-key black-bg" data-key="Digit5">5</div>
        <div class="kb-key black-bg" data-key="Digit6">6</div>
        <div class="kb-key black-bg" data-key="Digit7">7</div>
        <div class="kb-key white-bg" data-key="Digit8">8</div>
        <div class="kb-key black-bg" data-key="Digit9">9</div>
        <div class="kb-key black-bg" data-key="Digit0">0</div>
        <div class="kb-key white-bg" data-key="Minus">-</div>
        <div class="kb-key black-bg" data-key="Equal">=</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key white-bg" data-key="KeyQ">Q</div>
        <div class="kb-key white-bg" data-key="KeyW">W</div>
        <div class="kb-key white-bg" data-key="KeyE">E</div>
        <div class="kb-key white-bg" data-key="KeyR">R</div>
        <div class="kb-key white-bg" data-key="KeyT">T</div>
        <div class="kb-key white-bg" data-key="KeyY">Y</div>
        <div class="kb-key white-bg" data-key="KeyU">U</div>
        <div class="kb-key white-bg" data-key="KeyI">I</div>
        <div class="kb-key white-bg" data-key="KeyO">O</div>
        <div class="kb-key white-bg" data-key="KeyP">P</div>
        <div class="kb-key white-bg" data-key="BracketLeft">[</div>
        <div class="kb-key white-bg" data-key="BracketRight">]</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key black-bg" data-key="KeyS">S</div>
        <div class="kb-key black-bg" data-key="KeyD">D</div>
        <div class="kb-key white-bg" data-key="KeyF">F</div>
        <div class="kb-key black-bg" data-key="KeyG">G</div>
        <div class="kb-key black-bg" data-key="KeyH">H</div>
        <div class="kb-key black-bg" data-key="KeyJ">J</div>
        <div class="kb-key white-bg" data-key="KeyK">K</div>
        <div class="kb-key black-bg" data-key="KeyL">L</div>
        <div class="kb-key black-bg" data-key="Semicolon">;</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key white-bg" data-key="KeyZ">Z</div>
        <div class="kb-key white-bg" data-key="KeyX">X</div>
        <div class="kb-key white-bg" data-key="KeyC">C</div>
        <div class="kb-key white-bg" data-key="KeyV">V</div>
        <div class="kb-key white-bg" data-key="KeyB">B</div>
        <div class="kb-key white-bg" data-key="KeyN">N</div>
        <div class="kb-key white-bg" data-key="KeyM">M</div>
        <div class="kb-key white-bg" data-key="Comma">,</div>
        <div class="kb-key white-bg" data-key="Period">.</div>
        <div class="kb-key white-bg" data-key="Slash">/</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key control-key" data-key="ArrowLeft">←</div>
        <div class="kb-key control-key" data-key="ArrowRight">→</div>
        <div class="kb-key control-key" data-key="ArrowDown">↓</div>
        <div class="kb-key control-key" data-key="ArrowUp">↑</div>
        <div class="kb-key control-key wide" data-key="Space">SPACE (Sustain)</div>
      </div>
    `;
  }

  /**
   * Updates the visual state of a keyboard mapping key
   * Uses batched updates for better performance during high-speed sequences
   * @param keyCode - The key code to update (e.g., 'KeyA')
   * @param active - Whether the key should appear active (pressed)
   */
  updateKeyVisual(keyCode: string, active: boolean): void {
    // Batch the update instead of applying immediately
    this.pendingKeyVisualUpdates.set(keyCode, active);
    this.scheduleUpdate();
  }

  /**
   * Immediately updates a keyboard mapping key (for cases where batching isn't desired)
   * @param keyCode - The key code to update (e.g., 'KeyA')
   * @param active - Whether the key should appear active (pressed)
   */
  updateKeyVisualImmediate(keyCode: string, active: boolean): void {
    const element = this.keyElements.get(keyCode);
    if (element) {
      if (active) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    }
  }

  /**
   * Updates the clock sync status display
   * @param status - The current clock sync status
   * @param bpm - Optional BPM to display
   */
  updateClockStatus(status: 'synced' | 'free' | 'stopped', bpm?: number): void {
    if (!this.clockStatusElement) return;
    
    let icon: string;
    let text: string;
    let className: string;
    
    switch (status) {
      case 'synced':
        icon = '🟢';
        text = bpm ? `Synced to DAW (${Math.round(bpm)} BPM)` : 'Synced to DAW';
        className = 'clock-status synced';
        break;
      case 'free':
        icon = '🟡';
        text = 'Free Running';
        className = 'clock-status free';
        break;
      case 'stopped':
        icon = '🔴';
        text = 'Stopped';
        className = 'clock-status stopped';
        break;
    }
    
    // Update text content (excluding beat indicator)
    const textNode = this.clockStatusElement.childNodes[0];
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = `${icon} ${text}`;
    } else {
      this.clockStatusElement.insertBefore(
        document.createTextNode(`${icon} ${text}`),
        this.clockStatusElement.firstChild
      );
    }
    
    this.clockStatusElement.className = className;
  }

  /**
   * Updates the beat indicator with a pulse animation
   */
  updateBeatIndicator(): void {
    const indicator = document.getElementById('beat-indicator');
    if (indicator) {
      clearTimeout(this.beatIndicatorTimeout);
      indicator.classList.add('pulse');
      this.beatIndicatorTimeout = setTimeout(() => {
        indicator.classList.remove('pulse');
      }, 100);
    }
  }

  /**
   * Internal handler for piano click events
   * @param note - The MIDI note number
   * @param down - Whether the key is being pressed down
   */
  private handlePianoClick: (note: number, down: boolean) => void = (note, down) => {
    // Validate note value before calling handler
    if (note === undefined || note === null || note < 0 || note > 127) {
      console.error(`Invalid MIDI note value: ${note}`);
      return;
    }
    
    // Call the actual handler if it's been set
    if (this.pianoClickHandler) {
      this.pianoClickHandler(note, down);
    }
  };

  // Store the actual piano click handler
  private pianoClickHandler?: (note: number, down: boolean) => void;
  
  /**
   * Sets the handler for piano click events
   * @param handler - Function called when piano keys are clicked
   */
  onPianoClick(handler: (note: number, down: boolean) => void): void {
    this.pianoClickHandler = handler;
  }

  /**
   * Sets the handler for layout change events
   * @param handler - Function called when the layout dropdown changes
   */
  onLayoutChange(handler: (layout: string) => void): void {
    this.layoutSelect.addEventListener('change', () => {
      handler(this.layoutSelect.value);
    });
  }

  /**
   * Shows the MIDI not available error message
   * Displays helpful information when Web MIDI API is not supported
   */
  showMIDINotAvailable(): void {
    const helpDiv = document.getElementById('midi-help');
    if (helpDiv) {
      helpDiv.style.display = 'block';
    }
  }

  /**
   * Initializes the control registry with UI elements
   */
  private initializeControls(): void {
    this.controls.set('velocity', {
      id: 'velocity',
      type: 'range',
      getter: () => this.velocitySlider.value,
      setter: (value) => {
        this.velocitySlider.value = value;
        const velocityValue = document.getElementById('velocity-value');
        if (velocityValue) {
          velocityValue.textContent = value;
        }
      },
      displayId: 'velocity-value',
      displayFormatter: (value) => value.toString()
    });

    this.controls.set('midiChannel', {
      id: 'midi-channel',
      type: 'select',
      getter: () => this.midiChannelSelect.value,
      setter: (value) => {
        this.midiChannelSelect.value = value;
      }
    });

    if (this.midiClockInputSelect) {
      this.controls.set('midiClockInput', {
        id: 'midi-clock-input',
        type: 'select',
        getter: () => this.midiClockInputSelect!.value,
        setter: (value) => {
          this.midiClockInputSelect!.value = value;
        }
      });
    }

    this.controls.set('layout', {
      id: 'layout-select',
      type: 'select',
      getter: () => this.layoutSelect.value,
      setter: (value) => {
        this.layoutSelect.value = value;
      }
    });

    this.controls.set('clockStatus', {
      id: 'clock-status',
      type: 'button', // Clock status is a button-like display, not a direct control
      getter: () => this.clockStatusElement?.textContent?.replace(/🟢|🟡|🔴/g, '') || '',
      setter: () => {}, // No setter for this display
      displayFormatter: (value) => value.toString()
    });
  }

  /**
   * Updates a control value by its ID
   * @param id - The ID of the control to update
   * @param value - The new value to set
   */
  updateControl(id: string, value: string): void {
    const control = this.controls.get(id);
    if (control) {
      if (control.setter) {
        control.setter(value);
      }
    }
  }

  /**
   * Gets the current value of a control by its ID
   * @param id - The ID of the control to get
   * @returns The current value of the control
   */
  getControlValue(id: string): string | number {
    const control = this.controls.get(id);
    if (control) {
      if (control.getter) {
        return control.getter();
      }
    }
    return ''; // Default return if control not found or getter not implemented
  }

  /**
   * Registers a new control with the UIController
   * @param control - The control configuration
   */
  registerControl(control: UIControl): void {
    this.controls.set(control.id, control);
  }

  /** Update Mod wheel visual indicator */
  updateModIndicator(active: boolean): void {
    if (!this.modIndicator) return;
    this.modIndicator.classList.toggle('active', !!active);
  }

  /** Update Pitch wheel visual indicator */
  updatePitchIndicator(active: boolean): void {
    if (!this.pitchIndicator) return;
    this.pitchIndicator.classList.toggle('active', !!active);
  }

  /** Update Octave Down visual indicator */
  updateOctaveDownIndicator(active: boolean): void {
    if (!this.octaveDownIndicator) return;
    this.octaveDownIndicator.classList.toggle('active', !!active);
  }

  /** Update Octave Up visual indicator */
  updateOctaveUpIndicator(active: boolean): void {
    if (!this.octaveUpIndicator) return;
    this.octaveUpIndicator.classList.toggle('active', !!active);
  }

  /**
   * Populate the MIDI Clock Input dropdown
   */
  populateClockInputs(inputs: { id: string; name: string }[], selected: string = 'auto'): void {
    if (!this.midiClockInputSelect) return;
    const select = this.midiClockInputSelect;
    select.innerHTML = '';
    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto (Best)';
    select.appendChild(autoOption);

    inputs.forEach(inp => {
      const opt = document.createElement('option');
      opt.value = inp.id;
      opt.textContent = inp.name || `Input ${inp.id}`;
      select.appendChild(opt);
    });

    // Set selection
    const values = ['auto', ...inputs.map(i => i.id)];
    if (values.includes(selected)) {
      select.value = selected;
    } else {
      select.value = 'auto';
    }
  }

  /**
   * Listen for clock input selection changes
   */
  onClockInputChange(handler: (id: string) => void): void {
    if (!this.midiClockInputSelect) return;
    this.midiClockInputSelect.addEventListener('change', () => {
      handler(this.midiClockInputSelect!.value);
    });
  }

  /**
   * Populate the MIDI Note Input dropdown
   */
  populateNoteInputs(sources: { id: string; name: string }[], selected: string = 'keyboard'): void {
    if (!this.midiNoteInputSelect) return;
    const select = this.midiNoteInputSelect;
    select.innerHTML = '';

    sources.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src.id;
      opt.textContent = src.name;
      select.appendChild(opt);
    });

    // Select the current input
    select.value = selected;
  }

  /**
   * Listen for note input selection changes
   */
  onNoteInputChange(handler: (sourceId: string) => void): void {
    if (!this.midiNoteInputSelect) return;
    this.midiNoteInputSelect.addEventListener('change', () => {
      handler(this.midiNoteInputSelect!.value);
    });
  }

  /**
   * Register a handler for velocity changes
   */
  onVelocityChange(handler: (velocity: number) => void): void {
    this.onVelocityChangeHandlers.push(handler);
  }

  /**
   * Schedules a batched UI update using requestAnimationFrame
   * Prevents excessive DOM manipulation during high-speed sequences
   */
  private scheduleUpdate(): void {
    if (this.updateScheduled) return;
    
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.flushUpdates();
      this.updateScheduled = false;
    });
  }

  /**
   * Applies all pending UI updates in a single batch
   */
  private flushUpdates(): void {
    // Apply piano key updates
    this.pendingPianoUpdates.forEach((active, note) => {
      this.updatePianoKeyImmediate(note, active);
    });
    this.pendingPianoUpdates.clear();

    // Apply keyboard visual updates
    this.pendingKeyVisualUpdates.forEach((active, keyCode) => {
      this.updateKeyVisualImmediate(keyCode, active);
    });
    this.pendingKeyVisualUpdates.clear();
  }

  /**
   * Forces immediate flush of all pending updates
   * Useful when immediate visual feedback is required
   */
  flushUpdatesImmediate(): void {
    if (this.updateScheduled) {
      this.flushUpdates();
      this.updateScheduled = false;
    }
  }

  /**
   * Sets which notes are in the current scale for highlighting
   * @param scaleNotes - Array of MIDI note numbers that are in the scale
   * @param enabled - Whether scale highlighting should be enabled
   */
  setScaleHighlight(scaleNotes: number[], enabled: boolean): void {
    this.scaleNotes = new Set(scaleNotes);
    this.scaleHighlightEnabled = enabled;

    // Update all piano keys with scale highlighting
    this.pianoKeyElements.forEach((keyElement, note) => {
      this.updateKeyScaleHighlight(keyElement, note);
    });
  }

  /**
   * Updates a single key element with scale highlighting
   * @param keyElement - The DOM element representing the key
   * @param note - The MIDI note number
   */
  private updateKeyScaleHighlight(keyElement: HTMLElement, note: number): void {
    if (this.scaleHighlightEnabled && this.scaleNotes.has(note)) {
      keyElement.classList.add('in-scale');
    } else {
      keyElement.classList.remove('in-scale');
    }
  }

  /**
   * Restores active key visual states after piano DOM rebuild
   * @param activeNotes - Map of currently playing notes
   */
  restoreActiveKeyStates(activeNotes: Map<string, any>): void {
    // Iterate over all currently playing notes and reapply visual state
    activeNotes.forEach((noteInfo) => {
      const note = noteInfo.note;
      const keyElement = this.pianoKeyElements.get(note);
      if (keyElement) {
        keyElement.classList.add('active');
      }
    });
  }
}
