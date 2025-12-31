import { ArpeggiatorState, ArpeggiatorPattern, IMidiEngine } from './types';
import { ClockSync } from './clock-sync';

/**
 * Timing Strategy Interface
 * Calculates timing offset (in ms) for a given step to create different musical feels
 */
export interface TimingStrategy {
  /**
   * Calculate the delay offset for a step
   * @param globalStep - The global step counter (for patterns that need absolute position)
   * @param baseStepMs - The base duration of one step in milliseconds
   * @returns Delay offset in milliseconds (can be negative for early playback)
   */
  getDelayOffset(globalStep: number, baseStepMs: number): number;

  /**
   * Returns a fixed gate length (0-1) that this timing strategy requires.
   * When present, this overrides the user's gate slider setting.
   * Return null to use the user's setting (e.g., for straight timing).
   * @param globalStep - Optional step number to allow different gates for downbeats/offbeats
   */
  getFixedGateLength?(globalStep?: number): number | null;
}

/**
 * Straight Timing - No offset, mechanical precision
 */
export class StraightTiming implements TimingStrategy {
  getDelayOffset(): number {
    return 0;
  }

  getFixedGateLength(_globalStep?: number): number | null {
    return null; // User controls gate length
  }
}

/**
 * Swing Timing - Delays offbeat steps (odd steps) to create swing feel
 * Classic swing delays the "ands" (8th note upbeats) by up to 50% of the step time
 */
export class SwingTiming implements TimingStrategy {
  private amount: number;
  private static readonly MAX_DELAY = 0.50; // Max 50% delay at full amount

  constructor(amount: number) {
    // Clamp amount to 0-1 range
    this.amount = Math.max(0, Math.min(1, amount));
  }

  getDelayOffset(globalStep: number, baseStepMs: number): number {
    // Only delay odd-numbered steps (the upbeats/offbeats)
    if (globalStep % 2 === 0) {
      return 0; // Even steps play on time
    }

    // Delay scales with amount: 0% at amount=0, MAX_DELAY at amount=1
    return baseStepMs * SwingTiming.MAX_DELAY * this.amount;
  }

  getFixedGateLength(globalStep: number = 0): number {
    const delay = SwingTiming.MAX_DELAY * this.amount;
    const minGap = 0.10; // Always leave 10% gap before next step

    if (globalStep % 2 === 0) {
      // Downbeat: moderate gate, shrinks slowly with amount
      return Math.max(0.25, 0.65 - delay * 0.3);
    } else {
      // Offbeat: cap gate so it doesn't run too close to next downbeat
      const maxAllowedGate = Math.max(0.15, 1 - delay - minGap);
      const desiredGate = 0.50 - delay * 0.5;
      return Math.max(0.15, Math.min(desiredGate, maxAllowedGate));
    }
  }
}

/**
 * Shuffle Timing - Triplet feel (delays offbeats to 2/3 position)
 * Creates a triplet feel where the offbeat lands on the last triplet subdivision
 * More pronounced than regular swing
 */
export class ShuffleTiming implements TimingStrategy {
  private amount: number;
  private static readonly MAX_DELAY = 0.667; // Max 66.7% delay (true triplet feel)

  constructor(amount: number) {
    this.amount = Math.max(0, Math.min(1, amount));
  }

  getDelayOffset(globalStep: number, baseStepMs: number): number {
    // Only delay odd steps (offbeats)
    if (globalStep % 2 === 0) {
      return 0; // Even steps on time
    }

    // Delay scales with amount: 0% at amount=0, MAX_DELAY at amount=1
    return baseStepMs * ShuffleTiming.MAX_DELAY * this.amount;
  }

  getFixedGateLength(globalStep: number = 0): number {
    const delay = ShuffleTiming.MAX_DELAY * this.amount;
    const minGap = 0.10; // Always leave 10% gap before next step

    if (globalStep % 2 === 0) {
      // Downbeat: moderate gate, shrinks slowly with amount
      return Math.max(0.25, 0.65 - delay * 0.3);
    } else {
      // Offbeat: cap gate so it doesn't run too close to next downbeat
      const maxAllowedGate = Math.max(0.15, 1 - delay - minGap);
      const desiredGate = 0.50 - delay * 0.5;
      return Math.max(0.15, Math.min(desiredGate, maxAllowedGate));
    }
  }
}

/**
 * Dotted Timing - Delays offbeats to 75% position (dotted 8th feel)
 * Creates a dotted eighth note feel, most extreme of the timing modes
 * Offbeat lands on the last 16th of the beat
 */
