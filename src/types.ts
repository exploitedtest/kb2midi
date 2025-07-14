// MIDI Types and Interfaces

export interface MIDIState {
  midiAccess: WebMidi.MIDIAccess | null;
  midiOutput: WebMidi.MIDIOutput | null;
  isConnected: boolean;
}

export interface KeyboardLayout {
  name: string;
  keys: KeyMapping;
  octaveDownKey: string;
  octaveUpKey: string;
  blackKeyPositions: number[];
}

export interface KeyMapping {
  [key: string]: number; // Key code to MIDI note offset
}

export interface ActiveNote {
  note: number;
  velocity: number;
  timestamp: number;
}

export interface ControllerState {
  currentOctave: number;
  velocity: number;
  midiChannel: number;
  activeNotes: Map<string, ActiveNote>;
  pressedKeys: Set<string>;
  sustainPedalActive: boolean;
  sustainedNotes: Set<number>;
  currentLayout: string;
}

export interface VelocityCurve {
  name: string;
  type: 'linear' | 'exponential' | 'logarithmic' | 'custom';
  curve?: number[]; // For custom curves
  exponent?: number; // For exponential curves
}

export interface ArpeggiatorState {
  enabled: boolean;
  pattern: ArpeggiatorPattern;
  rate: number; // In BPM
  gateLength: number; // 0-1
  swing: number; // 0-1
  octaveRange: number;
  noteOrder: number[];
  currentStep: number;
}

export type ArpeggiatorPattern = 'up' | 'down' | 'up-down' | 'down-up' | 'random' | 'chord';

export interface ControllerSettings {
  velocityCurve: VelocityCurve;
  noteOffVelocity: number;
  aftertouchEnabled: boolean;
  aftertouchThreshold: number; // ms before aftertouch starts
  defaultMidiChannel: number;
  defaultVelocity: number;
  keyRepeatEnabled: boolean;
  keyRepeatDelay: number;
  keyRepeatRate: number;
}

export interface MIDIMessage {
  type: 'noteon' | 'noteoff' | 'cc' | 'programchange' | 'pitchbend';
  channel: number;
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  program?: number;
  bend?: number;
}

export interface UIState {
  theme: 'light' | 'dark';
  showVelocity: boolean;
  showOctaveRange: boolean;
  showMIDIActivity: boolean;
  highlightScale: boolean;
  currentScale: Scale;
}

export interface Scale {
  name: string;
  notes: number[]; // Semitone offsets from root
  root: number; // MIDI note number
}

// Preset system types
export interface Preset {
  id: string;
  name: string;
  description?: string;
  settings: ControllerSettings;
  layout: string;
  arpeggiatorState?: ArpeggiatorState;
}

// Web MIDI API types are provided by the browser
// No need to extend Navigator as it's already defined

// MIDI Constants
export const MIDI_NOTE_ON = 0x90;
export const MIDI_NOTE_OFF = 0x80;
export const MIDI_CC = 0xB0;
export const MIDI_PROGRAM_CHANGE = 0xC0;
export const MIDI_PITCH_BEND = 0xE0;

export const MIDI_SUSTAIN_PEDAL = 64;
export const MIDI_SOSTENUTO_PEDAL = 66;
export const MIDI_SOFT_PEDAL = 67;

export const MIDI_MOD_WHEEL = 1;
export const MIDI_VOLUME = 7;
export const MIDI_PAN = 10;
export const MIDI_EXPRESSION = 11;

// Note name helpers
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getMIDINoteName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const noteName = NOTE_NAMES[note % 12];
  return `${noteName}${octave}`;
}

export function getMIDINoteFromName(name: string): number {
  const match = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) throw new Error('Invalid note name');
  
  const noteName = match[1];
  const octave = parseInt(match[2]);
  const noteIndex = NOTE_NAMES.indexOf(noteName);
  
  if (noteIndex === -1) throw new Error('Invalid note name');
  
  return (octave + 1) * 12 + noteIndex;
}