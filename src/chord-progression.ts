import { ClockSync } from './clock-sync';

/**
 * Chord Progression Engine
 * Manages chord progressions that sync with the master clock
 * Provides note highlighting and fade-in effects for harmonically compatible notes
 */

// Chord quality definitions (intervals from root)
export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented' | 'major7' | 'minor7' | 'dominant7' | 'sus2' | 'sus4';

export interface ChordIntervals {
  [key: string]: number[];
}

export const CHORD_INTERVALS: ChordIntervals = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7]
};

// Roman numeral chord definition
export interface RomanChord {
  numeral: string;  // e.g., "I", "IV", "V", "ii", "vi", etc.
  quality: ChordQuality;
  degree: number;   // Scale degree (0-11)
}

// Chord progression definition
export interface ChordProgressionDef {
  name: string;
  description: string;
  chords: RomanChord[];
  defaultBeatsPerChord: number;  // How many beats each chord lasts
}

// Active chord state
export interface ActiveChord {
  root: number;      // MIDI note number (0-11, within octave)
  quality: ChordQuality;
  notes: number[];   // MIDI note numbers (0-11, within octave)
  index: number;     // Position in progression
}

// Note highlighting state
export interface NoteHighlight {
  note: number;      // MIDI note number (0-11, within octave)
  opacity: number;   // 0-1, for fade effects
  isUpcoming: boolean; // true if this is for the next chord
}

// Key definitions (root note in MIDI)
export const KEY_NOTES: { [key: string]: number } = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11
};