export class DottedTiming implements TimingStrategy {
  private amount: number;
  private static readonly MAX_DELAY = 0.75; // Max 75% delay (true dotted 8th)

  constructor(amount: number) {
    this.amount = Math.max(0, Math.min(1, amount));
  }

  getDelayOffset(globalStep: number, baseStepMs: number): number {
    // Only delay odd steps
    if (globalStep % 2 === 0) {
      return 0;
    }

    // Delay scales with amount: 0% at amount=0, MAX_DELAY at amount=1
    return baseStepMs * DottedTiming.MAX_DELAY * this.amount;
  }

  getFixedGateLength(globalStep: number = 0): number {
    const delay = DottedTiming.MAX_DELAY * this.amount;
    const minGap = 0.10; // Always leave 10% gap before next step

    if (globalStep % 2 === 0) {
      // Downbeat: moderate gate, shrinks slowly with amount
      return Math.max(0.25, 0.65 - delay * 0.3);
    } else {
      // Offbeat: cap gate so it doesn't run too close to next downbeat
      const maxAllowedGate = Math.max(0.15, 1 - delay - minGap);
      const desiredGate = 0.50 - delay * 0.5;
      return Math.max(0.15, Math.min(desiredGate, maxAllowedGate));
    }
  }
}

/**
 * Humanize Timing - Adds random timing variation to each step
 * Creates a more human, less robotic feel by randomly shifting timing
 * Can shift both early (negative offset) and late (positive offset)
 */
export class HumanizeTiming implements TimingStrategy {
  private maxVariationMs: number;
  private seed: number;

  constructor(amount: number, seed?: number) {
    const clamped = Math.max(0, Math.min(1, amount));
    // Map amount (0-1) to max variation of 0-15ms
    // 15ms is noticeable but not sloppy
    this.maxVariationMs = clamped * 15;
    // Use provided seed or generate random one for consistency
    this.seed = seed ?? Math.random() * 1000000;
  }

