import { ArpeggiatorState, ArpeggiatorPattern, IMidiEngine } from './types';
import { ClockSync } from './clock-sync';

/**
 * Arpeggiator that syncs to external MIDI clock
 * Generates arpeggio patterns based on held notes and external timing
 * 
 * NEW FEATURE: Sliding Window Mode
 * - notesPerStep: Controls how many notes play per tick
 *   - 1 = Traditional single-note arpeggiator
 *   - 2+ = Sliding window (plays multiple adjacent notes)
 * - slidingOverlap: Controls window movement
 *   - true = Window slides by 1 (overlapping)
 *   - false = Window jumps by notesPerStep (non-overlapping)
 */
export class Arpeggiator {
  private state: ArpeggiatorState = {
    enabled: false,
    pattern: 'up',
    rate: 120,
    gateLength: 0.5,
    swing: 0,
    octaveRange: 1,
    noteOrder: [],
    currentStep: 0,
    syncToClock: true,
    clockDivisor: 4, // 16th notes by default
    notesPerStep: 1, // NEW: How many notes to play per tick (1 = traditional)
    slidingOverlap: true // NEW: If true, window slides by 1; if false, jumps by notesPerStep
  };

  private pressOrder: number[] = []; // Maintains the order in which notes were pressed
  private clockSync: ClockSync;
  private midiEngine: IMidiEngine | null = null;
  private onStepCallbacks: ((step: number, note: number) => void)[] = [];
  private activeTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  private heldNoteTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastProcessedTick: number = -1;
  private getChannel: (() => number) | null = null;
  private getVelocity: (() => number) | null = null;
  private internalTimer: ReturnType<typeof setInterval> | null = null;

  constructor(clockSync: ClockSync) {
    this.clockSync = clockSync;
    this.setupClockSync();
  }

  /**
   * Simplified clock sync setup - clock manages both playing AND stepping
   */
  private setupClockSync(): void {
    this.clockSync.onTick(() => {
      // If an external clock is running, stop any internal fallback timer
      if (this.internalTimer) {
        this.stopInternalTimer();
      }

      const currentTick = this.clockSync.getTicks();
    
      // De-duplicate ticks in case multiple listeners are attached
      if (currentTick === this.lastProcessedTick) {
        return;
      }
      this.lastProcessedTick = currentTick;
    
      if (this.state.enabled && this.state.syncToClock) {
        const ticksPerStep = Math.floor(24 / this.state.clockDivisor);
        if (currentTick % ticksPerStep === 0) {
          // Clock handles the sequence
          this.playCurrentStep();
          this.advanceStep();
        }
      }
    });

    this.clockSync.onStart(() => {
      if (this.state.enabled) {
        this.state.currentStep = 0;
        this.lastProcessedTick = -1;
        this.stopInternalTimer();
      }
    });

    // When external clock stops, fall back to internal timer so arpeggiator keeps running
    this.clockSync.onStop(() => {
      if (this.state.enabled) {
        this.startInternalTimer();
      }
    });
  }

  /**
   * Re-attaches clock sync event handlers after a clock callback reset
   */
  reattachClockSync(): void {
    this.setupClockSync();
  }

  /**
   * Sets the MIDI engine for sending notes
   */
  setMidiEngine(midiEngine: IMidiEngine): void {
    this.midiEngine = midiEngine;
  }

  /**
   * Inject getters to fetch live channel/velocity from UI
   */
  setParamGetters(getChannel: () => number, getVelocity: () => number): void {
    this.getChannel = getChannel;
    this.getVelocity = getVelocity;
  }

  /**
   * Enables or disables the arpeggiator
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    if (!enabled) {
      this.clearAllTimeouts();
      this.stopAllNotes();
      this.state.currentStep = 0;
      this.stopInternalTimer();
      return;
    }
    
    // If no external clock is running, start an internal timer so the arp still plays
    this.refreshTimingSource();
  }

  /**
   * Sets the arpeggiator pattern
   */
  setPattern(pattern: ArpeggiatorPattern): void {
    if (this.state.pattern !== pattern) {
      this.state.pattern = pattern;
      this.updateNoteOrder();
      this.state.currentStep = 0;
    }
  }

  /**
   * Sets the clock division (1=quarter, 2=8th, 4=16th, 8=32nd)
   */
  setClockDivisor(divisor: number): void {
    this.state.clockDivisor = divisor;
    this.refreshTimingSource();
  }