// Common chord progressions
export const CHORD_PROGRESSIONS: ChordProgressionDef[] = [
  {
    name: 'I-IV-V',
    description: 'Classic rock/pop progression',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-V-vi-IV',
    description: 'Pop-punk progression (Axis of Awesome)',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'V', quality: 'major', degree: 7 },
      { numeral: 'vi', quality: 'minor', degree: 9 },
      { numeral: 'IV', quality: 'major', degree: 5 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'ii-V-I',
    description: 'Jazz standard turnaround',
    chords: [
      { numeral: 'ii', quality: 'minor7', degree: 2 },
      { numeral: 'V', quality: 'dominant7', degree: 7 },
      { numeral: 'I', quality: 'major7', degree: 0 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-vi-IV-V',
    description: '50s progression (doo-wop)',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'vi', quality: 'minor', degree: 9 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'vi-IV-I-V',
    description: 'Sensitive/emotional progression',
    chords: [
      { numeral: 'vi', quality: 'minor', degree: 9 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-IV-I-V',
    description: 'Basic blues progression',
    chords: [
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'IV', quality: 'dominant7', degree: 5 },
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'V', quality: 'dominant7', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: '12-Bar Blues',
    description: 'Standard 12-bar blues',
    chords: [
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'IV', quality: 'dominant7', degree: 5 },
      { numeral: 'IV', quality: 'dominant7', degree: 5 },
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'V', quality: 'dominant7', degree: 7 },
      { numeral: 'IV', quality: 'dominant7', degree: 5 },
      { numeral: 'I', quality: 'dominant7', degree: 0 },
      { numeral: 'V', quality: 'dominant7', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-V-IV-V',
    description: 'Rock progression',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'V', quality: 'major', degree: 7 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-III-IV-iv',
    description: 'Creep progression (major-to-minor)',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'III', quality: 'major', degree: 4 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'iv', quality: 'minor', degree: 5 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-bVII-IV-I',
    description: 'Modal/Mixolydian progression',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'bVII', quality: 'major', degree: 10 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'I', quality: 'major', degree: 0 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'vi-V-IV-V',
    description: 'Minor key progression',
    chords: [
      { numeral: 'vi', quality: 'minor', degree: 9 },
      { numeral: 'V', quality: 'major', degree: 7 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-vi-ii-V',
    description: 'Rhythm changes / Circle of fifths',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'vi', quality: 'minor', degree: 9 },
      { numeral: 'ii', quality: 'minor', degree: 2 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'vi-ii-V-I',
    description: 'Jazz circle progression',
    chords: [
      { numeral: 'vi', quality: 'minor7', degree: 9 },
      { numeral: 'ii', quality: 'minor7', degree: 2 },
      { numeral: 'V', quality: 'dominant7', degree: 7 },
      { numeral: 'I', quality: 'major7', degree: 0 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-bIII-bVII-IV',
    description: 'Andalusian cadence (Phrygian)',
    chords: [
      { numeral: 'I', quality: 'minor', degree: 0 },
      { numeral: 'bVII', quality: 'major', degree: 10 },
      { numeral: 'bVI', quality: 'major', degree: 8 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  },
  {
    name: 'I-IV-vi-V',
    description: 'Optimistic progression',
    chords: [
      { numeral: 'I', quality: 'major', degree: 0 },
      { numeral: 'IV', quality: 'major', degree: 5 },
      { numeral: 'vi', quality: 'minor', degree: 9 },
      { numeral: 'V', quality: 'major', degree: 7 }
    ],
    defaultBeatsPerChord: 4
  }
];

export class ChordProgressionEngine {
  private clockSync: ClockSync;
  private enabled: boolean = false;

  // Current progression state
  private currentProgression: ChordProgressionDef | null = null;
  private keyRoot: number = 0; // C by default
  private currentChordIndex: number = 0;
  private beatsPerChord: number = 4;
  private beatsSinceChordChange: number = 0;
  private fadeInBeats: number = 1; // Start fading in upcoming chord 1 beat before

  // Current and upcoming chords
  private currentChord: ActiveChord | null = null;
  private upcomingChord: ActiveChord | null = null;

  // Callbacks
  private onChordChangeCallbacks: ((chord: ActiveChord) => void)[] = [];
  private onHighlightsUpdateCallbacks: ((highlights: NoteHighlight[]) => void)[] = [];

  constructor(clockSync: ClockSync) {
    this.clockSync = clockSync;
    this.setupClockCallbacks();
  }

  /**
   * Reattach clock listeners after ClockSync callbacks are cleared (e.g., on cleanup/resume)
   */
  reattachClockSync(): void {
    this.setupClockCallbacks();
  }

  /**
   * Sets up callbacks from the clock sync
   */
  private setupClockCallbacks(): void {
    this.clockSync.onQuarterNote(() => {
      if (this.enabled && this.currentProgression && this.clockSync.isRunning()) {
        this.onQuarterNoteTick();
      }
    });

    this.clockSync.onStart(() => {
      if (this.enabled && this.currentProgression) {
        this.resetProgression();
      }
    });

    this.clockSync.onStop(() => {
      // Keep current chord visible when stopped
    });
  }

  /**
   * Handles quarter note ticks from the clock
   */
  private onQuarterNoteTick(): void {
    if (!this.currentProgression) return;

    this.beatsSinceChordChange++;

    // Check if it's time to change chords
    if (this.beatsSinceChordChange >= this.beatsPerChord) {
      this.advanceChord();
      this.beatsSinceChordChange = 0;
    }

    // Update highlights based on current position
    this.updateHighlights();
  }

  /**
   * Advances to the next chord in the progression
   */
  private advanceChord(): void {
    if (!this.currentProgression) return;

    this.currentChordIndex = (this.currentChordIndex + 1) % this.currentProgression.chords.length;
    this.currentChord = this.buildChord(this.currentChordIndex);

    // Notify listeners
    if (this.currentChord) {
      this.onChordChangeCallbacks.forEach(cb => cb(this.currentChord!));
    }

    this.updateUpcomingChord();
  }

  /**
   * Builds an active chord from a roman numeral definition
   */
  private buildChord(index: number): ActiveChord | null {
    if (!this.currentProgression) return null;

    const chordDef = this.currentProgression.chords[index];
    const root = (this.keyRoot + chordDef.degree) % 12;
    const intervals = CHORD_INTERVALS[chordDef.quality];
    const notes = intervals.map(interval => (root + interval) % 12);

    return {
      root,
      quality: chordDef.quality,
      notes,
      index
    };
  }

  /**
   * Updates the upcoming chord
   */
  private updateUpcomingChord(): void {
    if (!this.currentProgression) return;

    const nextIndex = (this.currentChordIndex + 1) % this.currentProgression.chords.length;
    this.upcomingChord = this.buildChord(nextIndex);
  }

  /**
   * Updates note highlights based on current and upcoming chords
   */
  private updateHighlights(): void {
    const highlights: NoteHighlight[] = [];

    if (this.currentChord) {
      // Add current chord notes at full opacity
      this.currentChord.notes.forEach(note => {
        highlights.push({
          note,
          opacity: 1.0,
          isUpcoming: false
        });
      });
    }

    if (this.upcomingChord && this.beatsSinceChordChange >= (this.beatsPerChord - this.fadeInBeats)) {
      // Calculate fade-in opacity for upcoming chord
      const beatsUntilChange = this.beatsPerChord - this.beatsSinceChordChange;
      const fadeProgress = 1 - (beatsUntilChange / this.fadeInBeats);
      const opacity = Math.max(0.2, Math.min(0.6, fadeProgress * 0.6));

      this.upcomingChord.notes.forEach(note => {
        // Only add if not already in current chord
        if (!this.currentChord?.notes.includes(note)) {
          highlights.push({
            note,
            opacity,
            isUpcoming: true
          });
        }
      });
    }

    // Notify listeners
    this.onHighlightsUpdateCallbacks.forEach(cb => cb(highlights));
  }

  /**
   * Resets the progression to the beginning
   */
  private resetProgression(): void {
    this.currentChordIndex = 0;
    this.beatsSinceChordChange = 0;
    this.currentChord = this.buildChord(0);
    this.updateUpcomingChord();

    if (this.currentChord) {
      this.onChordChangeCallbacks.forEach(cb => cb(this.currentChord!));
    }

    this.updateHighlights();
  }

  /**
   * Enables the chord progression engine
   */
  enable(): void {
    this.enabled = true;
    if (this.currentProgression) {
      this.resetProgression();
    }
  }

  /**
   * Disables the chord progression engine
   */
  disable(): void {
    this.enabled = false;
    // Clear highlights
    this.onHighlightsUpdateCallbacks.forEach(cb => cb([]));
  }

  /**
   * Checks if the engine is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sets the current chord progression
   */
  setProgression(progressionName: string): void {
    const progression = CHORD_PROGRESSIONS.find(p => p.name === progressionName);
    if (!progression) {
      console.error(`Progression not found: ${progressionName}`);
      return;
    }

    this.currentProgression = progression;
    this.beatsPerChord = progression.defaultBeatsPerChord;

    if (this.enabled) {
      this.resetProgression();
    }
  }

  /**
   * Sets the key root note
   */
  setKey(key: string): void {
    const root = KEY_NOTES[key];
    if (root === undefined) {
      console.error(`Invalid key: ${key}`);
      return;
    }

    this.keyRoot = root;

    if (this.enabled && this.currentProgression) {
      this.resetProgression();
    }
  }

  /**
   * Sets beats per chord (overrides default from progression)
   */
  setBeatsPerChord(beats: number): void {
    if (beats < 1 || beats > 16) {
      console.error(`Invalid beats per chord: ${beats}`);
      return;
    }

    this.beatsPerChord = beats;
  }

  /**
   * Sets fade-in duration in beats
   */
  setFadeInBeats(beats: number): void {
    if (beats < 0 || beats > this.beatsPerChord) {
      console.error(`Invalid fade-in beats: ${beats}`);
      return;
    }

    this.fadeInBeats = beats;
  }

  /**
   * Gets the current chord
   */
  getCurrentChord(): ActiveChord | null {
    return this.currentChord;
  }

  /**
   * Gets the upcoming chord
   */
  getUpcomingChord(): ActiveChord | null {
    return this.upcomingChord;
  }

  /**
   * Registers callback for chord changes
   */
  onChordChange(callback: (chord: ActiveChord) => void): void {
    this.onChordChangeCallbacks.push(callback);
  }

  /**
   * Registers callback for highlight updates
   */
  onHighlightsUpdate(callback: (highlights: NoteHighlight[]) => void): void {
    this.onHighlightsUpdateCallbacks.push(callback);
  }

  /**
   * Clears all callbacks
   */
  clearCallbacks(): void {
    this.onChordChangeCallbacks = [];
    this.onHighlightsUpdateCallbacks = [];
  }

  /**
   * Gets all available progressions
   */
  getAvailableProgressions(): ChordProgressionDef[] {
    return CHORD_PROGRESSIONS;
  }

  /**
   * Gets all available keys
   */
  getAvailableKeys(): string[] {
    return ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  }
}
