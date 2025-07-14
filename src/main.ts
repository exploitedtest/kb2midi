import { MIDIEngine } from './midi-engine';
import { KeyboardInput } from './keyboard-input';
import { UIController } from './ui-controller';
import { ControllerState } from './types';

/**
 * Main controller class that orchestrates all components
 * Coordinates between MIDI engine, keyboard input, and UI controller
 * Manages the overall state and event flow of the application
 */
class MIDIController {
  private midiEngine: MIDIEngine;
  private keyboardInput: KeyboardInput;
  private uiController: UIController;
  
  private state: ControllerState = {
    currentOctave: 4,
    velocity: 80,
    midiChannel: 1,
    activeNotes: new Map(),
    pressedKeys: new Set(),
    sustainPedalActive: false,
    sustainedNotes: new Set(),
    currentLayout: 'simple'
  };

  constructor() {
    this.midiEngine = new MIDIEngine();
    this.keyboardInput = new KeyboardInput();
    this.uiController = new UIController();
    
    this.initialize();
  }

  /**
   * Initializes the MIDI controller application
   * Sets up MIDI connection, keyboard handlers, and UI event handlers
   * @returns Promise<void> - Resolves when initialization is complete
   */
  private async initialize(): Promise<void> {
    // Initialize MIDI
    this.uiController.updateStatus('Initializing MIDI...', 'info');
    
    const midiReady = await this.midiEngine.initialize();
    
    if (midiReady) {
      this.uiController.updateStatus('MIDI Ready! 🎹', 'success');
    } else {
      this.uiController.updateStatus('No MIDI outputs found - Check virtual MIDI port', 'error');
      this.uiController.showMIDINotAvailable();
    }

    // Set up MIDI callbacks
    this.midiEngine.onConnectionChange((connected) => {
      if (connected) {
        this.uiController.updateStatus('MIDI Connected! 🎹', 'success');
      } else {
        this.uiController.updateStatus('MIDI Disconnected', 'error');
      }
    });

    this.midiEngine.onErrorHandler((error) => {
      this.uiController.updateStatus(error.message, 'error');
    });

    // Set up keyboard input handlers
    this.setupKeyboardHandlers();
    
    // Set up UI handlers
    this.setupUIHandlers();
    
    // Initialize UI
    this.updateUI();
  }

  /**
   * Sets up keyboard event handlers for the current layout
   * Registers note on/off handlers for each key and special key handlers
   */
  private setupKeyboardHandlers(): void {
    const layout = this.keyboardInput.getLayout();
    
    // Register note handlers for each key in the layout
    Object.entries(layout.keys).forEach(([keyCode, noteOffset]) => {
      this.keyboardInput.onNoteOn(keyCode, (velocity) => {
        const note = (this.state.currentOctave * 12) + noteOffset;
        this.playNote(note, velocity);
        this.uiController.updateKeyVisual(keyCode, true);
      });
      
      this.keyboardInput.onNoteOff(keyCode, () => {
        const note = (this.state.currentOctave * 12) + noteOffset;
        this.stopNote(note);
        this.uiController.updateKeyVisual(keyCode, false);
      });
    });
    
    // Register special keys
    this.keyboardInput.onSpecialKey('octaveDown', () => {
      this.changeOctave(-1);
    });
    
    this.keyboardInput.onSpecialKey('octaveUp', () => {
      this.changeOctave(1);
    });
    
    this.keyboardInput.onSpecialKey('sustainOn', () => {
      this.handleSustainOn();
    });
    
    this.keyboardInput.onSpecialKey('sustainOff', () => {
      this.handleSustainOff();
    });
    
    // Register sustain pedal
    this.keyboardInput.registerSustainPedal();
  }

  /**
   * Sets up UI event handlers for layout changes and piano clicks
   */
  private setupUIHandlers(): void {
    // Layout change handler
    this.uiController.onLayoutChange((layoutName) => {
      this.switchLayout(layoutName);
    });
    
    // Piano click handler
    this.uiController.onPianoClick((note, down) => {
      if (down) {
        this.playNote(note, this.uiController.getVelocity());
      } else {
        this.stopNote(note);
      }
    });
  }

