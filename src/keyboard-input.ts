import { KeyboardLayout } from './types';

/**
 * Handles keyboard input and maps QWERTY keys to MIDI notes
 * Manages different keyboard layouts and provides event handling for note on/off events
 */
export class KeyboardInput {
  private pressedKeys = new Set<string>();
  private keyDownHandlers = new Map<string, (velocity: number) => void>();
  private keyUpHandlers = new Map<string, () => void>();
  private specialKeyHandlers = new Map<string, () => void>();
  
  private currentLayout: KeyboardLayout;
  private layouts = new Map<string, KeyboardLayout>();
  private currentVelocity: number = 80;
  private latchMode: boolean = false; // Latch mode: notes stay active until re-pressed
  private latchedKeys = new Set<string>(); // Track latched note keys

  // Store bound handlers for cleanup
  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundKeyUp: (event: KeyboardEvent) => void;
  private boundContextMenu: (event: Event) => void;
  private attached = false;
  
  constructor() {
    this.initializeLayouts();
    this.currentLayout = this.layouts.get('expanded')!;
    
    // Bind handlers for cleanup
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundContextMenu = (e) => {
      if ((e.target as HTMLElement).closest('.piano-container')) {
        e.preventDefault();
      }
    };
    
    this.setupEventListeners();
    this.preventDefaultKeyBehaviors();
    this.attached = true;
  }

  /**
   * Initializes the available keyboard layouts
   * Creates mappings for Simple (1.5 octaves) and Expanded (2.5 octaves) layouts
   */
  private initializeLayouts(): void {
    // Simple layout (1.5 octaves)
    this.layouts.set('simple', {
      name: 'simple',
      keys: {
        'KeyA': 0, 'KeyW': 1, 'KeyS': 2, 'KeyE': 3, 'KeyD': 4, 'KeyF': 5,
        'KeyT': 6, 'KeyG': 7, 'KeyY': 8, 'KeyH': 9, 'KeyU': 10, 'KeyJ': 11,
        'KeyK': 12, 'KeyO': 13, 'KeyL': 14, 'KeyP': 15, 'Semicolon': 16, 
        'Quote': 17, 'BracketRight': 18
      },
      octaveDownKey: 'KeyZ',
      octaveUpKey: 'KeyX',
      blackKeyPositions: [1, 3, 6, 8, 10, 13, 15]
    });

    // Expanded layout (2.5 octaves)
    this.layouts.set('expanded', {
      name: 'expanded',
      keys: {
        // Bottom row (lower octave)
        'KeyZ': 0, 'KeyX': 2, 'KeyC': 4, 'KeyV': 5, 'KeyB': 7, 'KeyN': 9, 
        'KeyM': 11, 'Comma': 12, 'Period': 14, 'Slash': 16,
        
        // Top row (upper octave)
        'KeyQ': 12, 'KeyW': 14, 'KeyE': 16, 'KeyR': 17, 'KeyT': 19, 
        'KeyY': 21, 'KeyU': 23, 'KeyI': 24, 'KeyO': 26, 'KeyP': 28,
        'BracketLeft': 29, 'Equal': 30, 'BracketRight': 31,
        
        // Black keys for bottom row
        'KeyS': 1, 'KeyD': 3, 'KeyG': 6, 'KeyH': 8, 'KeyJ': 10,
        'KeyL': 13, 'Semicolon': 15,
        
        // Black keys for top row
        'Digit2': 13, 'Digit3': 15, 'Digit5': 18, 'Digit6': 20, 
        'Digit7': 22, 'Digit9': 25, 'Digit0': 27
      },
      octaveDownKey: 'ArrowLeft',
      octaveUpKey: 'ArrowRight',
      blackKeyPositions: [1, 3, 6, 8, 10, 13, 15, 18, 20, 22, 25, 27, 30]
    });
  }

  /**
   * Sets up global keyboard event listeners for keydown and keyup events
   */
  private setupEventListeners(): void {
    // Use capture phase for keydown to ensure preventDefault runs first
    document.addEventListener('keydown', this.boundKeyDown, { capture: true });
    document.addEventListener('keyup', this.boundKeyUp);
  }

  /**
   * Prevents default browser behaviors for certain keys
   * Prevents space from scrolling and disables context menu on piano
   */
  private preventDefaultKeyBehaviors(): void {
    // Disable right-click context menu on piano
    document.addEventListener('contextmenu', this.boundContextMenu);
  }

  /**
   * Re-attaches keyboard event listeners after a cleanup
   * Safe to call multiple times; only attaches if not already attached
   */
  attach(): void {
    if (this.attached) return;
    this.setupEventListeners();
    this.preventDefaultKeyBehaviors();
    this.attached = true;
  }

