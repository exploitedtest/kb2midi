import { ArpeggiatorState, ArpeggiatorPattern, IMidiEngine } from './types';
import { ClockSync } from './clock-sync';

/**
 * Arpeggiator that syncs to external MIDI clock
 * Generates arpeggio patterns based on held notes and external timing
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
    clockDivisor: 4 // 16th notes by default
  };

  private heldNotes: number[] = [];
  private clockSync: ClockSync;
  private midiEngine: IMidiEngine | null = null;
  private onStepCallbacks: ((step: number, note: number) => void)[] = [];
  private activeTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

  constructor(clockSync: ClockSync) {
    this.clockSync = clockSync;
    this.setupClockSync();
  }

  /**
   * Sets up clock sync event handlers
   */
  private setupClockSync(): void {
    // Use tick-based sync for proper clock division
    this.clockSync.onTick(() => {
      if (this.state.enabled && this.state.syncToClock) {
        // Calculate ticks per step based on clock divisor
        // clockDivisor: 1=quarter, 2=8th, 4=16th, 8=32nd
        const ticksPerStep = Math.floor(24 / this.state.clockDivisor);
        
        // Apply swing by alternating step timing
        const currentTick = this.clockSync.getTicks();
        const stepInDivision = Math.floor(currentTick / ticksPerStep);
        const isSwingStep = stepInDivision % 2 === 1; // Every other step
        
        let shouldPlay = currentTick % ticksPerStep === 0;
        
        // Apply swing delay to off-beat steps
        if (this.state.swing > 0 && isSwingStep) {
          // 0.25 = max 25% delay for swing feel (typical swing range)
          const swingDelay = Math.floor(ticksPerStep * this.state.swing * 0.25);
          shouldPlay = (currentTick + swingDelay) % ticksPerStep === 0;
        }
        
        if (shouldPlay) {
          this.playCurrentStep();
          this.advanceStep();
        }
      }
    });

    // Reset on start
    this.clockSync.onStart(() => {
      if (this.state.enabled) {
        this.state.currentStep = 0;
      }
    });
  }

  /**
   * Sets the MIDI engine for sending notes
   */
  setMidiEngine(midiEngine: IMidiEngine): void {
    this.midiEngine = midiEngine;
  }

  /**
   * Enables or disables the arpeggiator
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    if (!enabled) {
      this.clearAllTimeouts();
      this.stopAllNotes();
    }
  }

  /**
   * Sets the arpeggiator pattern
   */
  setPattern(pattern: ArpeggiatorPattern): void {
    this.state.pattern = pattern;
    this.updateNoteOrder();
  }

  /**
   * Sets the clock division (1=quarter, 2=8th, 4=16th, 8=32nd)
   */
  setClockDivisor(divisor: number): void {
    this.state.clockDivisor = divisor;
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
   * Sets the held notes for the arpeggio
   */
  setNotes(notes: number[]): void {
    this.heldNotes = [...notes];
    this.updateNoteOrder();
  }

  /**
   * Updates the note order based on pattern and held notes
   */
  private updateNoteOrder(): void {
    if (this.heldNotes.length === 0) {
      this.state.noteOrder = [];
      return;
    }

    const notes: number[] = [];
    
    // Generate notes for each octave
    for (let octave = 0; octave < this.state.octaveRange; octave++) {
      this.heldNotes.forEach(note => {
        notes.push(note + (octave * 12));
      });
    }

    // Apply pattern
    switch (this.state.pattern) {
      case 'up':
        this.state.noteOrder = [...notes];
        break;
      case 'down':
        this.state.noteOrder = [...notes].reverse();
        break;
      case 'up-down':
        this.state.noteOrder = [...notes, ...notes.slice(0, -1).reverse()];
        break;
      case 'down-up':
        this.state.noteOrder = [...notes].reverse().concat(notes.slice(1));
        break;
      case 'random':
        this.state.noteOrder = [...notes].sort(() => Math.random() - 0.5);
        break;
      case 'chord':
        this.state.noteOrder = notes;
        break;
    }
  }

  /**
   * Plays the current step of the arpeggio
   */
  private playCurrentStep(): void {
    if (this.state.noteOrder.length === 0) return;

    try {
      const note = this.state.noteOrder[this.state.currentStep % this.state.noteOrder.length];
      
      if (!this.midiEngine) {
        console.warn('MIDI engine not connected to arpeggiator');
        return;
      }

      this.midiEngine.playNote(note, 80, 1); // Default velocity and channel

      // Trigger callbacks
      this.onStepCallbacks.forEach(callback => {
        try {
          callback(this.state.currentStep, note);
        } catch (error) {
          console.error('Error in arpeggiator step callback:', error);
        }
      });

      // Schedule note off based on gate length
      const gateTime = this.calculateGateTime();
      const timeout = setTimeout(() => {
        this.activeTimeouts.delete(timeout);
        try {
          if (this.midiEngine && this.state.enabled) {
            this.midiEngine.stopNote(note, 0, 1);
          }
        } catch (error) {
          console.error('Error stopping arpeggiator note:', error);
        }
      }, gateTime);
      
      this.activeTimeouts.add(timeout);
    } catch (error) {
      console.error('Error playing arpeggiator step:', error);
    }
  }

  /**
   * Calculates gate time based on BPM and gate length
   */
  private calculateGateTime(): number {
    const bpm = this.clockSync.getBPM();
    const beatTime = (60 / bpm) * 1000; // ms per quarter note
    const stepTime = beatTime / this.state.clockDivisor; // duration of one step
    return stepTime * this.state.gateLength;
  }

  /**
   * Advances to the next step
   */
  private advanceStep(): void {
    this.state.currentStep++;
  }

  /**
   * Stops all currently playing arpeggio notes
   */
  private stopAllNotes(): void {
    if (!this.midiEngine) return;
    
    this.state.noteOrder.forEach(note => {
      this.midiEngine!.stopNote(note, 0, 1);
    });
  }

  /**
   * Clears all active timeouts to prevent memory leaks
   */
  private clearAllTimeouts(): void {
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts.clear();
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
   * Removes all step callbacks
   */
  clearStepCallbacks(): void {
    this.onStepCallbacks = [];
  }
} 