/**
 * Manages multiple MIDI input sources and coordinates their activation
 * Only one input source is active at a time
 */

import { IMIDIInputSource } from './input-source';
import { KeyboardInput } from './keyboard-input';
import { AudioInput, AudioInputConfig } from './audio-input';

export type InputSourceType = 'keyboard' | 'audio';

export interface InputSourceInfo {
  type: InputSourceType;
  name: string;
  description: string;
}

/**
 * Input source manager that handles multiple input sources
 * Coordinates activation/deactivation and event routing
 */
export class InputSourceManager {
  private sources: Map<InputSourceType, IMIDIInputSource> = new Map();
  private activeSourceType: InputSourceType = 'keyboard';

  // Unified callbacks that route from active source to MIDIController
  private noteOnHandler: ((note: number, velocity: number) => void) | null = null;
  private noteOffHandler: ((note: number) => void) | null = null;
  private specialEventHandlers: Map<string, (...args: any[]) => void> = new Map();

  constructor() {
    // Create keyboard input source (always available)
    const keyboardInput = new KeyboardInput();
    this.sources.set('keyboard', keyboardInput);

    // Setup routing for keyboard input
    this.setupSourceRouting(keyboardInput);

    // Audio input will be created on-demand when user switches to it
  }

  /**
   * Initializes all input sources
   */
  async initialize(): Promise<void> {
    // Initialize keyboard input
    const keyboard = this.sources.get('keyboard');
    if (keyboard) {
      await keyboard.initialize();
      keyboard.setActive(true);
    }
  }

  /**
   * Sets up event routing from an input source to the unified handlers
   */
  private setupSourceRouting(source: IMIDIInputSource): void {
    // Route note on events
    source.onNoteOn((note: number, velocity: number) => {
      if (source.isActive() && this.noteOnHandler) {
        this.noteOnHandler(note, velocity);
      }
    });

    // Route note off events
    source.onNoteOff((note: number) => {
      if (source.isActive() && this.noteOffHandler) {
        this.noteOffHandler(note);
      }
    });

    // Route special events
    this.specialEventHandlers.forEach((handler, action) => {
      source.onSpecialEvent(action, (...args: any[]) => {
        if (source.isActive()) {
          handler(...args);
        }
      });
    });
  }

  /**
   * Switches to a different input source
   */
  async switchInputSource(type: InputSourceType): Promise<void> {
    if (type === this.activeSourceType) {
      return; // Already active
    }

    // Deactivate current source
    const currentSource = this.sources.get(this.activeSourceType);
    if (currentSource) {
      currentSource.setActive(false);
    }

    // Create audio input if it doesn't exist
    if (type === 'audio' && !this.sources.has('audio')) {
      try {
        const audioInput = new AudioInput({
          amplitudeThreshold: 0.02,
          pitchThreshold: 0.1,
          smoothingWindow: 3,
          minNoteDuration: 50,
          minVelocity: 40,
          maxVelocity: 127
        });

        await audioInput.initialize();
        this.sources.set('audio', audioInput);
        this.setupSourceRouting(audioInput);
      } catch (error) {
        console.error('Failed to initialize audio input:', error);
        throw error;
      }
    }

    // Activate new source
    const newSource = this.sources.get(type);
    if (newSource) {
      newSource.setActive(true);
      this.activeSourceType = type;
    }
  }

  /**
   * Gets the currently active input source
   */
  getActiveSource(): IMIDIInputSource | undefined {
    return this.sources.get(this.activeSourceType);
  }

  /**
   * Gets the active source type
   */
  getActiveSourceType(): InputSourceType {
    return this.activeSourceType;
  }

  /**
   * Gets a specific input source
   */
  getSource(type: InputSourceType): IMIDIInputSource | undefined {
    return this.sources.get(type);
  }

  /**
   * Gets information about available input sources
   */
  getAvailableSources(): InputSourceInfo[] {
    return [
      {
        type: 'keyboard',
        name: 'QWERTY Keyboard',
        description: 'Play notes using your computer keyboard'
      },
      {
        type: 'audio',
        name: 'Microphone (Audio-to-MIDI)',
        description: 'Play notes by singing or playing an instrument into your microphone'
      }
    ];
  }

  /**
   * Registers a unified note on handler
   */
  onNoteOn(handler: (note: number, velocity: number) => void): void {
    this.noteOnHandler = handler;
  }

  /**
   * Registers a unified note off handler
   */
  onNoteOff(handler: (note: number) => void): void {
    this.noteOffHandler = handler;
  }

  /**
   * Registers a special event handler (sustain, octave, mod wheel, etc.)
   */
  onSpecialEvent(action: string, handler: (...args: any[]) => void): void {
    this.specialEventHandlers.set(action, handler);

    // Register with all existing sources
    this.sources.forEach(source => {
      source.onSpecialEvent(action, (...args: any[]) => {
        if (source.isActive()) {
          handler(...args);
        }
      });
    });
  }

  /**
   * Gets the keyboard input source for direct access
   * Used for layout switching and other keyboard-specific features
   */
  getKeyboardInput(): KeyboardInput | undefined {
    return this.sources.get('keyboard') as KeyboardInput | undefined;
  }

  /**
   * Gets the audio input source for direct access
   * Used for configuration and advanced audio settings
   */
  getAudioInput(): AudioInput | undefined {
    return this.sources.get('audio') as AudioInput | undefined;
  }

  /**
   * Updates audio input configuration
   */
  setAudioConfig(config: Partial<AudioInputConfig>): void {
    const audioInput = this.getAudioInput();
    if (audioInput) {
      audioInput.setConfig(config);
    }
  }

  /**
   * Cleans up all input sources
   */
  cleanup(): void {
    this.sources.forEach(source => {
      source.cleanup();
    });
    this.sources.clear();
    this.noteOnHandler = null;
    this.noteOffHandler = null;
    this.specialEventHandlers.clear();
  }

  /**
   * Resumes all input sources after suspend
   */
  async resume(): Promise<void> {
    // Re-initialize all sources
    for (const [type, source] of this.sources) {
      try {
        await source.initialize();
        source.setActive(type === this.activeSourceType);
      } catch (error) {
        console.error(`Failed to resume ${type} input:`, error);
      }
    }
  }
}