  /**
   * Sets the gate length (0-1)
   */
  setGateLength(gateLength: number): void {
    this.state.gateLength = Math.max(0, Math.min(1, gateLength));
  }

  /**
   * Sets the swing amount (0-1)
   */
  setSwing(swing: number): void {
    this.state.swing = Math.max(0, Math.min(1, swing));
  }

  /**
   * Sets the octave range
   */
  setOctaveRange(octaveRange: number): void {
    this.state.octaveRange = Math.max(1, Math.min(4, octaveRange));
    this.updateNoteOrder();
  }

  /**
   * Sets the number of notes to play per step (sliding window size)
   * @param notesPerStep - Number of notes to play simultaneously (1 = traditional arpeggiator)
   */
  setNotesPerStep(notesPerStep: number): void {
    this.state.notesPerStep = Math.max(1, Math.floor(notesPerStep));
  }

  /**
   * Sets whether the sliding window overlaps or jumps
   * @param overlap - If true, window slides by 1; if false, window jumps by notesPerStep
   */
  setSlidingWindowOverlap(overlap: boolean): void {
    this.state.slidingOverlap = overlap;
  }

  /**
   * Sets the held notes for the arpeggio (legacy method for compatibility)
   */
  setNotes(notes: number[]): void {
    this.pressOrder = [...notes];
    this.updateNoteOrder();
  }

  /**
   * Adds a note to the arpeggio in press order
   */
  addNote(note: number): void {
    if (this.pressOrder.includes(note)) return;
    this.pressOrder.push(note);
    this.updateNoteOrder();
  }

  /**
   * Removes a note from the arpeggio while preserving press order
   */
  removeNote(note: number): void {
    const index = this.pressOrder.indexOf(note);
    if (index !== -1) {
      this.pressOrder.splice(index, 1);
      this.updateNoteOrder();
    }
  }

  /**
   * Clears all held notes and resets the sequence
   */
  clearNotes(): void {
    this.pressOrder = [];
    this.state.noteOrder = [];
    this.state.currentStep = 0;
  }

  /**
   * SIMPLIFIED: Just plays the current step - no advancement logic
   * NEW: Supports sliding window with notesPerStep parameter
   */
  private playCurrentStep(): void {
    if (this.state.noteOrder.length === 0) return;

    try {
      if (!this.midiEngine) {
        console.warn('MIDI engine not connected to arpeggiator');
        return;
      }

      const channel = this.getChannel ? this.getChannel() : 1;
      const velocity = this.getVelocity ? this.getVelocity() : 80;
      const stepTimeMs = this.getStepTimeMs();
      const gateTime = Math.min(this.calculateGateTime(), Math.max(0, stepTimeMs - 2)); // leave a tiny headroom to avoid overlap

      if (this.state.pattern === 'chord' || this.state.pattern === 'stacked-chord') {
        // Chord modes: play ALL notes simultaneously (ignores notesPerStep)
        const notesToPlay = this.state.pattern === 'chord'
          ? [...this.state.noteOrder]
          : this.getStackedChordNotes();

        notesToPlay.forEach(note => {
          this.playNoteWithGate(note, velocity, channel, gateTime);
          this.onStepCallbacks.forEach(callback => {
            try {
              callback(this.state.currentStep, note);
            } catch (error) {
              console.error('Error in arpeggiator step callback:', error);
            }
          });
        });
        
      } else {
        // Pattern modes: play notesPerStep notes at a time (sliding window)
        const notesToPlay: number[] = [];
        const sequenceLength = this.state.noteOrder.length;
        
        // Collect notesPerStep notes starting from currentStep
        for (let i = 0; i < this.state.notesPerStep && i < sequenceLength; i++) {
          const noteIndex = (this.state.currentStep + i) % sequenceLength;
          notesToPlay.push(this.state.noteOrder[noteIndex]);
        }

        // Play all notes in the window
        notesToPlay.forEach(note => {
          this.playNoteWithGate(note, velocity, channel, gateTime);

          this.onStepCallbacks.forEach(callback => {
            try {
              callback(this.state.currentStep, note);
            } catch (error) {
              console.error('Error in arpeggiator step callback:', error);
            }
          });
        });
      }
    } catch (error) {
      console.error('Error playing arpeggiator step:', error);
    }
  }

