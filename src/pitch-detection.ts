/**
 * Real-time pitch detection using the YIN algorithm
 * YIN is an improved autocorrelation method with better accuracy and fewer octave errors
 * Reference: "YIN, a fundamental frequency estimator for speech and music" (2002)
 */

export interface PitchDetectionResult {
  /** Detected frequency in Hz, or -1 if no pitch detected */
  frequency: number;
  /** Confidence/clarity of the detection (0-1) */
  clarity: number;
  /** Detected MIDI note number */
  note: number;
  /** RMS amplitude of the signal (0-1) */
  amplitude: number;
}

export class PitchDetector {
  private sampleRate: number;
  private threshold: number;
  private probabilityThreshold: number;

  // YIN algorithm buffers
  private yinBuffer: Float32Array;

  constructor(
    sampleRate: number = 44100,
    bufferSize: number = 4096,
    threshold: number = 0.1,
    probabilityThreshold: number = 0.1
  ) {
    this.sampleRate = sampleRate;
    this.threshold = threshold;
    this.probabilityThreshold = probabilityThreshold;
    this.yinBuffer = new Float32Array(bufferSize / 2);
  }

  /**
   * Detects pitch from an audio buffer using the YIN algorithm
   * @param audioBuffer - Float32Array of audio samples
   * @returns PitchDetectionResult with frequency, clarity, note, and amplitude
   */
  detect(audioBuffer: Float32Array): PitchDetectionResult {
    // Calculate RMS amplitude for velocity mapping
    const amplitude = this.calculateRMS(audioBuffer);

    // Skip processing if signal is too quiet
    if (amplitude < this.probabilityThreshold) {
      return {
        frequency: -1,
        clarity: 0,
        note: -1,
        amplitude
      };
    }

    // Step 1: Calculate difference function
    this.differenceFunction(audioBuffer);

    // Step 2: Cumulative mean normalized difference
    this.cumulativeMeanNormalizedDifference();

    // Step 3: Absolute threshold
    const tauEstimate = this.absoluteThreshold();

    if (tauEstimate === -1) {
      return {
        frequency: -1,
        clarity: 0,
        note: -1,
        amplitude
      };
    }

    // Step 4: Parabolic interpolation for better accuracy
    const betterTau = this.parabolicInterpolation(tauEstimate);

    // Calculate frequency and convert to MIDI note
    const frequency = this.sampleRate / betterTau;
    const note = this.frequencyToMIDINote(frequency);
    const clarity = 1 - this.yinBuffer[tauEstimate];

    return {
      frequency,
      clarity,
      note,
      amplitude
    };
  }

  /**
   * Step 1: Calculate the difference function
   * d_t(tau) = sum of squared differences
   */
  private differenceFunction(buffer: Float32Array): void {
    const yinBufferSize = this.yinBuffer.length;

    // Initialize
    this.yinBuffer.fill(0);

    for (let tau = 0; tau < yinBufferSize; tau++) {
      for (let i = 0; i < yinBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        this.yinBuffer[tau] += delta * delta;
      }
    }
  }

  /**
   * Step 2: Cumulative mean normalized difference function
   * d'_t(tau) = d_t(tau) / [(1/tau) * sum(d_t(j) for j=1 to tau)]
   */
  private cumulativeMeanNormalizedDifference(): void {
    this.yinBuffer[0] = 1;

    let runningSum = 0;
    for (let tau = 1; tau < this.yinBuffer.length; tau++) {
      runningSum += this.yinBuffer[tau];
      this.yinBuffer[tau] *= tau / runningSum;
    }
  }

  /**
   * Step 3: Absolute threshold to find the smallest tau where d'(tau) < threshold
   * @returns tau estimate or -1 if no valid period found
   */
  private absoluteThreshold(): number {
    // Start search from a reasonable minimum period (e.g., ~80 Hz = C2)
    const minTau = Math.floor(this.sampleRate / 1000); // ~1000 Hz max frequency

    // Find first minimum below threshold
    for (let tau = minTau; tau < this.yinBuffer.length; tau++) {
      if (this.yinBuffer[tau] < this.threshold) {
        // Look for local minimum
        while (tau + 1 < this.yinBuffer.length && this.yinBuffer[tau + 1] < this.yinBuffer[tau]) {
          tau++;
        }
        return tau;
      }
    }

    return -1;
  }

  /**
   * Step 4: Parabolic interpolation for sub-sample accuracy
   */
  private parabolicInterpolation(tauEstimate: number): number {
    if (tauEstimate < 1 || tauEstimate >= this.yinBuffer.length - 1) {
      return tauEstimate;
    }

    const s0 = this.yinBuffer[tauEstimate - 1];
    const s1 = this.yinBuffer[tauEstimate];
    const s2 = this.yinBuffer[tauEstimate + 1];

    // Parabolic interpolation formula
    return tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  }

  /**
   * Calculates RMS (Root Mean Square) amplitude
   * Used for velocity mapping and noise gating
   */
  private calculateRMS(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Converts frequency in Hz to MIDI note number
   */
  private frequencyToMIDINote(frequency: number): number {
    // MIDI note = 69 + 12 * log2(f/440)
    return Math.round(69 + 12 * Math.log2(frequency / 440));
  }

  /**
   * Sets the detection threshold (lower = more sensitive)
   */
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0.01, Math.min(1, threshold));
  }

  /**
   * Sets the minimum amplitude threshold for detection
   */
  setProbabilityThreshold(threshold: number): void {
    this.probabilityThreshold = Math.max(0, Math.min(1, threshold));
  }
}

/**
 * Utility function to convert MIDI note to frequency
 */
export function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Utility function to get note name from MIDI note number
 */
export function getNoteNameFromMIDI(note: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = noteNames[note % 12];
  return `${noteName}${octave}`;
}
