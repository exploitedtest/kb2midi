import { ClockSyncState } from './types';

export type ClockSource = 'external' | 'internal';

/**
 * Handles both external MIDI clock synchronization and internal clock generation
 * Receives MIDI clock messages from DAW or generates internal clock for arpeggiator
 */
export class ClockSync {
  private state: ClockSyncState = {
    isRunning: false,
    ticks: 0,
    bpm: 120,
    status: 'stopped',
    lastTickTime: -1 // -1 sentinel so the first interval is measured on the second tick
  };

  private clockSource: ClockSource = 'external';
  private internalBPM: number = 120;
  private internalClockInterval: ReturnType<typeof setInterval> | null = null;
  private internalTickInterval: number = 0; // Interval in ms between ticks

  private onTickCallbacks: (() => void)[] = [];
  private onQuarterNoteCallbacks: (() => void)[] = [];
  private onSixteenthNoteCallbacks: (() => void)[] = [];
  private onStartCallbacks: (() => void)[] = [];
  private onStopCallbacks: (() => void)[] = [];
  private tickIntervals: number[] = [];
  private readonly MAX_INTERVALS = 10;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly STOP_TIMEOUT_MS = 500; // consider stopped if no clock for 0.5s
  // Drop implausibly fast duplicate ticks (e.g., burst duplicates from drivers)
  private readonly MIN_TICK_INTERVAL_MS = 3; // ~833 BPM ceiling per MIDI clock tick

