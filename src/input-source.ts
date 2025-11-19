/**
 * Abstract interface for MIDI input sources
 * Allows multiple input methods (keyboard, microphone, etc.) to be used interchangeably
 */

export interface MIDINoteEvent {
  note: number;
  velocity: number;
}

/**
 * Base interface for all input sources that generate MIDI notes
 * Input sources emit note on/off events that flow through the arpeggiator and MIDI engine
 */
export interface IMIDIInputSource {
  /**
   * Called when the input source is activated
   * Should set up any necessary resources (event listeners, audio streams, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Called when the input source is deactivated
   * Should clean up all resources
   */
  cleanup(): void;

  /**
   * Registers a callback for note on events
   * @param handler - Function called when a note should be played
   */
  onNoteOn(handler: (note: number, velocity: number) => void): void;

  /**
   * Registers a callback for note off events
   * @param handler - Function called when a note should be stopped
   */
  onNoteOff(handler: (note: number) => void): void;

  /**
   * Registers a callback for special events (sustain, mod wheel, pitch bend, etc.)
   * @param action - The special action name
   * @param handler - Function called when the special action is triggered
   */
  onSpecialEvent(action: string, handler: (...args: any[]) => void): void;

  /**
   * Gets the display name of this input source
   */
  getName(): string;

  /**
   * Gets the current state of the input source
   */
  isActive(): boolean;

  /**
   * Sets whether this input source is currently active
   * Active sources process input, inactive ones are paused
   */
  setActive(active: boolean): void;
}

/**
 * Configuration options for input sources
 */
export interface InputSourceConfig {
  /** Minimum velocity value (1-127) */
  minVelocity?: number;
  /** Maximum velocity value (1-127) */
  maxVelocity?: number;
  /** Default velocity when velocity sensing is not available */
  defaultVelocity?: number;
}
