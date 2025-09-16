import { ArpeggiatorState, ArpeggiatorPattern, IMidiEngine } from './types';
import { ClockSync } from './clock-sync';

export interface StepTimingContext {
  stepIndex: number;
  globalStep: number;
  baseStepDurationMs: number;
  gateLength: number;
  clockDivisor: number;
  notesPerStep: number;
  slidingOverlap: boolean;
}

export interface StepTimingResult {
  /**
   * Offset relative to the step boundary. Can be negative when notes should trigger ahead of the clock edge.
   */
  playbackDelayMs: number;
  gateDurationMs: number;
}

export interface StepTimingStrategy {
  getTiming(context: StepTimingContext): StepTimingResult;
}

class StraightTimingStrategy implements StepTimingStrategy {
  getTiming({ baseStepDurationMs, gateLength }: StepTimingContext): StepTimingResult {
    const baseGate = Math.max(0, baseStepDurationMs * gateLength);
    const gateDurationMs = Math.min(baseGate, baseStepDurationMs);
    return {
      playbackDelayMs: 0,
      gateDurationMs
    };
  }
}

class SwingTimingStrategy implements StepTimingStrategy {
  private readonly delayRatio: number;

  constructor(amount: number) {
    const clamped = Math.max(0, Math.min(1, amount));
    // Map amount (0-1) to a delay ratio of 0-0.5 of the step duration
    this.delayRatio = clamped * 0.5;
  }

  getTiming(context: StepTimingContext): StepTimingResult {
    const isOddStep = context.globalStep % 2 === 1;
    const baseGate = Math.max(0, context.baseStepDurationMs * context.gateLength);

    if (!isOddStep) {
      // Downbeat (even index): straight timing
      return {
        playbackDelayMs: 0,
        gateDurationMs: baseGate
      };
    }

    const delayMs = context.baseStepDurationMs * this.delayRatio;
    const availableWindow = Math.max(0, context.baseStepDurationMs - delayMs);

    return {
      playbackDelayMs: delayMs,
      gateDurationMs: Math.min(baseGate, availableWindow)
    };
  }
}

class TripletShuffleStrategy implements StepTimingStrategy {
  private readonly delayRatio: number;

  constructor(amount: number) {
    const clamped = Math.max(0, Math.min(1, amount));
    // Map amount (0-1) to a delay ratio targeting 66.67% position (2:1 triplet feel)
    this.delayRatio = clamped * (2/3 - 0.5); // 0 to 16.67% additional delay beyond 50%
  }

  getTiming(context: StepTimingContext): StepTimingResult {
    const isOddStep = context.globalStep % 2 === 1;
    const baseGate = Math.max(0, context.baseStepDurationMs * context.gateLength);

    if (!isOddStep) {
      // Downbeat (even index): straight timing
      return {
        playbackDelayMs: 0,
        gateDurationMs: baseGate
      };
    }

    // Base 50% delay + additional shuffle delay
    const baseDelay = context.baseStepDurationMs * 0.5;
    const shuffleDelay = context.baseStepDurationMs * this.delayRatio;
    const totalDelayMs = baseDelay + shuffleDelay;
    const availableWindow = Math.max(0, context.baseStepDurationMs - totalDelayMs);

    return {
      playbackDelayMs: totalDelayMs,
      gateDurationMs: Math.min(baseGate, availableWindow)
    };
  }
}

class DottedSwingStrategy implements StepTimingStrategy {
  private readonly delayRatio: number;

  constructor(amount: number) {
    const clamped = Math.max(0, Math.min(1, amount));
    // Map amount (0-1) to a delay ratio targeting 75% position
    this.delayRatio = clamped * 0.75;
  }

  getTiming(context: StepTimingContext): StepTimingResult {
    const isOddStep = context.globalStep % 2 === 1;
    const baseGate = Math.max(0, context.baseStepDurationMs * context.gateLength);

    if (!isOddStep) {
      // Downbeat (even index): straight timing
      return {
        playbackDelayMs: 0,
        gateDurationMs: baseGate
      };
    }

    const delayMs = context.baseStepDurationMs * this.delayRatio;
    const availableWindow = Math.max(0, context.baseStepDurationMs - delayMs);

    return {
      playbackDelayMs: delayMs,
      gateDurationMs: Math.min(baseGate, availableWindow)
    };
  }
}