  /**
   * Build stacked chord notes from noteOrder
   */
  private getStackedChordNotes(): number[] {
    const baseNotes = this.state.pattern === 'timeline' 
      ? [...this.pressOrder]
      : [...this.pressOrder].sort((a, b) => a - b);
      
    const layers = [-12, 0, 12];
    const seen = new Set<number>();
    const result: number[] = [];
    
    baseNotes.forEach(base => {
      layers.forEach(off => {
        const n = base + off;
        if (n >= 0 && n <= 127 && !seen.has(n)) {
          seen.add(n);
          result.push(n);
        }
      });
    });
    
    return result;
  }

  /**
   * Updates the note order based on pattern
   * FIXED: Always ensures currentStep is valid
   */
  private updateNoteOrder(): void {
    if (this.pressOrder.length === 0) {
      this.state.noteOrder = [];
      this.state.currentStep = 0;
      return;
    }

    let baseNotes: number[];
    
    if (this.state.pattern === 'timeline') {
      baseNotes = [...this.pressOrder];
    } else {
      baseNotes = [...this.pressOrder].sort((a, b) => a - b);
    }
    
    // Generate notes for each octave
    const notes: number[] = [];
    for (let octave = 0; octave < this.state.octaveRange; octave++) {
      baseNotes.forEach(note => {
        const n = note + (octave * 12);
        if (n >= 0 && n <= 127) notes.push(n);
      });
    }

    // Apply pattern transformations
    switch (this.state.pattern) {
      case 'timeline':
        this.state.noteOrder = [...notes];
        break;
      case 'up':
        this.state.noteOrder = [...notes];
        break;
      case 'down':
        this.state.noteOrder = [...notes].reverse();
        break;
      case 'up-down': {
        if (notes.length <= 1) {
          this.state.noteOrder = [...notes];
        } else {
          // Ascend fully, then descend excluding the first and last endpoints to prevent duplicates at wrap
          this.state.noteOrder = [...notes, ...notes.slice(1, -1).reverse()];
        }
        break;
      }
      case 'down-up': {
        if (notes.length <= 1) {
          this.state.noteOrder = [...notes];
        } else {
          // Descend fully, then ascend excluding the first and last endpoints to prevent duplicates at wrap
          this.state.noteOrder = [...notes].reverse().concat(notes.slice(1, -1));
        }
        break;
      }
      case 'random':
        this.state.noteOrder = [...notes].sort(() => Math.random() - 0.5);
        break;
      case 'chord':
      case 'stacked-chord':
        this.state.noteOrder = notes;
        break;
    }

    // Ensure currentStep is always valid
    if (this.state.noteOrder.length > 0 && this.state.currentStep >= this.state.noteOrder.length) {
      this.state.currentStep = this.state.currentStep % this.state.noteOrder.length;
    }
  }

  /**
   * Calculates gate time based on BPM and gate length
   */
  private calculateGateTime(): number {
    const bpm = this.getEffectiveBPM();
    const beatTime = (60 / bpm) * 1000; // ms per quarter note
    const stepTime = beatTime / this.state.clockDivisor;
    return stepTime * this.state.gateLength;
  }

  /**
   * Returns the duration (ms) of a single step at the current tempo/division
   */
  private getStepTimeMs(): number {
    const bpm = this.getEffectiveBPM();
    const beatTime = (60 / bpm) * 1000; // ms per quarter note
    return beatTime / this.state.clockDivisor;
  }

  /**
   * Uses external clock BPM when running; otherwise falls back to internal rate
   */
  private getEffectiveBPM(): number {
    return this.clockSync.isRunning() ? this.clockSync.getBPM() : this.state.rate;
  }

