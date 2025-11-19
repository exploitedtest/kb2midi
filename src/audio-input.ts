/**
 * Audio-to-MIDI input source using real-time pitch detection
 * Converts microphone input to MIDI notes using the YIN pitch detection algorithm
 */

import { IMIDIInputSource, InputSourceConfig } from './input-source';
import { PitchDetector, PitchDetectionResult } from './pitch-detection';

export interface AudioInputConfig extends InputSourceConfig {
  /** Minimum RMS amplitude to trigger note on (0-1) */
  amplitudeThreshold?: number;
  /** Pitch detection threshold (0-1, lower = more sensitive) */
  pitchThreshold?: number;
  /** Smoothing window size for note detection (prevents flickering) */
  smoothingWindow?: number;
  /** Minimum note duration in milliseconds before sending note off */
  minNoteDuration?: number;
  /** Audio buffer size for analysis (larger = more accurate but higher latency) */
  bufferSize?: number;
}

interface ActiveNote {
  note: number;
  velocity: number;
  startTime: number;
}

export class AudioInput implements IMIDIInputSource {
  private config: Required<AudioInputConfig>;
  private active: boolean = false;
  private initialized: boolean = false;

  // Web Audio API
  private audioContext: AudioContext | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;

  // Pitch detection
  private pitchDetector: PitchDetector | null = null;
  private audioBuffer: Float32Array | null = null;

  // Note tracking
  private currentNote: ActiveNote | null = null;
  private noteHistory: number[] = [];

  // Callbacks
  private noteOnHandler: ((note: number, velocity: number) => void) | null = null;
  private noteOffHandler: ((note: number) => void) | null = null;
  private specialEventHandlers: Map<string, (...args: any[]) => void> = new Map();

  // Animation frame for continuous detection
  private animationFrameId: number | null = null;