  /**
   * Plays a MIDI note with the specified velocity
   * Prevents duplicate note on messages for the same note
   * @param note - The MIDI note number to play
   * @param velocityOverride - Optional velocity override (defaults to UI velocity)
   */
  private playNote(note: number, velocityOverride?: number): void {
    // Check if note is already playing
    if (this.state.activeNotes.has(note.toString())) return;
    
    const velocity = velocityOverride || this.uiController.getVelocity();
    const channel = this.uiController.getMidiChannel();
    
    this.midiEngine.playNote(note, velocity, channel);
    this.state.activeNotes.set(note.toString(), { note, velocity, timestamp: Date.now() });
    this.uiController.updatePianoKey(note, true);
  }

  /**
   * Stops a MIDI note
   * Handles sustain pedal logic - notes are held if sustain is active
   * @param note - The MIDI note number to stop
   */
  private stopNote(note: number): void {
    const activeNote = this.state.activeNotes.get(note.toString());
    if (!activeNote) return;
    
    const channel = this.uiController.getMidiChannel();
    
    if (this.state.sustainPedalActive) {
      this.state.sustainedNotes.add(note);
    } else {
      this.midiEngine.stopNote(note, 0, channel);
      this.state.activeNotes.delete(note.toString());
      this.uiController.updatePianoKey(note, false);
    }
  }

  /**
   * Handles sustain pedal activation
   * Sends MIDI CC 64 (sustain) and updates visual state
   */
  private handleSustainOn(): void {
    if (this.state.sustainPedalActive) return;
    
    this.state.sustainPedalActive = true;
    const channel = this.uiController.getMidiChannel();
    this.midiEngine.setSustainPedal(true, channel);
    this.uiController.updateKeyVisual('Space', true);
  }

  /**
   * Handles sustain pedal release
   * Sends MIDI CC 64 (sustain off) and releases all sustained notes
   */
  private handleSustainOff(): void {
    if (!this.state.sustainPedalActive) return;
    
    this.state.sustainPedalActive = false;
    const channel = this.uiController.getMidiChannel();
    this.midiEngine.setSustainPedal(false, channel);
    this.uiController.updateKeyVisual('Space', false);
    
    // Release all sustained notes
    this.state.sustainedNotes.forEach(note => {
      this.midiEngine.stopNote(note, 0, channel);
      this.state.activeNotes.delete(note.toString());
      this.uiController.updatePianoKey(note, false);
    });
    this.state.sustainedNotes.clear();
  }

  /**
   * Changes the current octave by the specified direction
   * Stops all notes before changing octave to prevent stuck notes
   * @param direction - The direction to change octave (-1 for down, 1 for up)
   */
  private changeOctave(direction: number): void {
    const newOctave = this.state.currentOctave + direction;
    
    if (newOctave >= 0 && newOctave <= 8) {
      // Stop all notes before changing octave
      this.stopAllNotes();
      
      this.state.currentOctave = newOctave;
      this.uiController.updateOctaveDisplay(newOctave);
      this.updateUI();
    }
  }

  /**
   * Switches to a different keyboard layout
   * Stops all notes and re-registers keyboard handlers for the new layout
   * @param layoutName - The name of the layout to switch to
   */
  private switchLayout(layoutName: string): void {
    // Stop all notes before switching
    this.stopAllNotes();
    
    this.state.currentLayout = layoutName;
    this.keyboardInput.setLayout(layoutName);
    
    // Re-setup keyboard handlers for new layout
    this.setupKeyboardHandlers();
    
    // Update UI
    this.updateUI();
  }

  /**
   * Stops all currently playing notes
   * Sends note off messages for all active notes and clears state
   */
  private stopAllNotes(): void {
    const channel = this.uiController.getMidiChannel();
    
    this.state.activeNotes.forEach((activeNote) => {
      this.midiEngine.stopNote(activeNote.note, 0, channel);
      this.uiController.updatePianoKey(activeNote.note, false);
    });
    
    this.state.activeNotes.clear();
    this.state.sustainedNotes.clear();
  }

  /**
   * Updates the UI to reflect the current state
   * Recreates piano display and keyboard mapping for the current layout
   */
  private updateUI(): void {
    const layout = this.keyboardInput.getLayout();
    this.uiController.createPiano(layout, this.state.currentOctave);
    this.uiController.updateKeyboardMapping(layout);
    this.uiController.updateOctaveDisplay(this.state.currentOctave);
  }
}

/**
 * Initializes the MIDI controller application when the DOM is loaded
 * Creates a new MIDIController instance to start the application
 */
document.addEventListener('DOMContentLoaded', () => {
  new MIDIController();
});