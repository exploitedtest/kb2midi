/**
 * Scale filtering system for kb2midi
 * Provides scale definitions, note filtering, and scale-aware note validation
 */

export interface ScaleDefinition {
  name: string;
  intervals: number[]; // Semitone intervals from root (e.g., [0, 2, 4, 5, 7, 9, 11] for major)
  description?: string;
}

/**
 * Common musical scales with their interval patterns
 */
export const SCALE_DEFINITIONS: { [key: string]: ScaleDefinition } = {
  chromatic: {
    name: 'Chromatic (All Notes)',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'All 12 notes - no filtering'
  },
  major: {
    name: 'Major (Ionian)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    description: 'Happy, bright scale'
  },
  minor: {
    name: 'Natural Minor (Aeolian)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'Sad, dark scale'
  },
  harmonicMinor: {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    description: 'Exotic, Middle Eastern flavor'
  },
  melodicMinor: {
    name: 'Melodic Minor',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    description: 'Jazz minor scale'
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Jazz, funk, minor with bright 6th'
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    description: 'Spanish, flamenco, dark'
  },
  lydian: {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    description: 'Dreamy, floating, raised 4th'
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: 'Blues, rock, dominant 7th'
  },
  locrian: {
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    description: 'Diminished, unstable, rarely used'
  },
  pentatonicMajor: {
    name: 'Pentatonic Major',
    intervals: [0, 2, 4, 7, 9],
    description: 'Rock, pop, 5-note scale'
  },
  pentatonicMinor: {
    name: 'Pentatonic Minor',
    intervals: [0, 3, 5, 7, 10],
    description: 'Blues, rock, 5-note scale'
  },
  blues: {
    name: 'Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    description: 'Blues scale with blue note'
  },
  wholeTone: {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    description: 'Dreamy, ambiguous, Debussy'
  },
  diminished: {
    name: 'Diminished (Half-Whole)',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    description: 'Symmetrical, jazz, tension'
  },
  augmented: {
    name: 'Augmented',
    intervals: [0, 3, 4, 7, 8, 11],
    description: 'Symmetrical, exotic'
  }
};

/**
 * Note names for root note selection
 */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * ScaleFilter class handles scale-based note filtering and validation
 */
export class ScaleFilter {
  private scaleType: string = 'chromatic';
  private rootNote: number = 0; // 0-11 (C-B)
  private enabled: boolean = false;

  constructor() {
    // Default to chromatic (no filtering)
  }

  /**
   * Enable or disable scale filtering
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if filtering is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Returns true when filtering should actively constrain notes
   * (i.e., enabled and not in chromatic/all-notes mode)
   */
  isFilteringActive(): boolean {
    return this.enabled && this.scaleType !== 'chromatic';
  }

  /**
   * Set the scale type (e.g., 'major', 'minor', etc.)
   */
  setScaleType(scaleType: string): void {
    if (SCALE_DEFINITIONS[scaleType]) {
      this.scaleType = scaleType;
    } else {
      console.warn(`Unknown scale type: ${scaleType}, defaulting to chromatic`);
      this.scaleType = 'chromatic';
    }
  }

  /**
   * Set the root note (0-11 for C-B)
   */
  setRootNote(rootNote: number): void {
    this.rootNote = rootNote % 12;
  }

  /**
   * Get the current scale type
   */
  getScaleType(): string {
    return this.scaleType;
  }

  /**
   * Get the current root note
   */
  getRootNote(): number {
    return this.rootNote;
  }

  /**
   * Check if a MIDI note is in the current scale
   * @param midiNote - The MIDI note number (0-127)
   * @returns boolean - True if the note is in the scale
   */
  isNoteInScale(midiNote: number): boolean {
    // If filtering is disabled or scale is chromatic, all notes are valid
    if (!this.enabled || this.scaleType === 'chromatic') {
      return true;
    }

    const scale = SCALE_DEFINITIONS[this.scaleType];
    if (!scale) {
      return true; // If scale not found, allow all notes
    }

    // Calculate the note's position relative to the root
    const noteClass = midiNote % 12; // 0-11
    const intervalFromRoot = (noteClass - this.rootNote + 12) % 12;

    // Check if this interval is in the scale's interval pattern
    return scale.intervals.includes(intervalFromRoot);
  }

  /**
   * Get all MIDI notes in the current scale for a given octave range
   * @param startOctave - Starting octave (0-10)
   * @param endOctave - Ending octave (0-10)
   * @returns number[] - Array of MIDI note numbers in the scale
   */
  getScaleNotes(startOctave: number = 0, endOctave: number = 10): number[] {
    const scale = SCALE_DEFINITIONS[this.scaleType];
    if (!scale) {
      return [];
    }

    const notes: number[] = [];
    for (let octave = startOctave; octave <= endOctave; octave++) {
      for (const interval of scale.intervals) {
        const midiNote = (octave * 12) + this.rootNote + interval;
        if (midiNote >= 0 && midiNote <= 127) {
          notes.push(midiNote);
        }
      }
    }

    return notes.sort((a, b) => a - b);
  }

  /**
   * Get the current scale state
   */
  getState() {
    return {
      enabled: this.enabled,
      scaleType: this.scaleType,
      rootNote: this.rootNote,
      rootNoteName: NOTE_NAMES[this.rootNote],
      scaleName: SCALE_DEFINITIONS[this.scaleType]?.name || 'Unknown'
    };
  }

  /**
   * Get all available scale types
   */
  static getAvailableScales(): string[] {
    return Object.keys(SCALE_DEFINITIONS);
  }

  /**
   * Get scale definition by key
   */
  static getScaleDefinition(scaleType: string): ScaleDefinition | undefined {
    return SCALE_DEFINITIONS[scaleType];
  }
}