class HumanizeStrategy implements StepTimingStrategy {
  private readonly maxVariationMs: number;
  private readonly seed: number;

  constructor(amount: number, seed?: number) {
    const clamped = Math.max(0, Math.min(1, amount));
    // Map amount (0-1) to max variation of 0-15ms
    this.maxVariationMs = clamped * 15;
    this.seed = seed ?? Math.random() * 1000000;
  }

  // Simple seeded random number generator for consistent timing patterns
  private seededRandom(index: number): number {
    const x = Math.sin(this.seed + index * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  getTiming(context: StepTimingContext): StepTimingResult {
    const baseGate = Math.max(0, context.baseStepDurationMs * context.gateLength);

    if (this.maxVariationMs === 0) {
      return {
        playbackDelayMs: 0,
        gateDurationMs: baseGate
      };
    }

    // Generate consistent variation based on step index
    const variation = (this.seededRandom(context.globalStep) - 0.5) * 2; // -1 to 1
    const delayMs = variation * this.maxVariationMs;

    // Ensure we don't delay or advance more than allowed
    const clampedDelayMs = Math.max(-this.maxVariationMs, Math.min(this.maxVariationMs, delayMs));

    let availableWindow: number;
    if (clampedDelayMs >= 0) {
      availableWindow = Math.max(0, context.baseStepDurationMs - clampedDelayMs);
    } else {
      availableWindow = Math.max(0, context.baseStepDurationMs + clampedDelayMs);
    }

    return {
      playbackDelayMs: Math.max(0, clampedDelayMs),
      gateDurationMs: Math.min(baseGate, availableWindow)
    };
  }
}
class CompoundTimingStrategy implements StepTimingStrategy {
  private readonly strategies: StepTimingStrategy[];

  constructor(strategies: StepTimingStrategy[]) {
    this.strategies = strategies;
  }

  getTiming(context: StepTimingContext): StepTimingResult {
    if (this.strategies.length === 0) {
      return new StraightTimingStrategy().getTiming(context);
    }

    const baseGate = Math.max(0, context.baseStepDurationMs * context.gateLength);
    let accumulatedDelay = 0;
    let gateDuration = baseGate;

    this.strategies.forEach(strategy => {
      const result = strategy.getTiming(context);
      accumulatedDelay += result.playbackDelayMs;
      gateDuration = Math.min(gateDuration, result.gateDurationMs);
    });

    // Clamp delay to a reasonable window (-stepLength, +stepLength)
    const maxAdvance = -context.baseStepDurationMs;
    const maxDelay = context.baseStepDurationMs;
    const clampedDelay = Math.max(maxAdvance, Math.min(maxDelay, accumulatedDelay));

    const availableWindow = clampedDelay >= 0
      ? Math.max(0, context.baseStepDurationMs - clampedDelay)
      : Math.max(0, context.baseStepDurationMs + clampedDelay);

    return {
      playbackDelayMs: clampedDelay,
      gateDurationMs: Math.min(gateDuration, availableWindow)
    };
  }
}

export type TimingStrategyType = 'straight' | 'swing' | 'shuffle' | 'dotted' | 'humanize' | 'compound';

export interface CompoundStrategyComponent {
  type: Exclude<TimingStrategyType, 'compound'>;
  amount: number;
}

export interface TimingStrategyOptions {
  components?: CompoundStrategyComponent[];
}

export function createTimingStrategy(
  type: TimingStrategyType,
  amount: number,
  seed?: number,
  options?: TimingStrategyOptions
): StepTimingStrategy {
  if (type !== 'humanize' && amount <= 0 && type !== 'compound') {
    return new StraightTimingStrategy();
  }

  switch (type) {
    case 'swing':
      return new SwingTimingStrategy(amount);
    case 'shuffle':
      return new TripletShuffleStrategy(amount);
    case 'dotted':
      return new DottedSwingStrategy(amount);
    case 'humanize':
      return new HumanizeStrategy(amount, seed);
    case 'compound': {
      const components = options?.components ?? [];
      const strategies = components.map(component =>
        createTimingStrategy(component.type, component.amount, seed)
      );
      return new CompoundTimingStrategy(strategies);
    }
    case 'straight':
    default:
      return new StraightTimingStrategy();
  }
}

// Legacy function for backward compatibility
export function createSwingTimingStrategy(amount: number): StepTimingStrategy {
  return createTimingStrategy('swing', amount);
}

const SCHED_NOOP = () => {};

interface ScheduledEvent {
  id: number;
  dueTime: number;
  callback: () => void;
  group?: string;
}

class EventScheduler {
  private queue: ScheduledEvent[] = [];
  private eventMap = new Map<number, ScheduledEvent>();
  private readonly groupMap = new Map<string, Set<number>>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 1;
  private readonly dueEventsBuffer: ScheduledEvent[] = [];
  private readonly eventPool: ScheduledEvent[] = [];
  private readonly maxPoolSize = 64;

  constructor() {
    // Pre-allocate 16 event objects for reuse
    for (let i = 0; i < 16; i++) {
      this.eventPool.push({
        id: 0,
        dueTime: 0,
        callback: SCHED_NOOP,
        group: undefined
      });
    }
  }

  private getPooledEvent(): ScheduledEvent {
    if (this.eventPool.length === 0) {
      // Fallback to allocation if pool is exhausted
      return {
        id: 0,
        dueTime: 0,
        callback: SCHED_NOOP,
        group: undefined
      };
    }
    return this.eventPool.pop()!;
  }

  private returnToPool(event: ScheduledEvent): void {
    if (this.eventPool.length < this.maxPoolSize) {
      // Reset event state and return to pool
      event.id = 0;
      event.dueTime = 0;
      event.callback = SCHED_NOOP;
      event.group = undefined;
      this.eventPool.push(event);
    }
  }

  schedule(callback: () => void, delayMs: number, group?: string): number {
    const dueTime = this.now() + Math.max(0, delayMs);
    const event = this.getPooledEvent();
    event.id = this.nextId++;
    event.dueTime = dueTime;
    event.callback = callback;
    event.group = group;

    this.eventMap.set(event.id, event);
    if (group) {
      let groupSet = this.groupMap.get(group);
      if (!groupSet) {
        groupSet = new Set();
        this.groupMap.set(group, groupSet);
      }
      groupSet.add(event.id);
    }
    const index = this.findInsertIndex(dueTime);
    this.queue.splice(index, 0, event);

    if (index === 0 || !this.timer) {
      this.scheduleNextTimer();
    }

    return event.id;
  }

  cancel(id: number, skipGroupCleanup = false): void {
    const event = this.eventMap.get(id);
    if (!event) return;

    this.eventMap.delete(id);
    if (!skipGroupCleanup && event.group) {
      const groupSet = this.groupMap.get(event.group);
      if (groupSet) {
        groupSet.delete(id);
        if (groupSet.size === 0) {
          this.groupMap.delete(event.group);
        }
      }
    }
    const index = this.queue.indexOf(event);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }

    this.returnToPool(event);
    this.scheduleNextTimer();
  }

  cancelGroup(group: string): void {
    const groupSet = this.groupMap.get(group);
    if (!groupSet || groupSet.size === 0) {
      return;
    }

    for (const id of groupSet) {
      this.cancel(id, true);
    }
    groupSet.clear();
    this.groupMap.delete(group);
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Return all queued events to pool
    this.queue.forEach(event => this.returnToPool(event));
    this.queue = [];
    this.eventMap.clear();
    this.groupMap.clear();
    }

  private scheduleNextTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const nextEvent = this.queue[0];
    const delay = Math.max(0, nextEvent.dueTime - this.now());
    this.timer = setTimeout(() => this.runDueEvents(), delay);
  }