  /**
   * Simple seeded random number generator for consistent timing patterns
   * Returns value between 0 and 1
   */
  private seededRandom(index: number): number {
    const x = Math.sin(this.seed + index * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  getDelayOffset(globalStep: number, baseStepMs: number): number {
    if (this.maxVariationMs === 0) {
      return 0;
    }

    // Generate consistent variation for this step (-1 to 1)
    const variation = (this.seededRandom(globalStep) - 0.5) * 2;

    // Tempo-adaptive: Scale variation with tempo
    // At fast tempos (short steps), use less variation; at slow tempos, use more
    // Reference: 125ms step (120 BPM 16ths) = 1.0x scaling
    const tempoScale = Math.min(baseStepMs / 125, 1.0);
    const adaptiveMax = this.maxVariationMs * tempoScale;

    // Apply variation (-adaptiveMax to +adaptiveMax)
    // Negative values mean play early, positive means play late
    return variation * adaptiveMax;
  }

  getFixedGateLength(_globalStep?: number): number | null {
    return null; // Humanize doesn't affect gate length
  }
}

/**
 * Layered Timing - Combines multiple timing strategies
 * Useful for combining rhythmic feel (swing/shuffle/dotted) with humanization
 * Example: SwingTiming + HumanizeTiming = groovy but loose feel
 */
export class LayeredTiming implements TimingStrategy {
  private strategies: TimingStrategy[];

  constructor(strategies: TimingStrategy[]) {
    this.strategies = strategies;
  }

  getDelayOffset(globalStep: number, baseStepMs: number): number {
    // Sum all timing offsets
    // This is musically correct: swing provides the rhythmic pattern,
    // humanize adds random variation on top of it
    return this.strategies.reduce(
      (total, strategy) => total + strategy.getDelayOffset(globalStep, baseStepMs),
      0
    );
  }

  getFixedGateLength(globalStep?: number): number | null {
    // Return the first non-null fixed gate length from any strategy
    // This allows swing/shuffle/dotted to control gate even when layered with humanize
    for (const strategy of this.strategies) {
      const fixed = strategy.getFixedGateLength?.(globalStep);
      if (fixed !== null && fixed !== undefined) {
        return fixed;
      }
    }
    return null;
  }
}

/**
 * Velocity Humanization - Adds random velocity variation to each step
 * Creates natural velocity variations like a human player
 */
export class VelocityHumanize {
  private maxVariation: number;
  private seed: number;

  constructor(amount: number, seed?: number) {
    const clamped = Math.max(0, Math.min(1, amount));
    // Map amount (0-1) to max variation of ±10 velocity units
    this.maxVariation = clamped * 10;
    this.seed = seed ?? Math.random() * 1000000;
  }

  private seededRandom(index: number): number {
    const x = Math.sin(this.seed + index * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  getVelocityOffset(globalStep: number): number {
    if (this.maxVariation === 0) return 0;

    // Generate consistent variation for this step (-1 to 1)
    const variation = (this.seededRandom(globalStep) - 0.5) * 2;
    return Math.round(variation * this.maxVariation);
  }
}

/**
 * Accent Pattern - Applies velocity multipliers to emphasize certain beats
 */
export class AccentPattern {
  private pattern: number[];

  constructor(type: 'none' | 'downbeats' | 'offbeats' | 'every-3rd') {
    switch (type) {
      case 'downbeats':
        this.pattern = [1.25, 1.0, 1.0, 1.0]; // Emphasize every 4th step
        break;
      case 'offbeats':
        this.pattern = [1.0, 1.0, 1.25, 1.0]; // Emphasize 3rd step (offbeat)
        break;
      case 'every-3rd':
        this.pattern = [1.0, 1.0, 1.2]; // Every 3 steps
        break;
      case 'none':
      default:
        this.pattern = [1.0];
        break;
    }
  }

  getVelocityMultiplier(globalStep: number): number {
    return this.pattern[globalStep % this.pattern.length];
  }
}

/**
 * Gate Probability - Randomly skips notes based on probability
 * Creates evolving, generative patterns
 */
export class GateProbability {
  private chance: number;
  private seed: number;

  constructor(chance: number, seed?: number) {
    this.chance = Math.max(0, Math.min(1, chance));
    this.seed = seed ?? Math.random() * 1000000;
  }

  private seededRandom(index: number): number {
    const x = Math.sin(this.seed + index * 9.8765) * 54321.1234;
    return x - Math.floor(x);
  }

  shouldPlayStep(globalStep: number): boolean {
    if (this.chance >= 1.0) return true;
    return this.seededRandom(globalStep) < this.chance;
  }
}

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
  // Timing constants for consistent, maintainable timing calculations
  private static readonly GATE_HEADROOM_MS = 2; // Buffer between gate end and next step
  private static readonly TIMING_SAFETY_MS = 5; // Safety margin for timing offsets
  private static readonly MIN_GATE_MS = 5; // Minimum audible gate duration

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
  private stepCounter: number = 0; // Global step counter for timing patterns
  private timingStrategy: TimingStrategy = new StraightTiming(); // Default: no timing offset
  private velocityHumanize: VelocityHumanize | null = null;
  private accentPattern: AccentPattern = new AccentPattern('none');
  private gateProbability: GateProbability = new GateProbability(1.0);
  private ratchetCount: number = 1; // Note repeat count per step
  private probabilitySeed: number = Math.random() * 1000000;

  constructor(clockSync: ClockSync) {
    this.clockSync = clockSync;
    this.setupClockSync();
  }

  /**
   * Simplified clock sync setup - clock manages both playing AND stepping
   */
  private setupClockSync(): void {
    this.clockSync.onTick(() => {
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
        this.stepCounter = 0; // Reset global step counter for timing patterns
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
      this.stepCounter = 0; // Reset step counter
    } else {
      this.stepCounter = 0; // Reset on enable too
    }
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
  }

  /**
   * Sets the gate length (0-1)
   */
  setGateLength(gateLength: number): void {
    this.state.gateLength = Math.max(0, Math.min(1, gateLength));
  }

  /**
   * Sets the swing amount (0-1)
   * NOTE: Deprecated - use setTimingStrategy() instead
   */
  setSwing(swing: number): void {
    this.state.swing = Math.max(0, Math.min(1, swing));
  }

  /**
   * Sets the timing strategy for the arpeggiator
   * @param strategy - TimingStrategy instance (null = straight timing)
   */
  setTimingStrategy(strategy: TimingStrategy | null): void {
    this.timingStrategy = strategy ?? new StraightTiming();
  }

  /**
   * Sets velocity humanization
   * @param humanize - VelocityHumanize instance (null = no humanization)
   */
  setVelocityHumanize(humanize: VelocityHumanize | null): void {
    this.velocityHumanize = humanize;
  }

  /**
   * Sets accent pattern for velocity emphasis
   * @param type - Pattern type ('none', 'downbeats', 'offbeats', 'every-3rd')
   */
  setAccentPattern(type: 'none' | 'downbeats' | 'offbeats' | 'every-3rd'): void {
    this.accentPattern = new AccentPattern(type);
  }

  /**
   * Sets gate probability (chance of playing each step)
   * @param chance - 0-1, where 1 = always play, 0 = never play
   */
  setGateProbability(chance: number): void {
    this.gateProbability = new GateProbability(chance, this.probabilitySeed);
  }

  /**
   * Sets note repeat/ratcheting count
   * @param count - Number of times to repeat each note (1 = no repeat, 2 = double, 4 = quad)
   */
  setRatchetCount(count: number): void {
    this.ratchetCount = Math.max(1, Math.min(4, Math.floor(count)));
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

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING HELPERS - Centralized timing calculations
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns unified timing context for the current BPM and settings.
   * Consolidates calculations to keep timing constraints consistent.
   *
   * When timing strategies (swing/shuffle/dotted) provide a fixed gate length,
   * we use that instead of the user's setting. This ensures proper timing feel
   * without note overlaps.
   */
  private getTimingContext(): { stepTimeMs: number; gateTimeMs: number; maxDelayMs: number } {
    const stepTimeMs = this.getStepTimeMs();

    // Check if the timing strategy specifies a fixed gate length
    // Pass step counter so strategies can return different gates for downbeats/offbeats
    const fixedGate = this.timingStrategy.getFixedGateLength?.(this.stepCounter);

    let gateTimeMs: number;
    if (fixedGate !== null && fixedGate !== undefined) {
      // Use the timing strategy's fixed gate length (already tuned for the delay)
      gateTimeMs = Math.max(Arpeggiator.MIN_GATE_MS, stepTimeMs * fixedGate);
    } else {
      // Use user's gate setting with safety clamps
      const maxGateTime = Math.max(0, stepTimeMs - Arpeggiator.GATE_HEADROOM_MS);
      const rawGateTime = this.calculateGateTime(stepTimeMs);
      gateTimeMs = Math.max(Arpeggiator.MIN_GATE_MS, Math.min(rawGateTime, maxGateTime));
    }

    const maxDelayMs = this.calculateMaxDelay(stepTimeMs, gateTimeMs);
    return { stepTimeMs, gateTimeMs, maxDelayMs };
  }

  /**
   * Calculates maximum safe timing delay so the last note ends within the step.
   */
  private calculateMaxDelay(stepTimeMs: number, gateTimeMs: number): number {
    const lastGateEnd = this.getLastGateEnd(stepTimeMs, gateTimeMs);
    return Math.max(0, stepTimeMs - lastGateEnd - Arpeggiator.TIMING_SAFETY_MS);
  }

  /**
   * Calculates when the last gate ends within a step, accounting for ratchets.
   */
  private getLastGateEnd(stepTimeMs: number, gateTimeMs: number): number {
    if (this.ratchetCount <= 1) {
      return gateTimeMs;
    }

    const subStepTime = stepTimeMs / this.ratchetCount;
    const subGateTime = Math.min(gateTimeMs / this.ratchetCount, subStepTime * 0.9);
    return (this.ratchetCount - 1) * subStepTime + subGateTime;
  }

  /**
   * Collects notes to play for the current step based on pattern type.
   */
  private collectNotesToPlay(stepIndex: number): number[] {
    if (this.state.pattern === 'chord' || this.state.pattern === 'stacked-chord') {
      // Chord modes: play ALL notes simultaneously
      return this.state.pattern === 'chord'
        ? [...this.state.noteOrder]
        : this.getStackedChordNotes();
    }

    // Pattern modes: play notesPerStep notes at a time (sliding window)
    const notes: number[] = [];
    const sequenceLength = this.state.noteOrder.length;
    for (let i = 0; i < this.state.notesPerStep && i < sequenceLength; i++) {
      const noteIndex = (stepIndex + i) % sequenceLength;
      notes.push(this.state.noteOrder[noteIndex]);
    }
    return notes;
  }

  /**
   * SIMPLIFIED: Just plays the current step - no advancement logic
   * NEW: Supports sliding window with notesPerStep parameter
   * Uses timing strategy to calculate playback offset for swing/shuffle/etc.
   */
  private playCurrentStep(): void {
    if (this.state.noteOrder.length === 0) return;

    try {
      if (!this.midiEngine) {
        console.warn('MIDI engine not connected to arpeggiator');
        return;
      }

      // Check gate probability - skip this step if probability fails
      if (!this.gateProbability.shouldPlayStep(this.stepCounter)) {
        this.stepCounter++;
        return;
      }

      const channel = this.getChannel ? this.getChannel() : 1;
      let baseVelocity = this.getVelocity ? this.getVelocity() : 80;

      // Apply accent pattern
      const accentMultiplier = this.accentPattern.getVelocityMultiplier(this.stepCounter);
      baseVelocity = Math.round(baseVelocity * accentMultiplier);

      // Apply velocity humanization
      if (this.velocityHumanize) {
        const offset = this.velocityHumanize.getVelocityOffset(this.stepCounter);
        baseVelocity = Math.max(1, Math.min(127, baseVelocity + offset));
      }

      const { stepTimeMs, gateTimeMs, maxDelayMs } = this.getTimingContext();

      // Calculate timing offset using strategy and clamp to safe headroom.
      const timingOffset = this.timingStrategy.getDelayOffset(this.stepCounter, stepTimeMs);
      const playbackDelay = Math.min(maxDelayMs, Math.max(0, timingOffset));

      // Capture step and notes now to avoid race conditions with delayed playback.
      const capturedStep = this.state.currentStep;
      const notesToPlay = this.collectNotesToPlay(capturedStep);

      // Execute note playback after timing offset
      const executePlayback = () => {
        notesToPlay.forEach(note => {
          this.playNoteWithRatchet(note, baseVelocity, channel, gateTimeMs, stepTimeMs);
          this.onStepCallbacks.forEach(callback => {
            try {
              callback(capturedStep, note);
            } catch (error) {
              console.error('Error in arpeggiator step callback:', error);
            }
          });
        });
      };

      // Schedule playback with timing offset
      if (playbackDelay > 0) {
        const timeout = setTimeout(() => {
          this.activeTimeouts.delete(timeout);
          if (!this.state.enabled) return;
          executePlayback();
        }, playbackDelay);
        this.activeTimeouts.add(timeout);
      } else {
        // No delay, execute immediately
        executePlayback();
      }

      // Increment step counter for timing patterns
      this.stepCounter++;

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
  private calculateGateTime(stepTimeMs?: number): number {
    const stepTime = stepTimeMs ?? this.getStepTimeMs();
    return stepTime * this.state.gateLength;
  }

/**
 * Returns the duration (ms) of a single step at the current tempo/division
 */
private getStepTimeMs(): number {
  const bpm = this.clockSync.getBPM();
  const beatTime = (60 / bpm) * 1000; // ms per quarter note
  return beatTime / this.state.clockDivisor;
}

/**
 * Plays a note with optional ratcheting (note repeat within the step)
 * @param note - MIDI note number
 * @param velocity - Note velocity
 * @param channel - MIDI channel
 * @param gateTime - Gate duration for each repeat
 * @param stepTimeMs - Total step duration (for calculating ratchet subdivisions)
 */
private playNoteWithRatchet(note: number, velocity: number, channel: number, gateTime: number, stepTimeMs: number): void {
  if (this.ratchetCount === 1) {
    // No ratcheting, play normally
    this.playNoteWithGate(note, velocity, channel, gateTime);
    return;
  }

  // Ratcheting: subdivide the step and play multiple times
  const subStepTime = stepTimeMs / this.ratchetCount;
  const subGateTime = Math.min(gateTime / this.ratchetCount, subStepTime * 0.9); // Leave 10% gap

  for (let i = 0; i < this.ratchetCount; i++) {
    const delay = i * subStepTime;
    if (delay === 0) {
      // Play first note immediately
      this.playNoteWithGate(note, velocity, channel, subGateTime);
    } else {
      // Schedule subsequent repeats
      const timeout = setTimeout(() => {
        this.activeTimeouts.delete(timeout);
        this.playNoteWithGate(note, velocity, channel, subGateTime);
      }, delay);
      this.activeTimeouts.add(timeout);
    }
  }
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
    console.debug(`[Arp] Force-stopping note ${note}:${channel} - retriggered before gate ended`);
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

  // Apply minimum gate time to prevent race conditions
  // Notes need at least MIN_GATE_MS to sound properly
  const safeGateTime = Math.max(Arpeggiator.MIN_GATE_MS, gateTime);

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
  }, safeGateTime);

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
   * Removes all step callbacks
   */
  clearStepCallbacks(): void {
    this.onStepCallbacks = [];
  }
}
