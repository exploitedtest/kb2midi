import { KeyboardLayout, getMIDINoteName } from './types';

/**
 * Manages all user interface elements and interactions
 * Handles piano visualization, keyboard mapping display, and UI state management
 */
export class UIController {
  private pianoContainer: HTMLElement;
  private keyboardMappingContainer: HTMLElement;
  private statusElement: HTMLElement;
  private octaveDisplay: HTMLElement;
  private velocitySlider: HTMLInputElement;
  private midiChannelSelect: HTMLSelectElement;
  private layoutSelect: HTMLSelectElement;
  
  private activeKeys = new Map<number, HTMLElement>();
  private keyElements = new Map<string, HTMLElement>();
  
  constructor() {
    this.pianoContainer = document.getElementById('piano')!;
    this.keyboardMappingContainer = document.getElementById('keyboard-mapping')!;
    this.statusElement = document.getElementById('status')!;
    this.octaveDisplay = document.getElementById('current-octave')!;
    this.velocitySlider = document.getElementById('velocity') as HTMLInputElement;
    this.midiChannelSelect = document.getElementById('midi-channel') as HTMLSelectElement;
    this.layoutSelect = document.getElementById('layout-select') as HTMLSelectElement;
    
    this.setupUIEventListeners();
  }

  /**
   * Sets up event listeners for UI controls
   * Updates velocity display and prevents form submission on enter key
   */
  private setupUIEventListeners(): void {
    // Velocity display update
    this.velocitySlider.addEventListener('input', () => {
      const velocityValue = document.getElementById('velocity-value');
      if (velocityValue) {
        velocityValue.textContent = this.velocitySlider.value;
      }
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
   * Gets the current MIDI channel from the select dropdown
   * @returns number - Current MIDI channel (1-16)
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
    this.activeKeys.clear();
    
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
    const whiteNotes = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
    const blackKeyPositions = [1, 3, null, 6, 8, 10, null, 13, 15, null, 18];
    const keyboardKeys = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\'', ']'];
    const blackKeyboardKeys = ['W', 'E', null, 'T', 'Y', 'U', null, 'O', 'P', null, null];
    
    // Create white keys
    whiteNotes.forEach((noteOffset, index) => {
      const key = document.createElement('div');
      key.className = 'key white-key';
      const note = (baseOctave * 12) + noteOffset;
      key.dataset.note = note.toString();
      
      const label = document.createElement('div');
      label.className = 'key-label';
      label.innerHTML = `<span class="note-label">${getMIDINoteName(note)}</span><br><span class="key-binding">${keyboardKeys[index]}</span>`;
      key.appendChild(label);
      
      key.addEventListener('mousedown', () => this.handlePianoClick(note, true));
      key.addEventListener('mouseup', () => this.handlePianoClick(note, false));
      key.addEventListener('mouseleave', () => this.handlePianoClick(note, false));
      
      this.pianoContainer.appendChild(key);
      this.activeKeys.set(note, key);
    });
    
    // Create black keys
    blackKeyPositions.forEach((noteOffset, index) => {
      if (noteOffset !== null) {
        const key = document.createElement('div');
        key.className = 'key black-key';
        const note = (baseOctave * 12) + noteOffset;
        key.dataset.note = note.toString();
        key.style.left = `${(index * 50) + 35}px`;
        
        const keyBinding = blackKeyboardKeys[index];
        if (keyBinding) {
          const label = document.createElement('div');
          label.className = 'black-key-label';
          label.textContent = keyBinding;
          key.appendChild(label);
        }
        
        key.addEventListener('mousedown', () => this.handlePianoClick(note, true));
        key.addEventListener('mouseup', () => this.handlePianoClick(note, false));
        key.addEventListener('mouseleave', () => this.handlePianoClick(note, false));
        
        this.pianoContainer.appendChild(key);
        this.activeKeys.set(note, key);
      }
    });
  }

  /**
   * Creates the expanded layout piano (2.5 octaves)
   * Generates two rows of keys with proper positioning and labels
   * @param _layout - The keyboard layout (unused parameter for consistency)
   * @param baseOctave - The base octave for note calculations
   */
  private createExpandedPiano(_layout: KeyboardLayout, baseOctave: number): void {
    // Bottom row white keys
    const bottomWhiteNotes = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
    const bottomKeys = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'];
    
    // Top row white keys  
    const topWhiteNotes = [12, 14, 16, 17, 19, 21, 23, 24, 26, 28];
    const topKeys = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
    
    // Create bottom row
    const bottomRow = document.createElement('div');
    bottomRow.className = 'piano-row bottom-row';
    
    bottomWhiteNotes.forEach((noteOffset, index) => {
      const key = document.createElement('div');
      key.className = 'key white-key';
      const note = (baseOctave * 12) + noteOffset;
      key.dataset.note = note.toString();
      
      const label = document.createElement('div');
      label.className = 'key-label';
      label.innerHTML = `<span class="note-label">${getMIDINoteName(note)}</span><br><span class="key-binding">${bottomKeys[index]}</span>`;
      key.appendChild(label);
      
      key.addEventListener('mousedown', () => this.handlePianoClick(note, true));
      key.addEventListener('mouseup', () => this.handlePianoClick(note, false));
      key.addEventListener('mouseleave', () => this.handlePianoClick(note, false));
      
      bottomRow.appendChild(key);
      this.activeKeys.set(note, key);
    });
    
    // Create top row
    const topRow = document.createElement('div');
    topRow.className = 'piano-row top-row';
    
    topWhiteNotes.forEach((noteOffset, index) => {
      const key = document.createElement('div');
      key.className = 'key white-key';
      const note = (baseOctave * 12) + noteOffset;
      key.dataset.note = note.toString();
      
      const label = document.createElement('div');
      label.className = 'key-label';
      label.innerHTML = `<span class="note-label">${getMIDINoteName(note)}</span><br><span class="key-binding">${topKeys[index]}</span>`;
      key.appendChild(label);
      
      key.addEventListener('mousedown', () => this.handlePianoClick(note, true));
      key.addEventListener('mouseup', () => this.handlePianoClick(note, false));
      key.addEventListener('mouseleave', () => this.handlePianoClick(note, false));
      
      topRow.appendChild(key);
      this.activeKeys.set(note, key);
    });
    
    this.pianoContainer.appendChild(topRow);
    this.pianoContainer.appendChild(bottomRow);
    
    // Add black keys
    this.addExpandedBlackKeys(baseOctave);
  }

  /**
   * Adds black keys to the expanded piano layout
   * Positions black keys between white keys with proper spacing
   * @param baseOctave - The base octave for note calculations
   */
  private addExpandedBlackKeys(baseOctave: number): void {
    // Bottom row black keys
    const bottomBlackNotes = [
      { note: 1, left: 35, key: 'S' },
      { note: 3, left: 85, key: 'D' },
      { note: 6, left: 185, key: 'G' },
      { note: 8, left: 235, key: 'H' },
      { note: 10, left: 285, key: 'J' },
      { note: 13, left: 385, key: 'L' },
      { note: 15, left: 435, key: ';' }
    ];
    
    // Top row black keys
    const topBlackNotes = [
      { note: 13, left: 35, key: '2' },
      { note: 15, left: 85, key: '3' },
      { note: 18, left: 185, key: '5' },
      { note: 20, left: 235, key: '6' },
      { note: 22, left: 285, key: '7' },
      { note: 25, left: 385, key: '9' },
      { note: 27, left: 435, key: '0' }
    ];
    
    const bottomRow = this.pianoContainer.querySelector('.bottom-row')!;
    const topRow = this.pianoContainer.querySelector('.top-row')!;
    
    // Add black keys to bottom row
    bottomBlackNotes.forEach(({ note: noteOffset, left, key: keyBinding }) => {
      const key = document.createElement('div');
      key.className = 'key black-key';
      const note = (baseOctave * 12) + noteOffset;
      key.dataset.note = note.toString();
      key.style.left = `${left}px`;
      
      const label = document.createElement('div');
      label.className = 'black-key-label';
      label.textContent = keyBinding;
      key.appendChild(label);
      
      key.addEventListener('mousedown', () => this.handlePianoClick(note, true));
      key.addEventListener('mouseup', () => this.handlePianoClick(note, false));
      key.addEventListener('mouseleave', () => this.handlePianoClick(note, false));
      
      bottomRow.appendChild(key);
      this.activeKeys.set(note, key);
    });
    
    // Add black keys to top row
    topBlackNotes.forEach(({ note: noteOffset, left, key: keyBinding }) => {
      const key = document.createElement('div');
      key.className = 'key black-key';
      const note = (baseOctave * 12) + noteOffset;
      key.dataset.note = note.toString();
      key.style.left = `${left}px`;
      
      const label = document.createElement('div');
      label.className = 'black-key-label';
      label.textContent = keyBinding;
      key.appendChild(label);
      
      key.addEventListener('mousedown', () => this.handlePianoClick(note, true));
      key.addEventListener('mouseup', () => this.handlePianoClick(note, false));
      key.addEventListener('mouseleave', () => this.handlePianoClick(note, false));
      
      topRow.appendChild(key);
      this.activeKeys.set(note, key);
    });
  }

  /**
   * Updates the visual state of a piano key (active/inactive)
   * @param note - The MIDI note number to update
   * @param active - Whether the key should appear active (pressed)
   */
  updatePianoKey(note: number, active: boolean): void {
    const keyElement = this.activeKeys.get(note);
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
        <div class="kb-key white-bg" data-key="BracketRight">]</div>
      </div>
      <div class="keyboard-row">
        <div class="kb-key white-bg" data-key="KeyA">A</div>
        <div class="kb-key black-bg" data-key="KeyS">S</div>
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
        <div class="kb-key white-bg" data-key="KeyC">C</div>
        <div class="kb-key white-bg" data-key="KeyV">V</div>
        <div class="kb-key white-bg" data-key="KeyB">B</div>
        <div class="kb-key white-bg" data-key="KeyN">N</div>
        <div class="kb-key white-bg" data-key="KeyM">M</div>
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
        <div class="kb-key white-bg" data-key="Digit1">1</div>
        <div class="kb-key black-bg" data-key="Digit2">2</div>
        <div class="kb-key black-bg" data-key="Digit3">3</div>
        <div class="kb-key white-bg" data-key="Digit4">4</div>
        <div class="kb-key black-bg" data-key="Digit5">5</div>
        <div class="kb-key black-bg" data-key="Digit6">6</div>
        <div class="kb-key black-bg" data-key="Digit7">7</div>
        <div class="kb-key white-bg" data-key="Digit8">8</div>
        <div class="kb-key black-bg" data-key="Digit9">9</div>
        <div class="kb-key black-bg" data-key="Digit0">0</div>
        <div class="kb-key control-key" data-key="Minus">- ↓</div>
        <div class="kb-key control-key" data-key="Equal">= ↑</div>
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
      </div>
      <div class="keyboard-row">
        <div class="kb-key white-bg" data-key="KeyA">A</div>
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
        <div class="kb-key control-key wide" data-key="Space">SPACE (Sustain)</div>
      </div>
    `;
  }

  /**
   * Updates the visual state of a keyboard mapping key
   * @param keyCode - The key code to update (e.g., 'KeyA')
   * @param active - Whether the key should appear active (pressed)
   */
  updateKeyVisual(keyCode: string, active: boolean): void {
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
   * Internal handler for piano click events
   * @param note - The MIDI note number
   * @param down - Whether the key is being pressed down
   */
  private handlePianoClick: (note: number, down: boolean) => void = () => {};
  
  /**
   * Sets the handler for piano click events
   * @param handler - Function called when piano keys are clicked
   */
  onPianoClick(handler: (note: number, down: boolean) => void): void {
    this.handlePianoClick = handler;
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
}