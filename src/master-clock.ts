/**
 * Master Clock Module
 * Generates internal MIDI clock ticks at a specified BPM
 * Can be used as an alternative to external DAW clock sync
 */
export class MasterClock {
  private bpm: number = 120;
  private isRunning: boolean = false;
  private ticks: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private onTickCallbacks: ((now?: number) => void)[] = [];
  private onQuarterNoteCallbacks: (() => void)[] = [];
  private onSixteenthNoteCallbacks: (() => void)[] = [];
  private onStartCallbacks: (() => void)[] = [];
  private onStopCallbacks: (() => void)[] = [];

  /**
   * Sets the BPM for the master clock
   * @param bpm - Beats per minute (1-999)
   */
  setBPM(bpm: number): void {
    if (bpm < 1 || bpm > 999) {
      console.error(`Invalid BPM: ${bpm}`);
      return;
    }

    const wasRunning = this.isRunning;
    if (wasRunning) {
      this.stop();
    }

    this.bpm = bpm;

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Gets the current BPM
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * Starts the master clock
   * Resets tick count and begins generating clock ticks
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.ticks = 0;

    // Notify start callbacks
    this.onStartCallbacks.forEach(callback => callback());

    // Calculate tick interval in milliseconds
    // MIDI clock sends 24 ticks per quarter note
    // So at 120 BPM (2 beats per second), we get 48 ticks per second
    const ticksPerSecond = (this.bpm / 60) * 24;
    const tickInterval = 1000 / ticksPerSecond;

    // Use setInterval for timing, but with drift compensation
    this.intervalId = setInterval(() => {
      this.tick();
    }, tickInterval);
  }

  /**
   * Stops the master clock
   * Clears the interval and notifies stop callbacks
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Notify stop callbacks
    this.onStopCallbacks.forEach(callback => callback());
  }

  /**
   * Continues the master clock without resetting ticks
   */
  continue(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Notify start callbacks (same as continue for most purposes)
    this.onStartCallbacks.forEach(callback => callback());

    // Calculate tick interval
    const ticksPerSecond = (this.bpm / 60) * 24;
    const tickInterval = 1000 / ticksPerSecond;

    this.intervalId = setInterval(() => {
      this.tick();
    }, tickInterval);
  }

  /**
   * Generates a single clock tick
   * Emits tick event and quarter/sixteenth note events as appropriate
   */
  private tick(): void {
    if (!this.isRunning) {
      return;
    }

    const now = performance.now();
    this.ticks++;

    // Trigger tick callbacks with timestamp
    this.onTickCallbacks.forEach(callback => callback(now));

    // Every 24 ticks = quarter note
    if (this.ticks % 24 === 0) {
      this.onQuarterNoteCallbacks.forEach(callback => callback());
    }

    // Every 6 ticks = sixteenth note
    if (this.ticks % 6 === 0) {
      this.onSixteenthNoteCallbacks.forEach(callback => callback());
    }
  }

  /**
   * Checks if the master clock is currently running
   */
  isClockRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Gets the current tick count
   */
  getTicks(): number {
    return this.ticks;
  }

  // Event registration methods
  onTick(callback: (now?: number) => void): void {
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
   * Clears all event callbacks
   */
  clearCallbacks(): void {
    this.onTickCallbacks = [];
    this.onQuarterNoteCallbacks = [];
    this.onSixteenthNoteCallbacks = [];
    this.onStartCallbacks = [];
    this.onStopCallbacks = [];
  }
}
