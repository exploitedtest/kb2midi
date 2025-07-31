import { MIDIEngine } from './midi-engine';
import { KeyboardInput } from './keyboard-input';
import { UIController } from './ui-controller';
import { ClockSync } from './clock-sync';
import { Arpeggiator } from './arpeggiator';
import { ControllerState, ArpeggiatorPattern } from './types';

// Enhanced control configuration with better type safety
interface ControlConfig {
  id: string;
  setter: (value: string) => void;
  type?: 'select' | 'range' | 'button';
  displayId?: string; // For range controls that show values
  displayFormatter?: (value: number) => string;
}

/**
 * Main controller class that orchestrates all components
 * Coordinates between MIDI engine, keyboard input, UI controller, clock sync, and arpeggiator
 * Manages the overall state and event flow of the application
 */
class MIDIController {
  private midiEngine: MIDIEngine;
  private keyboardInput: KeyboardInput;
  private uiController: UIController;
  private clockSync: ClockSync;
  private arpeggiator: Arpeggiator;
  
  private state: ControllerState = {
    currentOctave: 4,
    velocity: 80,
    midiChannel: 1,
    activeNotes: new Map(),
    pressedKeys: new Set(),
    sustainPedalActive: false,
    sustainedNotes: new Set(),
    currentLayout: 'expanded'
  };

  constructor() {
    this.clockSync = new ClockSync();
    this.midiEngine = new MIDIEngine(this.clockSync);
    this.keyboardInput = new KeyboardInput();
    this.uiController = new UIController();
    this.arpeggiator = new Arpeggiator(this.clockSync);
    
    this.initialize();
  }

  /**
   * Initializes the MIDI controller application
   * Sets up MIDI connection, keyboard handlers, UI event handlers, and clock sync
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

    // Set up clock sync callbacks
    this.setupClockSyncCallbacks();

    // Set up arpeggiator
    this.setupArpeggiator();

    // Set up keyboard input handlers
    this.setupKeyboardHandlers();
    
    // Set up UI handlers
    this.setupUIHandlers();
    
    // Initialize UI
    this.updateUI();
  }

  /**
   * Sets up clock sync event handlers
   */
  private setupClockSyncCallbacks(): void {
    let lastBPMUpdate = 0;
    
    // Update UI when clock status changes
    this.clockSync.onStart(() => {
      const bpm = this.clockSync.getBPM();
      this.uiController.updateClockStatus('synced', bpm);
    });

    this.clockSync.onStop(() => {
      this.uiController.updateClockStatus('stopped');
    });

    // Optimized BPM updates - only update every second
    this.clockSync.onTick(() => {
      const now = performance.now();
      if (now - lastBPMUpdate > 1000) { // Update every second
        if (this.clockSync.isRunning()) {
          const bpm = this.clockSync.getBPM();
          this.uiController.updateClockStatus('synced', bpm);
        }
        lastBPMUpdate = now;
      }
    });

    // Beat indicator on quarter notes
    this.clockSync.onQuarterNote(() => {
      this.uiController.updateBeatIndicator();
    });
  }

  /**
   * Sets up arpeggiator functionality
   */
  private setupArpeggiator(): void {
    // Connect arpeggiator to MIDI engine
    this.arpeggiator.setMidiEngine(this.midiEngine);

    // Set up arpeggiator step callbacks for visual feedback
    this.arpeggiator.onStep((_step, note) => {
      // Visual feedback for arpeggiator steps
      this.uiController.updatePianoKey(note, true);
      
      // Turn off after a short delay
      setTimeout(() => {
        this.uiController.updatePianoKey(note, false);
      }, 100);
    });
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
   * Sets up all UI event handlers using a unified control wiring system
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

    // Unified control configurations
    const controlConfigs: ControlConfig[] = [
      // Panic button
      {
        id: 'panic-button',
        setter: () => {
          this.stopAllNotes();
          this.midiEngine.panic();
          this.uiController.updateStatus('All notes stopped', 'info');
        },
        type: 'button'
      },
      
      // Arpeggiator toggle
      {
        id: 'arpeggiator-toggle',
        setter: () => {
          this.toggleArpeggiator();
          const enabled = this.arpeggiator.isEnabled();
          const button = document.getElementById('arpeggiator-toggle');
          if (button) {
            button.textContent = enabled ? 'Disable Arpeggiator' : 'Enable Arpeggiator';
          }
          
          // Show/hide arpeggiator controls
          const arpControls = document.getElementById('arpeggiator-controls');
          if (arpControls) {
            arpControls.style.display = enabled ? 'block' : 'none';
          }
        },
        type: 'button'
      },
      
      // Arpeggiator pattern
      {
        id: 'arp-pattern',
        setter: (value) => this.arpeggiator.setPattern(value as ArpeggiatorPattern),
        type: 'select'
      },
      
      // Arpeggiator division
      {
        id: 'arp-division',
        setter: (value) => this.arpeggiator.setClockDivisor(parseInt(value)),
        type: 'select'
      },
      
      // Arpeggiator gate
      {
        id: 'arp-gate',
        setter: (value) => {
          const numValue = parseInt(value);
          this.arpeggiator.setGateLength(numValue / 100);
        },
        type: 'range',
        displayId: 'arp-gate-value',
        displayFormatter: (value) => `${value}%`
      },
      
      // Arpeggiator swing
      {
        id: 'arp-swing',
        setter: (value) => {
          const numValue = parseInt(value);
          this.arpeggiator.setSwing(numValue / 100);
        },
        type: 'range',
        displayId: 'arp-swing-value',
        displayFormatter: (value) => `${value}%`
      }
    ];

    // Wire up all controls using unified system
    this.wireControls(controlConfigs);
  }