  private runDueEvents(): void {
    this.timer = null;
    if (this.queue.length === 0) {
      return;
    }

    const now = this.now();
    this.dueEventsBuffer.length = 0;

    while (this.queue.length > 0) {
      const next = this.queue[0];
      if (next.dueTime - now > 1) {
        break;
      }
      this.dueEventsBuffer.push(next);
      this.queue.shift();
      this.eventMap.delete(next.id);
      if (next.group) {
        const groupSet = this.groupMap.get(next.group);
        if (groupSet) {
          groupSet.delete(next.id);
          if (groupSet.size === 0) {
            this.groupMap.delete(next.group);
          }
        }
      }
    }

    this.dueEventsBuffer.forEach(event => {
      try {
        event.callback();
      } catch (error) {
        console.error('Error in scheduled arpeggiator event:', error);
      }
      this.returnToPool(event);
    });

    this.scheduleNextTimer();
  }

  private findInsertIndex(dueTime: number): number {
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (dueTime < this.queue[mid].dueTime) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    return low;
  }

  private now(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }
}

interface NoteOffBatch {
  eventId: number;
  channel: number;
  notes: number[];
  noteKeys: number[];
}

interface HeldNoteEntry {
  batch: NoteOffBatch;
  index: number;
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
  private state: ArpeggiatorState = {
    enabled: false,
    pattern: 'up',
    rate: 120,
    gateLength: 0.5,
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
  private scheduler = new EventScheduler();
  private heldNoteEntries: Map<number, HeldNoteEntry> = new Map();
  private noteOffBatches = new Map<number, NoteOffBatch>();
  private readonly batchPool: NoteOffBatch[] = [];
  private readonly maxBatchPoolSize = 32;
  private readonly singleNoteScratch: number[] = [0];
  private stepCounter = 0;
  private pendingPlaybackEvents: Set<number> = new Set();
  private humanizeActive = false;
  private lastProcessedTick: number = -1;
  private getChannel: (() => number) | null = null;
  private getVelocity: (() => number) | null = null;
  private readonly defaultTimingStrategy: StepTimingStrategy = new StraightTimingStrategy();
  private timingStrategy: StepTimingStrategy;
  private readonly stepNotesBuffer: number[] = [];
  private readonly stackedChordOffsets = [-12, 0, 12];

  private encodeNoteKey(note: number, channel: number): number {
    return (channel << 8) | (note & 0x7f);
  }

  private acquireBatch(channel: number): NoteOffBatch {
    const batch = this.batchPool.pop() ?? { eventId: 0, channel, notes: [], noteKeys: [] };
    batch.channel = channel;
    batch.eventId = 0;
    batch.notes.length = 0;
    batch.noteKeys.length = 0;
    return batch;
  }

  private releaseBatch(batch: NoteOffBatch): void {
    if (this.batchPool.length >= this.maxBatchPoolSize) {
      batch.notes.length = 0;
      batch.noteKeys.length = 0;
      batch.eventId = 0;
      return;
    }

    batch.notes.length = 0;
    batch.noteKeys.length = 0;
    batch.eventId = 0;
    this.batchPool.push(batch);
  }

  private stopMidiNote(note: number, channel: number): void {
    try {
      if (this.midiEngine) {
        this.midiEngine.stopNote(note, 0, channel);
      }
    } catch (error) {
      console.error('Error stopping arpeggiator note:', error);
    }
  }

  private detachHeldNote(key: number, stopImmediately: boolean): void {
    const entry = this.heldNoteEntries.get(key);
    if (!entry) {
      return;
    }
    this.detachHeldNoteEntry(key, entry, stopImmediately);
  }

  private detachHeldNoteEntry(key: number, entry: HeldNoteEntry, stopImmediately: boolean): void {
    const batch = entry.batch;
    const index = entry.index;
    const lastIndex = batch.notes.length - 1;

    if (lastIndex < 0) {
      this.heldNoteEntries.delete(key);
      return;
    }

    if (index < 0 || index > lastIndex) {
      this.heldNoteEntries.delete(key);
      return;
    }

    const note = batch.notes[index];
    if (typeof note !== 'number') {
      this.heldNoteEntries.delete(key);
      return;
    }
    const channel = batch.channel;

    if (stopImmediately && this.midiEngine) {
      this.stopMidiNote(note, channel);
    }

    if (index !== lastIndex) {
      const lastNote = batch.notes[lastIndex];
      const lastKey = batch.noteKeys[lastIndex];
      batch.notes[index] = lastNote;
      batch.noteKeys[index] = lastKey;
      const swappedEntry = this.heldNoteEntries.get(lastKey);
      if (swappedEntry) {
        swappedEntry.index = index;
      }
    }

    batch.notes.pop();
    batch.noteKeys.pop();
    this.heldNoteEntries.delete(key);

    if (batch.notes.length === 0) {
      if (batch.eventId !== 0) {
        this.scheduler.cancel(batch.eventId);
        this.noteOffBatches.delete(batch.eventId);
      }
      this.releaseBatch(batch);
    }
  }

  private finalizeBatch(batch: NoteOffBatch, stopMidi: boolean): void {
    if (stopMidi && this.midiEngine) {
      for (let i = 0; i < batch.notes.length; i++) {
        this.stopMidiNote(batch.notes[i], batch.channel);
      }
    }

    for (let i = 0; i < batch.noteKeys.length; i++) {
      this.heldNoteEntries.delete(batch.noteKeys[i]);
    }

    this.releaseBatch(batch);
  }

  private flushNoteOffBatches(stopMidi: boolean): void {
    this.noteOffBatches.forEach((batch, _eventId) => {
      if (batch.eventId !== 0) {
        this.scheduler.cancel(batch.eventId);
      }
      this.finalizeBatch(batch, stopMidi);
    });
    this.noteOffBatches.clear();
    this.heldNoteEntries.clear();
  }

  private playNotesWithGateBatched(notes: readonly number[], velocity: number, channel: number, gateTime: number): void {
    if (!this.midiEngine || notes.length === 0) {
      return;
    }

    // Stop any prior gates for these notes
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const key = this.encodeNoteKey(note, channel);
      this.detachHeldNote(key, true);
    }

    const batch = this.acquireBatch(channel);

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      this.midiEngine.playNote(note, velocity, channel);
      batch.notes.push(note);
      batch.noteKeys.push(this.encodeNoteKey(note, channel));
    }