  /**
   * Plays a single note and ensures it is stopped correctly on the same channel.
   * Also prevents overlaps by force-stopping a previous instance of the same note/channel
   * before retriggering, and tracks the timeout so it can be cancelled later.
   */
  private playNoteWithGate(note: number, velocity: number, channel: number, gateTime: number): void {
    const key = `${note}:${channel}`;

    // If this note is already gated on this channel, stop it before retriggering
    const existing = this.heldNoteTimeouts.get(key);
    if (existing) {
      clearTimeout(existing);
      this.activeTimeouts.delete(existing);
      this.heldNoteTimeouts.delete(key);
      try {
        if (this.midiEngine) {
          this.midiEngine.stopNote(note, 0, channel);
        }
      } catch (error) {
        console.error('Error force-stopping active note:', error);
      }
    }

    // Start note
    this.midiEngine!.playNote(note, velocity, channel);

    // Schedule stop on the same channel (no re-fetching the channel)
    const timeout = setTimeout(() => {
      this.activeTimeouts.delete(timeout);
      this.heldNoteTimeouts.delete(key);
      try {
        if (this.midiEngine && this.state.enabled) {
          this.midiEngine.stopNote(note, 0, channel);
        }
      } catch (error) {
        console.error('Error stopping arpeggiator note:', error);
      }
    }, gateTime);

    this.activeTimeouts.add(timeout);
    this.heldNoteTimeouts.set(key, timeout);
  }

  /**
   * Advances to the next step in the sequence
   * NEW: Supports both overlapping and non-overlapping sliding windows
   */
  private advanceStep(): void {
    if (this.state.noteOrder.length === 0) return;
    
    // Determine step increment based on sliding window mode
    const stepIncrement = this.state.slidingOverlap ? 1 : this.state.notesPerStep;
    this.state.currentStep = (this.state.currentStep + stepIncrement) % this.state.noteOrder.length;
  }

  /**
   * Stops all currently playing notes
   */
  private stopAllNotes(): void {
    this.heldNoteTimeouts.clear();
    if (!this.midiEngine) return;

    const channel = this.getChannel ? this.getChannel() : 1;
    // Stop all possible MIDI notes to ensure nothing is left hanging
    for (let note = 0; note <= 127; note++) {
      this.midiEngine.stopNote(note, 0, channel);
    }
  }

  /**
   * Clears all active timeouts
   */
  private clearAllTimeouts(): void {
    
      // Cancel scheduled note-off events
      this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
      this.activeTimeouts.clear();
    
      // Immediately stop any notes that are still held (across all channels we started)
      if (this.midiEngine) {
        this.heldNoteTimeouts.forEach((_, key) => {
          const [noteStr, chStr] = key.split(':');
          const note = Number(noteStr);
          const channel = Number(chStr);
          try {
            this.midiEngine?.stopNote(note, 0, channel);
          } catch (error) {
            console.error('Error force-stopping note during timeout clear:', error);
          }
        });
      }
      this.heldNoteTimeouts.clear();
    
  }

  /**
   * Gets the current arpeggiator state
   */
  getState(): ArpeggiatorState {
    return { ...this.state };
  }

  /**
   * Gets the current step
   */
  getCurrentStep(): number {
    return this.state.currentStep;
  }

  /**
   * Gets the current note order
   */
  getNoteOrder(): number[] {
    return [...this.state.noteOrder];
  }

  /**
   * Gets the current number of notes per step
   */
  getNotesPerStep(): number {
    return this.state.notesPerStep;
  }

  /**
   * Checks if arpeggiator is enabled
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * Registers a callback for step events
   */
  onStep(callback: (step: number, note: number) => void): void {
    this.onStepCallbacks.push(callback);
  }

  /**
   * Starts an internal interval-based clock when no external clock is available
   */
  private startInternalTimer(): void {
    // Avoid double-starting
    this.stopInternalTimer();

    // Keep a sensible lower bound to avoid zero/NaN intervals
    const interval = Math.max(10, this.getStepTimeMs());
    this.internalTimer = setInterval(() => {
      // If an external clock becomes available, stop the fallback timer
      if (this.state.syncToClock && this.clockSync.isRunning()) {
        this.stopInternalTimer();
        return;
      }

      if (!this.state.enabled) return;
      this.playCurrentStep();
      this.advanceStep();
    }, interval);
  }

  /**
   * Stops the internal fallback timer if running
   */
  private stopInternalTimer(): void {
    if (this.internalTimer) {
      clearInterval(this.internalTimer);
      this.internalTimer = null;
    }
  }

  /**
   * Decides whether to use the external clock or internal timer and (re)starts appropriately
   */
  private refreshTimingSource(): void {
    if (!this.state.enabled) {
      this.stopInternalTimer();
      return;
    }

    if (this.clockSync.isRunning()) {
      this.stopInternalTimer();
    } else {
      this.startInternalTimer();
    }
  }

  /**
   * Removes all step callbacks
   */
  clearStepCallbacks(): void {
    this.onStepCallbacks = [];
  }
}