  /**
   * Wires up controls using a unified event handling system
   * @param configs - Array of control configurations to wire
   */
  private wireControls(configs: ControlConfig[]): void {
    configs.forEach(config => {
      const element = document.getElementById(config.id);
      if (!element) {
        console.warn(`Control element not found: ${config.id}`);
        return;
      }

      const eventType = config.type === 'range' ? 'input' : 'change';
      
      // Wire the main control event
      element.addEventListener(eventType, () => {
        const value = (element as HTMLInputElement | HTMLSelectElement).value;
        config.setter(value);
        
        // Update display if configured
        if (config.displayId && config.displayFormatter) {
          const displayElement = document.getElementById(config.displayId);
          if (displayElement) {
            const numValue = parseInt(value);
            displayElement.textContent = config.displayFormatter(numValue);
          }
        }
      });
    });
  }

  /**
   * Plays a MIDI note with the specified velocity
   * Prevents duplicate note on messages for the same note
   * @param note - The MIDI note number to play
   * @param velocityOverride - Optional velocity override (defaults to UI velocity)
   */
  private playNote(note: number, velocityOverride?: number): void {
    // Validate note parameter
    if (note === undefined || note === null || note < 0 || note > 127) {
      console.error(`Invalid note in main playNote: ${note} (type: ${typeof note})`);
      return;
    }
    
    // Check if note is already playing
    if (this.state.activeNotes.has(note.toString())) return;
    
    const velocity = velocityOverride || this.uiController.getVelocity();
    const channel = this.uiController.getMidiChannel();
    
    // Validate velocity and channel
    if (velocity === undefined || velocity === null || velocity < 0 || velocity > 127) {
      console.error(`Invalid velocity in main playNote: ${velocity} (type: ${typeof velocity})`);
      return;
    }
    if (channel === undefined || channel === null || channel < 1 || channel > 16) {
      console.error(`Invalid channel in main playNote: ${channel} (type: ${typeof channel})`);
      return;
    }
    
    this.midiEngine.playNote(note, velocity, channel);
    this.state.activeNotes.set(note.toString(), { note, velocity, timestamp: Date.now() });
    this.uiController.updatePianoKey(note, true);

    // Add note to arpeggiator if enabled
    if (this.arpeggiator.isEnabled()) {
      const currentNotes = Array.from(this.state.activeNotes.values()).map(n => n.note);
      this.arpeggiator.setNotes(currentNotes);
    }
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

    // Update arpeggiator notes
    if (this.arpeggiator.isEnabled()) {
      const currentNotes = Array.from(this.state.activeNotes.values()).map(n => n.note);
      this.arpeggiator.setNotes(currentNotes);
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
   * Toggles the arpeggiator on/off
   */
  private toggleArpeggiator(): void {
    const enabled = !this.arpeggiator.isEnabled();
    this.arpeggiator.setEnabled(enabled);
    
    if (enabled) {
      const currentNotes = Array.from(this.state.activeNotes.values()).map(n => n.note);
      this.arpeggiator.setNotes(currentNotes);
      this.uiController.updateStatus('Arpeggiator Enabled', 'success');
    } else {
      this.uiController.updateStatus('Arpeggiator Disabled', 'info');
    }
  }

  /**
   * Gets the current arpeggiator state
   */
  getArpeggiatorState() {
    return this.arpeggiator.getState();
  }

  /**
   * Gets the current clock sync state
   */
  getClockSyncState() {
    return this.clockSync.getState();
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
    
    // Ensure the layout select reflects the current state
    const layoutSelect = document.getElementById('layout-select') as HTMLSelectElement;
    if (layoutSelect && layoutSelect.value !== layout.name) {
      layoutSelect.value = layout.name;
    }
    
    this.uiController.createPiano(layout, this.state.currentOctave);
    this.uiController.updateKeyboardMapping(layout);
    this.uiController.updateOctaveDisplay(this.state.currentOctave);
  }

  /**
   * Cleans up all resources when the application is closing
   * Stops all notes, cleans up MIDI connections, and removes event listeners
   */
  cleanup(): void {
    // Stop all active notes
    this.stopAllNotes();
    
    // Clean up MIDI engine
    this.midiEngine.cleanup();
    
    // Clean up keyboard input
    this.keyboardInput.cleanup();
    
    // Clean up arpeggiator
    this.arpeggiator.setEnabled(false);
    this.arpeggiator.clearStepCallbacks();
    
    // Clean up clock sync callbacks
    this.clockSync.clearCallbacks();
    
    // Clear local state
    this.state.activeNotes.clear();
    this.state.sustainedNotes.clear();
    this.state.pressedKeys.clear();
  }
}

/**
 * Initializes the MIDI controller application when the DOM is loaded
 * Creates a new MIDIController instance to start the application
 */
document.addEventListener('DOMContentLoaded', () => {
  const controller = new MIDIController();
  
  // Clean up resources when the window is about to close
  window.addEventListener('beforeunload', () => {
    controller.cleanup();
  });
  
  // Also clean up on page visibility change (for mobile/background scenarios)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      controller.cleanup();
    }
  });
});