import { MIDIEngine } from './midi-engine';
import { KeyboardInput } from './keyboard-input';
import { UIController } from './ui-controller';
import { ClockSync } from './clock-sync';
import {
  Arpeggiator,
  StraightTiming,
  SwingTiming,
  ShuffleTiming,
  DottedTiming,
  HumanizeTiming,
  LayeredTiming,
  VelocityHumanize
} from './arpeggiator';
import { ScaleFilter } from './scale-filter';
import { ControllerState, ArpeggiatorPattern, MIDI_MOD_WHEEL } from './types';

// Enhanced control configuration with better type safety
interface ControlConfig {
  id: string;
  setter: (value: string) => void;
  type?: 'select' | 'range' | 'button' | 'checkbox';
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
  private scaleFilter: ScaleFilter;
  private isActive = false;
  // Tracks whether the app is in its initial async initialization
  private initializing = true;
  // Prevents overlapping resume calls
  private resuming = false;
  private preferredClockInputId: string = 'auto';
  // Momentary arpeggiator rate boost state (Tab key)
  private arpBoostActive: boolean = false;
  private arpBoostBaseDivisor: number | null = null;
  // Timing strategy state
  private currentTimingType: 'straight' | 'swing' | 'shuffle' | 'dotted' = 'straight';
  private humanizeEnabled: boolean = false;
  private timingSeed: number = Math.random() * 1000000;

  private state: ControllerState = {
    currentOctave: 4,
    velocity: 80,
    midiChannel: 1,
    activeNotes: new Map(),
    pressedKeys: new Set(),
    sustainPedalActive: false,
    sustainedNotes: new Set(),
    currentLayout: 'expanded',
    noteInputSource: 'keyboard' // Default to QWERTY keyboard
  };

  constructor() {
    this.clockSync = new ClockSync();
    this.midiEngine = new MIDIEngine(this.clockSync);
    this.keyboardInput = new KeyboardInput();
    this.uiController = new UIController();
    this.arpeggiator = new Arpeggiator(this.clockSync);
    this.scaleFilter = new ScaleFilter();

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

    // Set up external MIDI note input handlers
    this.setupExternalMIDIHandlers();

    // Set up clock sync callbacks
    this.setupClockSyncCallbacks();

    // Set up arpeggiator
    this.setupArpeggiator();
    
    // Set up keyboard input handlers
    this.setupKeyboardHandlers();
    
    // Set up UI handlers
    this.setupUIHandlers();

    // Sync scale filter defaults with current UI selections
    this.syncScaleFilterFromUI();
    
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

    // Populate note input sources and wire selection
    this.refreshNoteInputSources();
    this.uiController.onNoteInputChange((source) => this.handleNoteInputSelect(source));

    // React to MIDI port changes (hot-plug, DAW devices on/off)
    this.midiEngine.onPortsChangeHandler(() => {
      this.refreshClockInputs();
      this.refreshNoteInputSources();

      const inputs = this.midiEngine.getAvailableInputs();

      // Handle clock input device disconnection
      if (this.preferredClockInputId === 'auto') {
        this.midiEngine.selectBestClockInput();
      } else if (!inputs.find(i => i.id === this.preferredClockInputId)) {
        this.midiEngine.selectBestClockInput();
        this.preferredClockInputId = 'auto';
        this.refreshClockInputs();
      }

      // Handle note input device disconnection
      if (this.state.noteInputSource === 'external') {
        const currentNoteInput = this.midiEngine.getNoteInput();
        if (currentNoteInput && !inputs.find(i => i.id === currentNoteInput.id)) {
          // External device disconnected, fall back to keyboard
          this.handleNoteInputSelect('keyboard');
        }
      }
    });
  }