  constructor(config: AudioInputConfig = {}) {
    this.config = {
      minVelocity: config.minVelocity ?? 40,
      maxVelocity: config.maxVelocity ?? 127,
      defaultVelocity: config.defaultVelocity ?? 80,
      amplitudeThreshold: config.amplitudeThreshold ?? 0.02,
      pitchThreshold: config.pitchThreshold ?? 0.1,
      smoothingWindow: config.smoothingWindow ?? 3,
      minNoteDuration: config.minNoteDuration ?? 50,
      bufferSize: config.bufferSize ?? 4096
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('AudioInput already initialized');
      return;
    }

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      // Create Web Audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100
      });

      // Create audio nodes
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.bufferSize * 2;
      this.analyser.smoothingTimeConstant = 0;

      // Connect nodes
      this.microphone.connect(this.analyser);

      // Create pitch detector
      this.pitchDetector = new PitchDetector(
        this.audioContext.sampleRate,
        this.config.bufferSize,
        this.config.pitchThreshold,
        this.config.amplitudeThreshold
      );

      this.audioBuffer = new Float32Array(this.config.bufferSize);

      this.initialized = true;
      console.log('AudioInput initialized successfully');

      // Start detection loop if active
      if (this.active) {
        this.startDetection();
      }
    } catch (error) {
      console.error('Failed to initialize AudioInput:', error);
      throw new Error(`Microphone access denied or unavailable: ${error}`);
    }
  }

  cleanup(): void {
    this.stopDetection();

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Disconnect audio nodes
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear state
    this.currentNote = null;
    this.noteHistory = [];
    this.pitchDetector = null;
    this.audioBuffer = null;
    this.initialized = false;
    this.active = false;

    console.log('AudioInput cleaned up');
  }

  onNoteOn(handler: (note: number, velocity: number) => void): void {
    this.noteOnHandler = handler;
  }

  onNoteOff(handler: (note: number) => void): void {
    this.noteOffHandler = handler;
  }

  onSpecialEvent(action: string, handler: (...args: any[]) => void): void {
    this.specialEventHandlers.set(action, handler);
  }

  getName(): string {
    return 'Microphone (Audio-to-MIDI)';
  }

  isActive(): boolean {
    return this.active;
  }

  setActive(active: boolean): void {
    if (this.active === active) return;

    this.active = active;

    if (active && this.initialized) {
      this.startDetection();
    } else if (!active) {
      this.stopDetection();
      // Send note off if a note is currently playing
      this.stopCurrentNote();
    }
  }

  /**
   * Starts the pitch detection loop
   */
  private startDetection(): void {
    if (this.animationFrameId !== null) return;

    const detect = () => {
      if (!this.active || !this.analyser || !this.audioBuffer || !this.pitchDetector) {
        return;
      }

      // Get time domain data from analyser
      // @ts-expect-error - ArrayBufferLike compatibility issue with AnalyserNode
      this.analyser.getFloatTimeDomainData(this.audioBuffer);

      // Detect pitch
      const result = this.pitchDetector.detect(this.audioBuffer as unknown as Float32Array);

      // Process detection result
      this.processDetection(result);

      // Continue detection loop
      this.animationFrameId = requestAnimationFrame(detect);
    };

    // Start the loop
    this.animationFrameId = requestAnimationFrame(detect);
  }

  /**
   * Stops the pitch detection loop
   */
  private stopDetection(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Processes a pitch detection result and triggers note events
   */
  private processDetection(result: PitchDetectionResult): void {
    const now = performance.now();

    // No pitch detected or amplitude too low
    if (result.note === -1 || result.amplitude < this.config.amplitudeThreshold) {
      // Stop current note if it's been playing long enough
      if (this.currentNote && (now - this.currentNote.startTime) >= this.config.minNoteDuration) {
        this.stopCurrentNote();
      }
      this.noteHistory = [];
      return;
    }

    // Valid pitch detected - add to history for smoothing
    this.noteHistory.push(result.note);
    if (this.noteHistory.length > this.config.smoothingWindow) {
      this.noteHistory.shift();
    }

    // Calculate smoothed note (most common note in recent history)
    const smoothedNote = this.getMostCommonNote(this.noteHistory);

    // Map amplitude to velocity
    const velocity = this.amplitudeToVelocity(result.amplitude);

    // Decide whether to start a new note or continue current one
    if (!this.currentNote) {
      // Start new note
      this.startNote(smoothedNote, velocity);
    } else if (smoothedNote !== this.currentNote.note) {
      // Note changed - stop old note and start new one
      this.stopCurrentNote();
      this.startNote(smoothedNote, velocity);
    }
    // If same note, just continue (could update velocity dynamically if desired)
  }

  /**
   * Starts a new note
   */
  private startNote(note: number, velocity: number): void {
    // Validate MIDI note range
    if (note < 0 || note > 127) return;

    this.currentNote = {
      note,
      velocity,
      startTime: performance.now()
    };

    if (this.noteOnHandler) {
      this.noteOnHandler(note, velocity);
    }
  }

  /**
   * Stops the current note
   */
  private stopCurrentNote(): void {
    if (!this.currentNote) return;

    if (this.noteOffHandler) {
      this.noteOffHandler(this.currentNote.note);
    }

    this.currentNote = null;
  }

  /**
   * Gets the most common note from the history (smoothing)
   */
  private getMostCommonNote(notes: number[]): number {
    if (notes.length === 0) return -1;

    const counts = new Map<number, number>();
    for (const note of notes) {
      counts.set(note, (counts.get(note) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = notes[0];
    counts.forEach((count, note) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = note;
      }
    });

    return mostCommon;
  }

  /**
   * Maps amplitude (0-1) to MIDI velocity (1-127)
   */
  private amplitudeToVelocity(amplitude: number): number {
    // Apply logarithmic scaling for more natural feeling
    const normalized = Math.min(1, amplitude / 0.5); // Assume 0.5 is "forte"
    const scaled = Math.pow(normalized, 0.7); // Slight compression
    const velocity = Math.round(
      this.config.minVelocity + (this.config.maxVelocity - this.config.minVelocity) * scaled
    );
    return Math.max(this.config.minVelocity, Math.min(this.config.maxVelocity, velocity));
  }

  /**
   * Updates the configuration
   */
  setConfig(config: Partial<AudioInputConfig>): void {
    this.config = { ...this.config, ...config };

    // Update pitch detector thresholds if initialized
    if (this.pitchDetector) {
      if (config.pitchThreshold !== undefined) {
        this.pitchDetector.setThreshold(config.pitchThreshold);
      }
      if (config.amplitudeThreshold !== undefined) {
        this.pitchDetector.setProbabilityThreshold(config.amplitudeThreshold);
      }
    }
  }

  /**
   * Gets the current configuration
   */
  getConfig(): Required<AudioInputConfig> {
    return { ...this.config };
  }

  /**
   * Gets the audio context for advanced use cases
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
}