  /**
   * Handles incoming MIDI clock tick (0xF8)
   * Calculates BPM and triggers timing events
   */
  onMIDIClockTick(nowArg?: number): void {
    const now = typeof nowArg === 'number' ? nowArg : performance.now();
    
    // If ticks arrive without explicit Start/Continue, consider clock running
    if (!this.state.isRunning) {
      this.state.isRunning = true;
      this.state.status = 'synced';
      this.onStartCallbacks.forEach(callback => callback());
    }

    if (this.state.lastTickTime >= 0) {
      const tickInterval = now - this.state.lastTickTime;

      // Filter out unrealistically fast intervals which indicate duplicate delivery
      if (tickInterval < this.MIN_TICK_INTERVAL_MS) {
        this.state.lastTickTime = now;
        return;
      }
      this.tickIntervals.push(tickInterval);
      
      if (this.tickIntervals.length > this.MAX_INTERVALS) {
        this.tickIntervals.shift();
      }
      
      // Calculate average interval for stability
      if (this.tickIntervals.length >= 3) { // Need at least 3 samples
        const avgInterval = this.tickIntervals.reduce((a, b) => a + b) / this.tickIntervals.length;
        const ticksPerSecond = 1000 / avgInterval;
        this.state.bpm = Math.round((ticksPerSecond * 60) / 24);
      }
    }
    
    this.state.lastTickTime = now;
    this.state.ticks++;

    // Trigger tick callbacks
    this.onTickCallbacks.forEach(callback => callback());
    
    // Every 24 ticks = quarter note
    if (this.state.ticks % 24 === 0) {
      this.onQuarterNoteCallbacks.forEach(callback => callback());
    }
    
    // Every 6 ticks = sixteenth note
    if (this.state.ticks % 6 === 0) {
      this.onSixteenthNoteCallbacks.forEach(callback => callback());
    }

    // Reset stop timeout on each tick
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
    }
    this.stopTimeout = setTimeout(() => {
      this.state.isRunning = false;
      this.state.status = 'stopped';
      this.state.lastTickTime = -1;
      this.tickIntervals = [];
      this.onStopCallbacks.forEach(callback => callback());
    }, this.STOP_TIMEOUT_MS);
  }

  /**
   * Handles MIDI Start message (0xFA)
   * Resets clock and starts timing
   */
  onMIDIStart(): void {
    this.state.isRunning = true;
    this.state.ticks = 0;
    this.state.status = 'synced';
    this.state.lastTickTime = -1;
    this.tickIntervals = []; // Clear intervals on start
    
    this.onStartCallbacks.forEach(callback => callback());
  }

  /**
   * Handles MIDI Stop message (0xFC)
   * Stops timing and resets state
   */
  onMIDIStop(): void {
    this.state.isRunning = false;
    this.state.status = 'stopped';
    this.state.lastTickTime = -1;
    this.tickIntervals = [];
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    
    this.onStopCallbacks.forEach(callback => callback());
  }

  /**
   * Handles MIDI Continue message (0xFB)
   * Resumes timing without resetting ticks
   */
  onMIDIContinue(): void {
    this.state.isRunning = true;
    this.state.status = 'synced';
    this.state.lastTickTime = -1; // Ignore stale intervals after a pause
    this.tickIntervals = [];
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    
    this.onStartCallbacks.forEach(callback => callback());
  }

  /**
   * Gets the current clock state
   */
  getState(): ClockSyncState {
    return { ...this.state };
  }

  /**
   * Gets current BPM calculated from clock ticks
   */
  getBPM(): number {
    return Math.round(this.state.bpm);
  }

  /**
   * Gets current tick count
   */
  getTicks(): number {
    return this.state.ticks;
  }

  /**
   * Checks if clock is currently running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Gets current sync status
   */
  getStatus(): 'synced' | 'free' | 'stopped' {
    return this.state.status;
  }

  // Event registration methods
  onTick(callback: () => void): void {
    this.onTickCallbacks.push(callback);
  }

  onQuarterNote(callback: () => void): void {
    this.onQuarterNoteCallbacks.push(callback);
  }

  onSixteenthNote(callback: () => void): void {
    this.onSixteenthNoteCallbacks.push(callback);
  }

  onStart(callback: () => void): void {
    this.onStartCallbacks.push(callback);
  }

  onStop(callback: () => void): void {
    this.onStopCallbacks.push(callback);
  }

  /**
   * Removes all event callbacks
   */
  clearCallbacks(): void {
    this.onTickCallbacks = [];
    this.onQuarterNoteCallbacks = [];
    this.onSixteenthNoteCallbacks = [];
    this.onStartCallbacks = [];
    this.onStopCallbacks = [];
  }

  /**
   * Sets the clock source (external MIDI or internal)
   */
  setClockSource(source: ClockSource): void {
    if (this.clockSource === source) return;

    // Stop current clock if running
    if (this.clockSource === 'internal' && this.state.isRunning) {
      this.stopInternalClock();
    }

    this.clockSource = source;

    // Reset state when switching
    this.state.isRunning = false;
    this.state.ticks = 0;
    this.state.status = 'stopped';
    this.state.lastTickTime = -1;
    this.tickIntervals = [];
  }

  /**
   * Gets the current clock source
   */
  getClockSource(): ClockSource {
    return this.clockSource;
  }

  /**
   * Sets the internal clock BPM and updates the running clock if active
   */
  setInternalBPM(bpm: number): void {
    this.internalBPM = Math.max(20, Math.min(240, Math.round(bpm)));
    this.state.bpm = this.internalBPM;

    // Update tick interval calculation
    // MIDI clock: 24 ticks per quarter note
    // Tick interval = (60 / BPM) * 1000 / 24
    this.internalTickInterval = (60 / this.internalBPM) * 1000 / 24;

    // If internal clock is running, restart it with new BPM
    if (this.clockSource === 'internal' && this.state.isRunning) {
      this.stopInternalClock();
      this.startInternalClock();
    }
  }

  /**
   * Gets the current internal BPM
   */
  getInternalBPM(): number {
    return this.internalBPM;
  }

  /**
   * Starts the internal clock generator
   */
  startInternalClock(): void {
    if (this.clockSource !== 'internal') return;
    if (this.internalClockInterval !== null) return; // Already running

    // Calculate tick interval
    this.internalTickInterval = (60 / this.internalBPM) * 1000 / 24;

    // Reset state
    this.state.isRunning = true;
    this.state.ticks = 0;
    this.state.status = 'synced'; // Internal clock is always "synced" to itself
    this.state.bpm = this.internalBPM;
    this.state.lastTickTime = -1;

    // Trigger start callbacks
    this.onStartCallbacks.forEach(callback => callback());

    // Start generating ticks
    this.internalClockInterval = setInterval(() => {
      this.onMIDIClockTick(performance.now());
    }, this.internalTickInterval);
  }

  /**
   * Stops the internal clock generator
   */
  stopInternalClock(): void {
    if (this.internalClockInterval !== null) {
      clearInterval(this.internalClockInterval);
      this.internalClockInterval = null;
    }

    this.state.isRunning = false;
    this.state.status = 'stopped';
    this.state.lastTickTime = -1;

    // Trigger stop callbacks
    this.onStopCallbacks.forEach(callback => callback());
  }

  /**
   * Checks if internal clock is running
   */
  isInternalClockRunning(): boolean {
    return this.clockSource === 'internal' && this.internalClockInterval !== null;
  }
} 