    if (gateTime <= 0) {
      this.finalizeBatch(batch, true);
      return;
    }

    let eventId = 0;
    const scheduledBatch = batch;
    eventId = this.scheduler.schedule(() => {
      this.noteOffBatches.delete(eventId);
      this.finalizeBatch(scheduledBatch, true);
    }, gateTime, 'note-off');

    scheduledBatch.eventId = eventId;
    this.noteOffBatches.set(eventId, scheduledBatch);

    for (let i = 0; i < scheduledBatch.noteKeys.length; i++) {
      const key = scheduledBatch.noteKeys[i];
      this.heldNoteEntries.set(key, { batch: scheduledBatch, index: i });
    }
  }

  constructor(clockSync: ClockSync) {
    this.clockSync = clockSync;
    this.timingStrategy = this.defaultTimingStrategy;
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
          this.handleClockStep();
        }
      }
    });

    this.clockSync.onStart(() => {
      if (this.state.enabled) {
        this.state.currentStep = 0;
        this.lastProcessedTick = -1;
        this.stepCounter = 0;
        this.clearPendingPlaybackTimeouts();
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
      this.stepCounter = 0;
    } else {
      this.stepCounter = 0;
      this.clearPendingPlaybackTimeouts();
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
    if (this.state.enabled && this.state.syncToClock) {
      this.clearPendingPlaybackTimeouts();
    }
  }

  /**
   * Sets the gate length (0-1)
   */
  setGateLength(gateLength: number): void {
    this.state.gateLength = Math.max(0, Math.min(1, gateLength));
    if (this.state.enabled && this.state.syncToClock) {
      this.clearPendingPlaybackTimeouts();
    }
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
    if (this.state.enabled && this.state.syncToClock) {
      this.clearPendingPlaybackTimeouts();
    }
  }

  /**
   * Sets whether the sliding window overlaps or jumps
   * @param overlap - If true, window slides by 1; if false, window jumps by notesPerStep
   */
  setSlidingWindowOverlap(overlap: boolean): void {
    this.state.slidingOverlap = overlap;
    if (this.state.enabled && this.state.syncToClock) {
      this.clearPendingPlaybackTimeouts();
    }
  }

  /**
   * Allows external callers to provide a custom timing strategy (e.g., swing, shuffle)
   * Passing null/undefined resets to the straight timing strategy
   */
  setTimingStrategy(strategy?: StepTimingStrategy | null): void {
    this.timingStrategy = strategy ?? this.defaultTimingStrategy;
    if (this.state.enabled && this.state.syncToClock) {
      this.clearPendingPlaybackTimeouts();
    }
  }

  setHumanizeActive(active: boolean): void {
    this.humanizeActive = active;
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
    this.clearPendingPlaybackTimeouts();
  }

  /**
   * Handles a clock-aligned step, accounting for early executions
   */
  private handleClockStep(): void {
    const stepIndex = this.state.currentStep;
    const stepCount = this.stepCounter;

    this.playStep(stepIndex, stepCount);

    this.stepCounter++;
    this.advanceStep();
  }

  private createTimingContext(stepIndex: number, baseStepDurationMs: number, globalStep: number): StepTimingContext {
    return {
      stepIndex,
      globalStep,
      baseStepDurationMs,
      gateLength: this.state.gateLength,
      clockDivisor: this.state.clockDivisor,
      notesPerStep: this.state.notesPerStep,
      slidingOverlap: this.state.slidingOverlap
    };
  }

  private calculateStepTiming(stepIndex: number, stepCount: number): { timing: StepTimingResult; gateTime: number; baseStepDuration: number } {
    const baseStepDuration = this.getStepTimeMs();
    const timing = this.timingStrategy.getTiming(this.createTimingContext(stepIndex, baseStepDuration, stepCount));
    const maxGate = Math.max(0, baseStepDuration - 2);
    const gateTime = Math.min(Math.max(0, timing.gateDurationMs), maxGate);
    return { timing, gateTime, baseStepDuration };
  }

  private clearPendingPlaybackTimeouts(): void {
    if (this.pendingPlaybackEvents.size === 0) {
      return;
    }

    this.scheduler.cancelGroup('playback');
    this.pendingPlaybackEvents.clear();
  }

  /**
   * Plays a specific step using the current timing strategy
   */
  private playStep(stepIndex: number, stepCount: number): void {
    if (this.state.noteOrder.length === 0) return;

    const { timing, gateTime } = this.calculateStepTiming(stepIndex, stepCount);

    if (timing.playbackDelayMs <= 0) {
      this.executeStepPlayback(stepIndex, gateTime, stepCount);
    } else {
      let playbackEventId = 0;
      playbackEventId = this.scheduler.schedule(() => {
        this.pendingPlaybackEvents.delete(playbackEventId);
        this.executeStepPlayback(stepIndex, gateTime, stepCount);
      }, timing.playbackDelayMs, 'playback');
      this.pendingPlaybackEvents.add(playbackEventId);
    }
  }

  private executeStepPlayback(stepIndex: number, gateTime: number, _stepCount: number): void {
    if (!this.state.enabled) return;
    if (this.state.noteOrder.length === 0) return;

    try {
      if (!this.midiEngine) {
        console.warn('MIDI engine not connected to arpeggiator');
        return;
      }

      const channel = this.getChannel ? this.getChannel() : 1;
      const velocity = this.getVelocity ? this.getVelocity() : 80;
      const sequenceLength = this.state.noteOrder.length;
      if (sequenceLength === 0) return;
      const normalizedIndex = ((stepIndex % sequenceLength) + sequenceLength) % sequenceLength;
      const notesToPlay = this.stepNotesBuffer;
      notesToPlay.length = 0;

      if (this.state.pattern === 'chord' || this.state.pattern === 'stacked-chord') {
        if (this.state.pattern === 'chord') {
          this.state.noteOrder.forEach(note => notesToPlay.push(note));
        } else {
          this.fillStackedChordNotes(notesToPlay);
        }

        // Use batched note operations for chord patterns (multiple simultaneous notes)
        this.playNotesWithGateBatched(notesToPlay, velocity, channel, gateTime);

        notesToPlay.forEach(note => {
          this.notifyStepCallbacks(normalizedIndex, note);
        });

        notesToPlay.length = 0;

        return;
      }

      const maxNotes = this.humanizeActive
        ? Math.min(1, sequenceLength)
        : Math.min(this.state.notesPerStep, sequenceLength);

      for (let i = 0; i < maxNotes; i++) {
        const noteIndex = (normalizedIndex + i) % sequenceLength;
        notesToPlay.push(this.state.noteOrder[noteIndex]);
      }

      if (maxNotes > 1) {
        // Use batched operations for sliding window with multiple notes
        this.playNotesWithGateBatched(notesToPlay, velocity, channel, gateTime);
        notesToPlay.forEach(note => {
          this.notifyStepCallbacks(normalizedIndex, note);
        });
      } else {
        // Single note - use individual operation to maintain existing behavior
        notesToPlay.forEach(note => {
          this.playNoteWithGate(note, velocity, channel, gateTime);
          this.notifyStepCallbacks(normalizedIndex, note);
        });
      }

      notesToPlay.length = 0;
    } catch (error) {
      console.error('Error playing arpeggiator step:', error);
    }
  }

  private notifyStepCallbacks(stepIndex: number, note: number): void {
    this.onStepCallbacks.forEach(callback => {
      try {
        callback(stepIndex, note);
      } catch (error) {
        console.error('Error in arpeggiator step callback:', error);
      }
    });
  }

  /**
   * Build stacked chord notes from noteOrder
   */
  private fillStackedChordNotes(target: number[]): void {
    target.length = 0;

    const baseNotes = this.state.pattern === 'timeline'
      ? [...this.pressOrder]
      : [...this.pressOrder].sort((a, b) => a - b);

    const seen = new Set<number>();

    baseNotes.forEach(base => {
      this.stackedChordOffsets.forEach(offset => {
        const note = base + offset;
        if (note >= 0 && note <= 127 && !seen.has(note)) {
          seen.add(note);
          target.push(note);
        }
      });
    });
  }

  /**
   * Updates the note order based on pattern
   * FIXED: Always ensures currentStep is valid
   */
  private updateNoteOrder(): void {
    if (this.pressOrder.length === 0) {
      this.state.noteOrder = [];
      this.state.currentStep = 0;
      this.clearPendingPlaybackTimeouts();
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

    if (this.state.enabled && this.state.syncToClock) {
      this.clearPendingPlaybackTimeouts();
    }
  }

  /**
   * Calculates gate time based on BPM and gate length
   */
/**
 * Returns the duration (ms) of a single step at the current tempo/division
 */
private getStepTimeMs(): number {
  const bpm = this.clockSync.getBPM();
  const beatTime = (60 / bpm) * 1000; // ms per quarter note
  return beatTime / this.state.clockDivisor;
}

private playNoteWithGate(note: number, velocity: number, channel: number, gateTime: number): void {
  this.singleNoteScratch[0] = note;
  this.playNotesWithGateBatched(this.singleNoteScratch, velocity, channel, gateTime);
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
    this.flushNoteOffBatches(true);
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
    this.clearPendingPlaybackTimeouts();
    this.flushNoteOffBatches(true);

    this.scheduler.clear();
    this.pendingPlaybackEvents.clear();
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
