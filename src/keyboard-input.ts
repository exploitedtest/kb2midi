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
  
  constructor() {
    this.initializeLayouts();
    this.currentLayout = this.layouts.get('simple')!;
    this.setupEventListeners();
    this.preventDefaultKeyBehaviors();
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
        
        // Black keys for bottom row
        'KeyS': 1, 'KeyD': 3, 'KeyG': 6, 'KeyH': 8, 'KeyJ': 10,
        'KeyL': 13, 'Semicolon': 15,
        
        // Black keys for top row
        'Digit2': 13, 'Digit3': 15, 'Digit5': 18, 'Digit6': 20, 
        'Digit7': 22, 'Digit9': 25, 'Digit0': 27
      },
      octaveDownKey: 'Minus',
      octaveUpKey: 'Equal',
      blackKeyPositions: [1, 3, 6, 8, 10, 13, 15, 18, 20, 22, 25, 27]
    });
  }

  /**
   * Sets up global keyboard event listeners for keydown and keyup events
   */
  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  /**
   * Prevents default browser behaviors for certain keys
   * Prevents space from scrolling and disables context menu on piano
   */
  private preventDefaultKeyBehaviors(): void {
    // Prevent space from scrolling
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Tab') {
        e.preventDefault();
      }
    });

    // Disable right-click context menu on piano
    document.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement).closest('.piano-container')) {
        e.preventDefault();
      }
    });
  }

  /**
   * Handles keydown events and triggers appropriate note on handlers
   * Filters out modifier keys, repeated events, and input field events
   * @param event - The keyboard event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Ignore if modifier keys are pressed (except shift for velocity)
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    
    // Ignore repeated events
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
      const velocity = this.getVelocityFromEvent(event);
      this.keyDownHandlers.get(event.code)?.(velocity);
    }

    // Check for octave control keys
    if (event.code === this.currentLayout.octaveDownKey) {
      event.preventDefault();
      this.specialKeyHandlers.get('octaveDown')?.();
    } else if (event.code === this.currentLayout.octaveUpKey) {
      event.preventDefault();
      this.specialKeyHandlers.get('octaveUp')?.();
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
      this.keyUpHandlers.get(event.code)?.();
    }

    // Check for sustain pedal
    if (event.code === 'Space') {
      event.preventDefault();
      this.specialKeyHandlers.get('sustainOff')?.();
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
    // Default velocity (will be overridden by UI control)
    return 80;
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
   * Gets the current keyboard layout configuration
   * @returns KeyboardLayout - The current layout with key mappings
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
   * Registers the spacebar as the sustain pedal
   * Maps spacebar to sustain on/off handlers
   */
  registerSustainPedal(): void {
    this.specialKeyHandlers.set('Space', () => {
      this.specialKeyHandlers.get('sustainOn')?.();
    });
  }
}