  /**
   * Detaches keyboard event listeners without clearing handlers
   * Useful when temporarily disabling QWERTY control (e.g., external MIDI mode)
   */
  detach(): void {
    if (!this.attached) return;
    document.removeEventListener('keydown', this.boundKeyDown, { capture: true });
    document.removeEventListener('keyup', this.boundKeyUp);
    document.removeEventListener('contextmenu', this.boundContextMenu);
    this.pressedKeys.clear();
    this.attached = false;
  }

  /**
   * Handles keydown events and triggers appropriate note on handlers
   * Filters out modifier keys, repeated events, and input field events
   * @param event - The keyboard event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Prevent default behavior for arrow keys, space, and tab (including repeats)
    if (event.code === 'Space' || event.code === 'Tab' || 
        event.code === 'ArrowUp' || event.code === 'ArrowDown' || 
        event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      console.log(`Prevented default for ${event.code}, repeat: ${event.repeat}`);
    }
    
    // Ignore if modifier keys are pressed (except shift for velocity)
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    
    // Ignore repeated events for our app logic (but still prevent default above)
    if (this.pressedKeys.has(event.code)) return;
    
    // Ignore if typing in input field
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement) return;

    this.pressedKeys.add(event.code);

    // Check for special keys first
    if (this.specialKeyHandlers.has(event.code)) {
      event.preventDefault();
      this.specialKeyHandlers.get(event.code)!();
      return;
    }

    // Check for note keys
    const noteOffset = this.currentLayout.keys[event.code];
    if (noteOffset !== undefined) {
      event.preventDefault();

      // Latch mode: toggle behavior
      if (this.latchMode) {
        if (this.latchedKeys.has(event.code)) {
          // Key is already latched, unlatch it (turn off)
          this.latchedKeys.delete(event.code);
          this.keyUpHandlers.get(event.code)?.();
        } else {
          // Key is not latched, latch it (turn on)
          this.latchedKeys.add(event.code);
          const velocity = this.getVelocityFromEvent(event);
          this.keyDownHandlers.get(event.code)?.(velocity);
        }
      } else {
        // Normal mode: trigger note on
        const velocity = this.getVelocityFromEvent(event);
        this.keyDownHandlers.get(event.code)?.(velocity);
      }
    }

    // Check for octave control keys
    if (event.code === this.currentLayout.octaveDownKey) {
      event.preventDefault();
      this.specialKeyHandlers.get('octaveDown')?.();
    } else if (event.code === this.currentLayout.octaveUpKey) {
      event.preventDefault();
      this.specialKeyHandlers.get('octaveUp')?.();
    } else if (event.code === 'ArrowUp') {
      // Mod wheel full on while held
      event.preventDefault();
      this.specialKeyHandlers.get('modOn')?.();
    } else if (event.code === 'ArrowDown') {
      // Pitch bend full down while held
      event.preventDefault();
      this.specialKeyHandlers.get('pitchDownOn')?.();
    } else if (event.code === 'Tab') {
      // Arp division/rate boost while held
      event.preventDefault();
      this.specialKeyHandlers.get('arpBoostOn')?.();
    }
  }

  /**
   * Handles keyup events and triggers appropriate note off handlers
   * @param event - The keyboard event
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);

    // Check for note keys
    if (this.currentLayout.keys[event.code] !== undefined) {
      event.preventDefault();
      // In latch mode, key release doesn't trigger note off
      // (notes are toggled on key press instead)
      if (!this.latchMode) {
        this.keyUpHandlers.get(event.code)?.();
      }
    }

    // Check for sustain pedal
    if (event.code === 'Space') {
      event.preventDefault();
      this.specialKeyHandlers.get('sustainOff')?.();
    } else if (event.code === 'ArrowUp') {
      event.preventDefault();
      this.specialKeyHandlers.get('modOff')?.();
    } else if (event.code === 'ArrowDown') {
      event.preventDefault();
      this.specialKeyHandlers.get('pitchDownOff')?.();
    } else if (event.code === this.currentLayout.octaveDownKey) {
      event.preventDefault();
      this.specialKeyHandlers.get('octaveDownOff')?.();
    } else if (event.code === this.currentLayout.octaveUpKey) {
      event.preventDefault();
      this.specialKeyHandlers.get('octaveUpOff')?.();
    } else if (event.code === 'Tab') {
      event.preventDefault();
      this.specialKeyHandlers.get('arpBoostOff')?.();
    }
  }

  /**
   * Calculates velocity based on keyboard event
   * Shift key increases velocity to maximum (127)
   * @param event - The keyboard event
   * @returns number - Velocity value (0-127)
   */
  private getVelocityFromEvent(event: KeyboardEvent): number {
    // Shift key adds velocity
    if (event.shiftKey) {
      return 127;
    }
    // Use cached velocity from UI control
    return this.currentVelocity;
  }

