import { ClockSyncState, ClockSource } from './types';
import { MasterClock } from './master-clock';

/**
 * Handles clock synchronization (both external MIDI and internal master clock)
 * Can receive MIDI clock messages from DAW or generate internal timing
 */
export class ClockSync {
  private masterClock: MasterClock;
  private state: ClockSyncState = {
    isRunning: false,
    ticks: 0,
    bpm: 120,
    status: 'stopped',
    lastTickTime: 0,
    source: 'external'
  };

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

  constructor() {
    this.masterClock = new MasterClock();
    this.setupMasterClockCallbacks();
  }

  /**
   * Sets up callbacks from the master clock to route to ClockSync callbacks
   */
  private setupMasterClockCallbacks(): void {
    this.masterClock.onTick((now) => {
      if (this.state.source === 'internal') {
        this.state.ticks = this.masterClock.getTicks();
        this.state.lastTickTime = now || performance.now();
        this.onTickCallbacks.forEach(callback => callback());
      }
    });

    this.masterClock.onQuarterNote(() => {
      if (this.state.source === 'internal') {
        this.onQuarterNoteCallbacks.forEach(callback => callback());
      }
    });

    this.masterClock.onSixteenthNote(() => {
      if (this.state.source === 'internal') {
        this.onSixteenthNoteCallbacks.forEach(callback => callback());
      }
    });

    this.masterClock.onStart(() => {
      if (this.state.source === 'internal') {
        this.state.isRunning = true;
        this.state.status = 'synced';
        this.onStartCallbacks.forEach(callback => callback());
      }
    });

    this.masterClock.onStop(() => {
      if (this.state.source === 'internal') {
        this.state.isRunning = false;
        this.state.status = 'stopped';
        this.onStopCallbacks.forEach(callback => callback());
      }
    });
  }

  /**
   * Sets the clock source (external, internal, or off)
   */
  setClockSource(source: ClockSource): void {
    const wasRunning = this.state.isRunning;

    // Stop current source
    if (this.state.source === 'internal' && this.masterClock.isClockRunning()) {
      this.masterClock.stop();
    }
    if (this.state.source === 'external' && this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    this.state.source = source;
    this.state.isRunning = false;
    this.state.status = 'stopped';

    // If switching to internal and was running, start master clock
    if (source === 'internal' && wasRunning) {
      this.startInternalClock();
    }
  }

  /**
   * Gets the current clock source
   */
  getClockSource(): ClockSource {
    return this.state.source;
  }

  /**
   * Starts the internal master clock
   */
  startInternalClock(): void {
    if (this.state.source !== 'internal') {
      console.warn('Cannot start internal clock when source is not set to internal');
      return;
    }
    this.masterClock.start();
  }

  /**
   * Stops the internal master clock
   */
  stopInternalClock(): void {
    if (this.state.source !== 'internal') {
      console.warn('Cannot stop internal clock when source is not set to internal');
      return;
    }
    this.masterClock.stop();
  }

  /**
   * Sets the BPM for the internal master clock
   */
  setInternalBPM(bpm: number): void {
    this.masterClock.setBPM(bpm);
    if (this.state.source === 'internal') {
      this.state.bpm = bpm;
    }
  }

  /**
   * Gets the internal master clock BPM
   */
  getInternalBPM(): number {
    return this.masterClock.getBPM();
  }

  /**
   * Handles incoming MIDI clock tick (0xF8)
   * Calculates BPM and triggers timing events
   * Only processes ticks when source is 'external'
   */
  onMIDIClockTick(nowArg?: number): void {
    // Ignore external clock when using internal clock
    if (this.state.source !== 'external') {
      return;
    }
    const now = typeof nowArg === 'number' ? nowArg : performance.now();
    
    // If ticks arrive without explicit Start/Continue, consider clock running
    if (!this.state.isRunning) {
      this.state.isRunning = true;
      this.state.status = 'synced';
      this.onStartCallbacks.forEach(callback => callback());
    }

    if (this.state.lastTickTime > 0) {
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
      this.onStopCallbacks.forEach(callback => callback());
    }, this.STOP_TIMEOUT_MS);
  }

  /**
   * Handles MIDI Start message (0xFA)
   * Resets clock and starts timing
   * Only processes when source is 'external'
   */
  onMIDIStart(): void {
    // Ignore external clock when using internal clock
    if (this.state.source !== 'external') {
      return;
    }
    this.state.isRunning = true;
    this.state.ticks = 0;
    this.state.status = 'synced';
    this.state.lastTickTime = 0;
    this.tickIntervals = []; // Clear intervals on start
    
    this.onStartCallbacks.forEach(callback => callback());
  }

  /**
   * Handles MIDI Stop message (0xFC)
   * Stops timing and resets state
   * Only processes when source is 'external'
   */
  onMIDIStop(): void {
    // Ignore external clock when using internal clock
    if (this.state.source !== 'external') {
      return;
    }
    this.state.isRunning = false;
    this.state.status = 'stopped';
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    
    this.onStopCallbacks.forEach(callback => callback());
  }

  /**
   * Handles MIDI Continue message (0xFB)
   * Resumes timing without resetting ticks
   * Only processes when source is 'external'
   */
  onMIDIContinue(): void {
    // Ignore external clock when using internal clock
    if (this.state.source !== 'external') {
      return;
    }
    this.state.isRunning = true;
    this.state.status = 'synced';
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
   * Gets current BPM (from external clock or internal master clock)
   */
  getBPM(): number {
    if (this.state.source === 'internal') {
      return this.masterClock.getBPM();
    }
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
} 