  /**
   * Sets up external MIDI input handlers for note on/off events
   */
  private setupExternalMIDIHandlers(): void {
    this.midiEngine.onExternalNoteOnHandler((note, velocity, _channel) => {
      // Only process external MIDI when in external mode
      if (this.state.noteInputSource === 'external') {
        this.playNote(note, velocity);
        this.uiController.updateKeyVisual(`external-${note}`, true);
      }
    });

    this.midiEngine.onExternalNoteOffHandler((note, _velocity, _channel) => {
      // Only process external MIDI when in external mode
      if (this.state.noteInputSource === 'external') {
        this.stopNote(note);
        this.uiController.updateKeyVisual(`external-${note}`, false);
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

      // Arpeggiator timing type
      {
        id: 'arp-timing-type',
        setter: (value) => {
          this.updateTimingType(value as 'straight' | 'swing' | 'shuffle' | 'dotted');
        },
        type: 'select'
      },

      // Humanize toggle
      {
        id: 'arp-humanize',
        setter: (value) => {
          this.updateHumanizeState(value === 'true');
        },
        type: 'checkbox'
      },

      // Velocity humanize toggle
      {
        id: 'arp-humanize-velocity',
        setter: (value) => {
          this.updateVelocityHumanizeState(value === 'true');
        },
        type: 'checkbox'
      },

      // Accent pattern
      {
        id: 'arp-accent',
        setter: (value) => {
          this.updateAccentPattern(value as 'none' | 'downbeats' | 'offbeats' | 'every-3rd');
        },
        type: 'select'
      },

      // Gate probability
      {
        id: 'arp-probability',
        setter: (value) => {
          const numValue = parseInt(value);
          this.updateGateProbability(numValue / 100);
        },
        type: 'range',
        displayId: 'arp-probability-value',
        displayFormatter: (value) => `${value}%`
      },

      // Ratchet count
      {
        id: 'arp-ratchet',
        setter: (value) => {
          this.updateRatchetCount(parseInt(value));
        },
        type: 'select'
      },

      // Latch mode
      {
        id: 'latch-mode',
        setter: (value) => {
          this.keyboardInput.setLatchMode(value === 'true');
        },
        type: 'checkbox'
      },

      // Scale filter toggle
      {
        id: 'scale-filter-toggle',
        setter: () => {
          this.toggleScaleFilter();
          this.updateScaleFilterButtonText();

          // Show/hide scale filter controls
          const scaleControls = document.getElementById('scale-filter-controls');
          if (scaleControls) {
            scaleControls.style.display = this.scaleFilter.isEnabled() ? 'block' : 'none';
          }
        },
        type: 'button'
      },

      // Scale root note
      {
        id: 'scale-root',
        setter: (value) => {
          this.scaleFilter.setRootNote(parseInt(value));
          this.updateUI(); // Update piano highlighting
        },
        type: 'select'
      },

      // Scale type
      {
        id: 'scale-type',
        setter: (value) => {
          this.scaleFilter.setScaleType(value);
          this.updateUI(); // Update piano highlighting
        },
        type: 'select'
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
        } else if (config.type === 'checkbox') {
          // Checkboxes use checked property
          value = (element as HTMLInputElement).checked ? 'true' : 'false';
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
   * Updates the timing type and applies the new timing strategy
   */
  private updateTimingType(type: 'straight' | 'swing' | 'shuffle' | 'dotted'): void {
    this.currentTimingType = type;
    this.applyTimingStrategy();
  }

  /**
   * Updates the humanize state and applies the new timing strategy
   */
  private updateHumanizeState(enabled: boolean): void {
    this.humanizeEnabled = enabled;
    if (enabled) {
      // Generate new seed when enabling humanize for variety
      this.timingSeed = Math.random() * 1000000;
    }
    this.applyTimingStrategy();
  }

  /**
   * Applies the current timing strategy to the arpeggiator
   * Combines base timing (swing/shuffle/dotted) with optional humanization
   */
  private applyTimingStrategy(): void {
    // Create base timing strategy based on type
    let baseStrategy;
    switch (this.currentTimingType) {
      case 'swing':
        baseStrategy = new SwingTiming(1.0); // Full swing amount
        break;
      case 'shuffle':
        baseStrategy = new ShuffleTiming(1.0); // Full shuffle amount
        break;
      case 'dotted':
        baseStrategy = new DottedTiming(1.0); // Full dotted amount
        break;
      case 'straight':
      default:
        baseStrategy = new StraightTiming();
        break;
    }

    // Layer humanization if enabled
    if (this.humanizeEnabled) {
      const humanizeStrategy = new HumanizeTiming(0.4, this.timingSeed); // 40% humanize amount
      const layered = new LayeredTiming([baseStrategy, humanizeStrategy]);
      this.arpeggiator.setTimingStrategy(layered);
    } else {
      this.arpeggiator.setTimingStrategy(baseStrategy);
    }
  }

  /**
   * Updates the velocity humanize state
   * Applies random ±10 velocity variation to arpeggiator notes
   */
  private updateVelocityHumanizeState(enabled: boolean): void {
    if (enabled) {
      this.arpeggiator.setVelocityHumanize(new VelocityHumanize(1.0, this.timingSeed));
    } else {
      this.arpeggiator.setVelocityHumanize(null);
    }
  }

  /**
   * Updates the accent pattern for velocity emphasis
   * Emphasizes certain beats based on the selected pattern
   */
  private updateAccentPattern(type: 'none' | 'downbeats' | 'offbeats' | 'every-3rd'): void {
    this.arpeggiator.setAccentPattern(type);
  }

  /**
   * Updates the gate probability (note skip chance)
   * Lower values create more generative/sparse patterns
   */
  private updateGateProbability(chance: number): void {
    this.arpeggiator.setGateProbability(chance);
  }

  /**
   * Updates the ratchet count (note repeat subdivision)
   * Values > 1 create rapid note repeats within each step
   */
  private updateRatchetCount(count: number): void {
    this.arpeggiator.setRatchetCount(count);
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

    // Check if note is in the current scale (if scale filtering is enabled)
    if (this.scaleFilter.isFilteringActive() && !this.scaleFilter.isNoteInScale(note)) {
      // Note is filtered out - don't play it
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

    // Release all sustained notes on the channel they were originally played on
    this.state.sustainedNotes.forEach(note => {
      const activeNote = this.state.activeNotes.get(note.toString());
      const ch = activeNote?.channel ?? channel;
      this.midiEngine.stopNote(note, 0, ch);
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
        const ch = activeNote.channel ?? this.uiController.getMidiChannel();
        this.midiEngine.playNote(activeNote.note, activeNote.velocity, ch);
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
   * Toggles the scale filter on/off
   */
  private toggleScaleFilter(): void {
    const enabled = !this.scaleFilter.isEnabled();
    this.scaleFilter.setEnabled(enabled);

    if (enabled) {
      const state = this.scaleFilter.getState();
      this.uiController.updateStatus(`Scale Filter Enabled: ${state.rootNoteName} ${state.scaleName}`, 'success');
    } else {
      this.uiController.updateStatus('Scale Filter Disabled', 'info');
    }

    // Update piano highlighting
    this.updateUI();
  }

  /**
   * Updates the scale filter button text based on enabled state
   */
  private updateScaleFilterButtonText(): void {
    const button = document.getElementById('scale-filter-toggle');
    if (!button) return;

    const enabled = this.scaleFilter.isEnabled();
    button.textContent = enabled ? 'Disable Scale Filter' : 'Enable Scale Filter';
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
    this.updateScaleFilterButtonText();

    // Update scale highlighting
    if (this.scaleFilter.isFilteringActive()) {
      const scaleNotes = this.scaleFilter.getScaleNotes(0, 10);
      this.uiController.setScaleHighlight(scaleNotes, true);
    } else {
      this.uiController.setScaleHighlight([], false);
    }

    // Restore active key visual states for currently playing notes
    this.uiController.restoreActiveKeyStates(this.state.activeNotes);
  }

  /**
   * Reads the current scale UI controls and applies them to the filter
   * Ensures the filter state matches the default dropdown selections on load
   */
  private syncScaleFilterFromUI(): void {
    const rootSelect = document.getElementById('scale-root') as HTMLSelectElement | null;
    const typeSelect = document.getElementById('scale-type') as HTMLSelectElement | null;

    if (rootSelect) {
      this.scaleFilter.setRootNote(parseInt(rootSelect.value) || 0);
    }
    if (typeSelect) {
      this.scaleFilter.setScaleType(typeSelect.value || 'chromatic');
    }
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

      // Refresh UI
      this.updateUI();

      // Refresh clock inputs and reselect
      this.refreshClockInputs();
      this.refreshNoteInputSources();

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

      // Re-attach external MIDI handlers after resume
      this.setupExternalMIDIHandlers();

      // Restore note input selection
      if (this.state.noteInputSource === 'keyboard') {
        this.midiEngine.setNoteInput(null);
        this.keyboardInput.attach();
      } else {
        // Try to restore external MIDI input, fallback to keyboard if device not available
        const inputs = this.midiEngine.getAvailableInputs();
        const previousInput = this.midiEngine.getNoteInput();
        if (previousInput && inputs.find(i => i.id === previousInput.id)) {
          this.midiEngine.setNoteInput(previousInput);
        } else {
          this.handleNoteInputSelect('keyboard');
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

  /**
   * Update UI with current MIDI note input sources
   */
  private refreshNoteInputSources(): void {
    const inputs = this.midiEngine.getAvailableInputs();
    const options = [
      { id: 'keyboard', name: 'QWERTY Keyboard' },
      ...inputs.map(i => ({ id: i.id, name: i.name || i.id }))
    ];
    this.uiController.populateNoteInputs(options, this.state.noteInputSource === 'keyboard' ? 'keyboard' : this.midiEngine.getNoteInput()?.id || 'keyboard');
  }

  /**
   * Handle user selection of note input source
   */
  private handleNoteInputSelect(sourceId: string): void {
    if (sourceId === 'keyboard') {
      // Switch to keyboard mode
      this.state.noteInputSource = 'keyboard';
      this.midiEngine.setNoteInput(null);
      this.keyboardInput.attach(); // Re-enable keyboard listeners
      this.uiController.updateStatus('Note Input: QWERTY Keyboard', 'info');
    } else {
      // Switch to external MIDI mode
      this.state.noteInputSource = 'external';
      const inputs = this.midiEngine.getAvailableInputs();
      const found = inputs.find(i => i.id === sourceId);
      if (found) {
        this.midiEngine.setNoteInput(found);
        this.keyboardInput.detach(); // Disable keyboard listeners to avoid conflicts (keep handlers)
        this.uiController.updateStatus(`Note Input: ${found.name || 'External MIDI'}`, 'info');
      } else {
        // Fallback to keyboard if device not found
        this.state.noteInputSource = 'keyboard';
        this.midiEngine.setNoteInput(null);
        this.keyboardInput.attach();
        this.refreshNoteInputSources();
        this.uiController.updateStatus('Note Input: QWERTY Keyboard (device not found)', 'info');
      }
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
