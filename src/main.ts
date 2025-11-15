import { MIDIEngine } from './midi-engine';
import { KeyboardInput } from './keyboard-input';
import { UIController } from './ui-controller';
import { ClockSync } from './clock-sync';
import { Arpeggiator } from './arpeggiator';
import { ParticleEngine } from './particle-engine';
import { ControllerState, ArpeggiatorPattern, MIDI_MOD_WHEEL } from './types';

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
  private particleEngine: ParticleEngine | null = null;
  private isActive = false;
  // Tracks whether the app is in its initial async initialization
  private initializing = true;
  // Prevents overlapping resume calls
  private resuming = false;
  private preferredClockInputId: string = 'auto';
  // Momentary arpeggiator rate boost state (Tab key)
  private arpBoostActive: boolean = false;
  private arpBoostBaseDivisor: number | null = null;
  
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

    // Initialize particle engine
    try {
      this.particleEngine = new ParticleEngine('particle-canvas');
    } catch (error) {
      console.warn('Could not initialize particle engine:', error);
    }

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
    this.initializing = true;
    
    try {
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
    
    // Wire up velocity changes to keyboard input
    this.uiController.onVelocityChange((velocity) => {
      this.keyboardInput.setVelocity(velocity);
    });
    
    // Initialize keyboard input velocity to match UI default
    this.keyboardInput.setVelocity(this.uiController.getVelocity());
    
    // Initialize UI
    this.updateUI();

      // Mark active after successful init
      this.isActive = true;
    } finally {
      this.initializing = false;
    }

    // Populate clock inputs and wire selection
    this.refreshClockInputs();
    this.uiController.onClockInputChange((id) => this.handleClockInputSelect(id));

    // React to MIDI port changes (hot-plug, DAW devices on/off)
    this.midiEngine.onPortsChangeHandler(() => {
      this.refreshClockInputs();
      const inputs = this.midiEngine.getAvailableInputs();
      if (this.preferredClockInputId === 'auto') {
        this.midiEngine.selectBestClockInput();
      } else if (!inputs.find(i => i.id === this.preferredClockInputId)) {
        this.midiEngine.selectBestClockInput();
        this.preferredClockInputId = 'auto';
        this.refreshClockInputs();
      }
    });
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
      this.updateArpeggiatorButtonText();
    });

    this.clockSync.onStop(() => {
      this.uiController.updateClockStatus('stopped');
      this.updateArpeggiatorButtonText();
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
    // Provide live channel and velocity from UI
    this.arpeggiator.setParamGetters(
      () => this.uiController.getMidiChannel(),
      () => this.uiController.getVelocity()
    );

    // Set up arpeggiator step callbacks for optimized visual feedback
    this.arpeggiator.onStep((_step, note) => {
      // Visual feedback for arpeggiator steps using batched updates
      this.uiController.updatePianoKey(note, true);

      // Spawn particles for arpeggiator notes
      if (this.particleEngine) {
        const velocity = this.uiController.getVelocity();
        this.particleEngine.spawnParticles(note, velocity);
      }

      // Use requestAnimationFrame for smoother visual feedback
      // Reduce flash duration for very fast arpeggios to prevent visual pile-up
      const flashDuration = this.calculateArpeggiatorFlashDuration();
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.uiController.updatePianoKey(note, false);
        }, flashDuration);
      });
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
      this.uiController.updateOctaveDownIndicator(true);
      this.uiController.updateKeyVisual('ArrowLeft', true);
    });
    
    this.keyboardInput.onSpecialKey('octaveUp', () => {
      this.uiController.updateOctaveUpIndicator(true);
      this.uiController.updateKeyVisual('ArrowRight', true);
    });
    
    this.keyboardInput.onSpecialKey('octaveDownOff', () => {
      this.changeOctave(-1);
      this.uiController.updateOctaveDownIndicator(false);
      this.uiController.updateKeyVisual('ArrowLeft', false);
    });
    
    this.keyboardInput.onSpecialKey('octaveUpOff', () => {
      this.changeOctave(1);
      this.uiController.updateOctaveUpIndicator(false);
      this.uiController.updateKeyVisual('ArrowRight', false);
    });
    
    this.keyboardInput.onSpecialKey('sustainOn', () => {
      this.handleSustainOn();
    });
    
    this.keyboardInput.onSpecialKey('sustainOff', () => {
      this.handleSustainOff();
    });
    
    // Register sustain pedal
    this.keyboardInput.registerSustainPedal();

    // Register Mod Wheel and Pitch Bend momentary controls
    this.keyboardInput.registerModWheel();
    this.keyboardInput.registerPitchBend();
    this.keyboardInput.registerArpBoost();

    // Special actions for Mod Wheel (ArrowUp)
    this.keyboardInput.onSpecialKey('modOn', () => {
      const channel = this.uiController.getMidiChannel();
      this.midiEngine.sendMessage({ type: 'cc', channel, controller: MIDI_MOD_WHEEL, value: 127 });
      this.uiController.updateModIndicator(true);
      this.uiController.updateKeyVisual('ArrowUp', true);
    });
    this.keyboardInput.onSpecialKey('modOff', () => {
      const channel = this.uiController.getMidiChannel();
      this.midiEngine.sendMessage({ type: 'cc', channel, controller: MIDI_MOD_WHEEL, value: 0 });
      this.uiController.updateModIndicator(false);
      this.uiController.updateKeyVisual('ArrowUp', false);
    });

    // Special actions for Pitch Bend Down (ArrowDown)
    this.keyboardInput.onSpecialKey('pitchDownOn', () => {
      const channel = this.uiController.getMidiChannel();
      this.midiEngine.sendMessage({ type: 'pitchbend', channel, bend: -8192 });
      this.uiController.updatePitchIndicator(true);
      this.uiController.updateKeyVisual('ArrowDown', true);
    });
    this.keyboardInput.onSpecialKey('pitchDownOff', () => {
      const channel = this.uiController.getMidiChannel();
      this.midiEngine.sendMessage({ type: 'pitchbend', channel, bend: 0 });
      this.uiController.updatePitchIndicator(false);
      this.uiController.updateKeyVisual('ArrowDown', false);
    });

    // Momentary arpeggiator rate boost (Tab)
    this.keyboardInput.onSpecialKey('arpBoostOn', () => {
      if (this.arpBoostActive) return;
      if (!this.arpeggiator.isEnabled()) return;
      const state = this.arpeggiator.getState();
      this.arpBoostBaseDivisor = state.clockDivisor || 4;
      const boosted = Math.min(this.arpBoostBaseDivisor * 2, 8);
      if (boosted !== state.clockDivisor) {
        this.arpeggiator.setClockDivisor(boosted);
        const sel = document.getElementById('arp-division') as HTMLSelectElement | null;
        if (sel) sel.value = String(boosted);
      }
      this.arpBoostActive = true;
    });
    this.keyboardInput.onSpecialKey('arpBoostOff', () => {
      if (!this.arpBoostActive) return;
      const base = this.arpBoostBaseDivisor ?? this.arpeggiator.getState().clockDivisor;
      this.arpeggiator.setClockDivisor(base);
      const sel = document.getElementById('arp-division') as HTMLSelectElement | null;
      if (sel) sel.value = String(base);
      this.arpBoostActive = false;
      this.arpBoostBaseDivisor = null;
    });
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
        const velocity = this.uiController.getVelocity();
        this.playNote(note, velocity);
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
          // Panic only on the current channel to avoid affecting other instruments
          this.midiEngine.panic(this.uiController.getMidiChannel());
          this.uiController.updateStatus('All notes stopped', 'info');
        },
        type: 'button'
      },
      
      // Arpeggiator toggle
      {
        id: 'arpeggiator-toggle',
        setter: () => {
          this.toggleArpeggiator();
          this.updateArpeggiatorButtonText();
          
          // Show/hide arpeggiator controls
          const arpControls = document.getElementById('arpeggiator-controls');
          if (arpControls) {
            arpControls.style.display = this.arpeggiator.isEnabled() ? 'block' : 'none';
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

      // Use appropriate event per control type (mobile + desktop friendly)
      const eventType =
        config.type === 'range' ? 'input' :
        config.type === 'button' ? 'click' :
        'change';
      
      // Wire the main control event
      element.addEventListener(eventType, () => {
        let value: string;
        
        // For buttons, don't try to get a value - just call the setter
        if (config.type === 'button') {
          value = '';
          config.setter(value);
        } else {
          value = (element as HTMLInputElement | HTMLSelectElement).value;
          config.setter(value);
        }
        
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
   * When arpeggiator is enabled, only updates the note list without immediate playback
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
    
    // Store the note in active notes for state tracking (capture channel used)
    this.state.activeNotes.set(note.toString(), { note, velocity, timestamp: Date.now(), channel });

    if (this.arpeggiator.isEnabled()) {
      // When arpeggiator is enabled, add note to sequence in press order
      this.arpeggiator.addNote(note);

      // Update visual feedback to show key is "held" for arpeggiator
      this.uiController.updatePianoKey(note, true);
    } else {
      // When arpeggiator is disabled, play note immediately (normal behavior)
      this.midiEngine.playNote(note, velocity, channel);
      this.uiController.updatePianoKey(note, true);

      // Spawn particles for this note
      if (this.particleEngine) {
        this.particleEngine.spawnParticles(note, velocity);
      }
    }
  }

  /**
   * Stops a MIDI note
   * When arpeggiator is enabled, only updates the note list without immediate note-off
   * @param note - The MIDI note number to stop
   */
  private stopNote(note: number): void {
    const activeNote = this.state.activeNotes.get(note.toString());
    if (!activeNote) return;
    
    const channel = this.uiController.getMidiChannel();
    
    if (this.arpeggiator.isEnabled()) {
      // When arpeggiator is enabled, remove note from sequence
      this.arpeggiator.removeNote(note);
      this.state.activeNotes.delete(note.toString());
      this.uiController.updatePianoKey(note, false);
      } else {
      // Normal behavior when arpeggiator is disabled
      if (this.state.sustainPedalActive) {
        this.state.sustainedNotes.add(note);
      } else {
        const ch = activeNote.channel ?? channel;
        this.midiEngine.stopNote(note, 0, ch);
        this.state.activeNotes.delete(note.toString());
        this.uiController.updatePianoKey(note, false);
      }
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
   * Handles transition between immediate playback and clock-driven playback
   */
  private toggleArpeggiator(): void {
    const enabled = !this.arpeggiator.isEnabled();
    const currentNotes = Array.from(this.state.activeNotes.values());
    
    if (enabled) {
      // Enabling arpeggiator: stop any immediately playing notes, let clock take over
      currentNotes.forEach(activeNote => {
        const ch = activeNote.channel ?? this.uiController.getMidiChannel();
        this.midiEngine.stopNote(activeNote.note, 0, ch);
      });
      
      this.arpeggiator.setEnabled(enabled);
      // Add notes to arpeggiator in the order they're currently held
      // Note: This preserves the order from activeNotes Map iteration
      currentNotes.forEach(activeNote => {
        this.arpeggiator.addNote(activeNote.note);
      });
      this.uiController.updateStatus('Arpeggiator Enabled - Clock Driven', 'success');
    } else {
      // Disabling arpeggiator: clear arpeggiator and immediately play all held notes
      this.arpeggiator.setEnabled(enabled);
      this.arpeggiator.clearNotes();
      
      currentNotes.forEach(activeNote => {
        this.midiEngine.playNote(activeNote.note, activeNote.velocity, this.uiController.getMidiChannel());
      });
      
      this.uiController.updateStatus('Arpeggiator Disabled', 'info');
    }
  }

  /**
   * Updates the arpeggiator button text based on enabled state and clock sync status
   */
  private updateArpeggiatorButtonText(): void {
    const button = document.getElementById('arpeggiator-toggle');
    if (!button) return;
    
    const enabled = this.arpeggiator.isEnabled();
    
    if (!enabled) {
      button.textContent = 'Enable Arpeggiator';
    } else {
      const clockSynced = this.clockSync.isRunning();
      button.textContent = clockSynced ? 'Disable Arpeggiator' : 'Disable Arpeggiator (No Clock)';
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
   * Calculates appropriate flash duration for arpeggiator visual feedback
   * Shorter durations for faster arpeggios to prevent visual pile-up
   */
  private calculateArpeggiatorFlashDuration(): number {
    if (!this.arpeggiator.isEnabled()) return 100; // Default 100ms
    
    const state = this.arpeggiator.getState();
    const bpm = this.clockSync.getBPM();
    
    // Calculate time between arpeggiator steps in milliseconds
    const beatTime = (60 / bpm) * 1000; // ms per beat
    const stepTime = beatTime / state.clockDivisor; // ms per arp step
    
    // Flash duration should be max 50% of step time to prevent overlap
    // But minimum 30ms for visibility, maximum 100ms for reasonable feedback
    const calculatedDuration = Math.min(stepTime * 0.5, 100);
    return Math.max(calculatedDuration, 30);
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
    // Stop using the channels each note was played on
    this.state.activeNotes.forEach((activeNote) => {
      const ch = activeNote.channel ?? this.uiController.getMidiChannel();
      this.midiEngine.stopNote(activeNote.note, 0, ch);
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
    this.updateArpeggiatorButtonText();
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

    // Clean up particle engine
    if (this.particleEngine) {
      this.particleEngine.clear();
    }

    // Clear local state
    this.state.activeNotes.clear();
    this.state.sustainedNotes.clear();
    this.state.pressedKeys.clear();

    // Mark inactive so we can resume cleanly later
    this.isActive = false;
  }

  /**
   * Ensures the app resumes after being suspended/hidden
   * Reinitializes MIDI, reattaches keyboard and clock sync callbacks
   */
  async resume(): Promise<void> {
    // Avoid resuming during initial bootstrap or if already active/resuming
    if (this.isActive || this.initializing || this.resuming) return;
    this.resuming = true;
    this.uiController.updateStatus('Resuming…', 'info');
    try {
      const midiReady = await this.midiEngine.initialize();

      // Rewire MIDI callbacks (cleanup() clears them)
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

      // Reattach clock sync callbacks for UI and arpeggiator
      this.setupClockSyncCallbacks();
      this.arpeggiator.setMidiEngine(this.midiEngine);
      this.arpeggiator.reattachClockSync();

      // Reattach keyboard listeners
      this.keyboardInput.attach();

      // Restart particle engine if it was stopped
      if (this.particleEngine) {
        this.particleEngine.start();
      }

      // Refresh UI
      this.updateUI();

      // Refresh clock inputs and reselect
      this.refreshClockInputs();
      if (this.preferredClockInputId === 'auto') {
        this.midiEngine.selectBestClockInput();
      } else {
        const inputs = this.midiEngine.getAvailableInputs();
        const found = inputs.find(i => i.id === this.preferredClockInputId);
        if (found) {
          this.midiEngine.setInput(found);
        } else {
          this.midiEngine.selectBestClockInput();
          this.preferredClockInputId = 'auto';
          this.refreshClockInputs();
        }
      }

      if (midiReady) {
        this.uiController.updateStatus('Resumed and ready! 🎹', 'success');
        this.isActive = true;
      } else {
        this.uiController.updateStatus('MIDI not available after resume', 'error');
      }
    } finally {
      this.resuming = false;
    }
  }

  /**
   * Public safety method to stop any sounding notes
   */
  allNotesOff(): void {
    this.stopAllNotes();
    // Determine relevant channels: current channel plus any channels used by active notes
    const channels = new Set<number>();
    channels.add(this.uiController.getMidiChannel());
    this.state.activeNotes.forEach(n => channels.add(n.channel ?? this.uiController.getMidiChannel()));
    try {
      channels.forEach(ch => this.midiEngine.panic(ch));
    } catch {
      // ignore
    }
    // Ensure sustain off and controllers reset only on relevant channels
    try {
      channels.forEach(ch => {
        this.midiEngine.setSustainPedal(false, ch);
        // Explicitly reset mod wheel and pitch bend to rest
        this.midiEngine.sendMessage({ type: 'cc', channel: ch, controller: MIDI_MOD_WHEEL, value: 0 });
        this.midiEngine.sendMessage({ type: 'pitchbend', channel: ch, bend: 0 });
      });
    } catch {
      // ignore
    }
    // Reset visual indicators
    try {
      this.uiController.updateModIndicator(false);
      this.uiController.updatePitchIndicator(false);
      this.uiController.updateOctaveDownIndicator(false);
      this.uiController.updateOctaveUpIndicator(false);
      this.uiController.updateKeyVisual('ArrowUp', false);
      this.uiController.updateKeyVisual('ArrowDown', false);
      this.uiController.updateKeyVisual('ArrowLeft', false);
      this.uiController.updateKeyVisual('ArrowRight', false);
    } catch {}
    // Clear any pressed key bookkeeping to avoid stuck keydown suppression
    try {
      this.keyboardInput.resetPressedKeys();
    } catch {
      // ignore
    }
  }

  /**
   * Update UI with current MIDI inputs
   */
  private refreshClockInputs(): void {
    const inputs = this.midiEngine.getAvailableInputs();
    const options = inputs.map(i => ({ id: i.id, name: i.name || i.id }));
    this.uiController.populateClockInputs(options, this.preferredClockInputId);
  }

  /**
   * Handle user selection of clock input
   */
  private handleClockInputSelect(id: string): void {
    this.preferredClockInputId = id;
    if (id === 'auto') {
      this.midiEngine.selectBestClockInput();
      return;
    }
    const inputs = this.midiEngine.getAvailableInputs();
    const found = inputs.find(i => i.id === id);
    if (found) {
      this.midiEngine.setInput(found);
    } else {
      this.midiEngine.selectBestClockInput();
      this.preferredClockInputId = 'auto';
      this.refreshClockInputs();
    }
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

  // Resume/cleanup around visibility changes
// Be conservative in Electron: fullscreen/space transitions on macOS can briefly
// flip visibility and race with focus events, dropping keyboard listeners.
// In Electron, avoid full cleanup on visibility hidden; just silence notes.
document.addEventListener('visibilitychange', () => {
  const inElectron = typeof (window as any).electronAPI !== 'undefined';
  if (document.hidden) {
    if (inElectron) {
      controller.allNotesOff();
    } else {
      controller.cleanup();
    }
  } else {
    controller.resume();
  }
});

  // Handle page show (e.g., bfcache returns)
  window.addEventListener('pageshow', (ev: PageTransitionEvent) => {
    // Only resume on bfcache restores; initial load sends persisted=false
    if (ev.persisted) controller.resume();
  });

  // Stop notes on blur, try resume on focus
  window.addEventListener('blur', () => {
    controller.allNotesOff();
  });
  window.addEventListener('focus', () => {
    controller.resume();
  });

  // Remove DOM fullscreen handling; OS-native fullscreen is handled by Electron

  // Electron bridge: resume/suspend + app focus hooks if available
  const electronAPI = window.electronAPI;
  if (electronAPI) {
    try {
      electronAPI.onSystemResume?.(() => controller.resume());
      electronAPI.onSystemSuspend?.(() => controller.cleanup());
      electronAPI.onAppFocus?.(() => controller.resume());
      electronAPI.onAppBlur?.(() => controller.allNotesOff());
    } catch {
      // Non-fatal if not in Electron
    }
  }
});