  /**
   * Switches to a different keyboard layout
   * Clears pressed keys to prevent stuck notes when switching layouts
   * @param layoutName - Name of the layout to switch to ('simple' or 'expanded')
   */
  setLayout(layoutName: string): void {
    const layout = this.layouts.get(layoutName);
    if (layout) {
      this.currentLayout = layout;
      // Clear pressed keys when switching layouts
      this.pressedKeys.clear();
    }
  }

  /**
   * Gets the current layout
   */
  getLayout(): KeyboardLayout {
    return this.currentLayout;
  }

  /**
   * Gets all available keyboard layout names
   * @returns string[] - Array of available layout names
   */
  getAvailableLayouts(): string[] {
    return Array.from(this.layouts.keys());
  }

  /**
   * Registers a handler for when a specific key is pressed down
   * @param keyCode - The key code to listen for (e.g., 'KeyA')
   * @param handler - Function called when the key is pressed, receives velocity
   */
  onNoteOn(keyCode: string, handler: (velocity: number) => void): void {
    this.keyDownHandlers.set(keyCode, handler);
  }

  /**
   * Registers a handler for when a specific key is released
   * @param keyCode - The key code to listen for (e.g., 'KeyA')
   * @param handler - Function called when the key is released
   */
  onNoteOff(keyCode: string, handler: () => void): void {
    this.keyUpHandlers.set(keyCode, handler);
  }

  /**
   * Registers a handler for special keys (octave controls, sustain pedal)
   * @param action - The special action name ('octaveDown', 'octaveUp', 'sustainOn', 'sustainOff')
   * @param handler - Function called when the special key is pressed
   */
  onSpecialKey(action: string, handler: () => void): void {
    this.specialKeyHandlers.set(action, handler);
  }

  /**
   * Checks if a specific key is currently pressed
   * @param keyCode - The key code to check
   * @returns boolean - True if the key is currently pressed
   */
  isKeyPressed(keyCode: string): boolean {
    return this.pressedKeys.has(keyCode);
  }

  /**
   * Gets all currently pressed keys
   * @returns Set<string> - Set of currently pressed key codes
   */
  getPressedKeys(): Set<string> {
    return new Set(this.pressedKeys);
  }

  /**
   * Clears any tracked pressed keys (used on blur to avoid stuck keys)
   */
  resetPressedKeys(): void {
    this.pressedKeys.clear();
  }

  /**
   * Sets the current velocity value for keyboard events
   * @param velocity - The velocity value (1-127)
   */
  setVelocity(velocity: number): void {
    this.currentVelocity = Math.max(1, Math.min(127, velocity));
  }

  /**
   * Sets latch mode (toggle mode for notes)
   * @param enabled - If true, notes toggle on/off on key press; if false, normal behavior
   */
  setLatchMode(enabled: boolean): void {
    this.latchMode = enabled;
    // When disabling latch mode, clear all latched keys
    if (!enabled) {
      this.latchedKeys.forEach(keyCode => {
        this.keyUpHandlers.get(keyCode)?.();
      });
      this.latchedKeys.clear();
    }
  }

  /**
   * Gets current latch mode state
   */
  getLatchMode(): boolean {
    return this.latchMode;
  }

  /**
   * Registers the spacebar as the sustain pedal
   * Maps spacebar to sustain on/off handlers
   */
  registerSustainPedal(): void {
    this.specialKeyHandlers.set('Space', () => {
      this.specialKeyHandlers.get('sustainOn')?.();
    });
  }

  /**
   * Registers ArrowUp as Mod Wheel momentary switch
   */
  registerModWheel(): void {
    this.specialKeyHandlers.set('ArrowUp', () => {
      this.specialKeyHandlers.get('modOn')?.();
    });
  }

  /**
   * Registers ArrowDown as Pitch Bend (down) momentary switch
   */
  registerPitchBend(): void {
    this.specialKeyHandlers.set('ArrowDown', () => {
      this.specialKeyHandlers.get('pitchDownOn')?.();
    });
  }

  /**
   * Registers Tab as a momentary arpeggiator division/rate boost switch
   */
  registerArpBoost(): void {
    this.specialKeyHandlers.set('Tab', () => {
      this.specialKeyHandlers.get('arpBoostOn')?.();
    });
  }

  /**
   * Cleans up all event listeners and handlers
   * Should be called when the application is shutting down
   */
  cleanup(): void {
    // Remove all event listeners
    this.detach();
    
    // Clear all handler maps
    this.keyDownHandlers.clear();
    this.keyUpHandlers.clear();
    this.specialKeyHandlers.clear();
    this.pressedKeys.clear();
    this.attached = false;
  }
}
