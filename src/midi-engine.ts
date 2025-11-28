import { 
  MIDIState, 
  MIDIMessage,
  MIDI_NOTE_ON,
  MIDI_NOTE_OFF,
  MIDI_CC,
  MIDI_PROGRAM_CHANGE,
  MIDI_PITCH_BEND,
  MIDI_SUSTAIN_PEDAL
} from './types';
import { ClockSync } from './clock-sync';

/**
 * Handles all MIDI communication and device management
 * Provides a clean interface for sending MIDI messages to connected outputs
 * Now supports MIDI input for external clock sync
 */
export class MIDIEngine {
  private state: MIDIState = {
    midiAccess: null,
    midiOutput: null,
    midiInput: null,
    midiNoteInput: null,
    isConnected: false
  };

  private activeNotes = new Set<number>();
  private sustainedNotes = new Set<number>();
  private sustainPedalActive = false;
  private clockSync: ClockSync;

  private onStateChange?: (connected: boolean) => void;
  private onError?: (error: Error) => void;
  private onClockSyncChange?: (status: 'synced' | 'free' | 'stopped') => void;
  private onPortsChange?: () => void;
  private onExternalNoteOn?: (note: number, velocity: number, channel: number) => void;
  private onExternalNoteOff?: (note: number, velocity: number, channel: number) => void;
  
  // Pre-validation cache for performance
  private validChannels = new Set<number>();
  private validNotes = new Set<number>();
  private validVelocities = new Set<number>();

  constructor(clockSync: ClockSync) {
    this.clockSync = clockSync;
    this.handleMIDIStateChange = this.handleMIDIStateChange.bind(this);
    this.handleMIDIMessage = this.handleMIDIMessage.bind(this);
    this.handleNoteInputMessage = this.handleNoteInputMessage.bind(this);
    this.initializeValidationCache();
  }

  /**
   * Pre-populates validation caches to avoid repeated bounds checking
   * Significant performance improvement for high-frequency note events
   */
  private initializeValidationCache(): void {
    // Pre-populate valid MIDI channels (1-16)
    for (let i = 1; i <= 16; i++) {
      this.validChannels.add(i);
    }
    
    // Pre-populate valid MIDI notes (0-127)
    for (let i = 0; i <= 127; i++) {
      this.validNotes.add(i);
      this.validVelocities.add(i);
    }
  }

  /**
   * Initializes the MIDI engine and attempts to connect to available outputs
   * Requests MIDI access from the browser and auto-selects the best available output
   * @returns Promise<boolean> - True if MIDI is successfully initialized and connected
   * @throws Error if Web MIDI API is not supported or no outputs are available
   */
  async initialize(): Promise<boolean> {
    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported in this browser');
      }

      this.state.midiAccess = await navigator.requestMIDIAccess({ sysex: false }) as WebMidi.MIDIAccess;
      if (this.state.midiAccess) {
        this.state.midiAccess.onstatechange = this.handleMIDIStateChange;
      }
      
      const outputReady = this.autoSelectOutput();
      const inputReady = this.setupMIDIInput();
      
      return outputReady && inputReady;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  /**
   * Handles MIDI device connection state changes
   * Automatically attempts to reconnect if the current output is disconnected
   * @param event - The MIDI connection event from the Web MIDI API
   */
  private handleMIDIStateChange(event: WebMidi.MIDIConnectionEvent): void {
    // Some environments (and our tests) may emit a bare statechange event with no port info
    if (!event || !event.port) {
      return;
    }

    console.log(`MIDI device ${event.port.name} ${event.port.state}`);
    
    if (event.port.type === 'output') {
      if (event.port.state === 'disconnected' && event.port.id === this.state.midiOutput?.id) {
        this.state.isConnected = false;
        this.state.midiOutput = null;
        this.onStateChange?.(false);
        this.autoSelectOutput();
      } else if (event.port.state === 'connected' && !this.state.midiOutput) {
        this.autoSelectOutput();
      }
    }

    if (event.port.type === 'input') {
      // If our current input disappeared, pick a new best input
      if (event.port.state === 'disconnected' && event.port.id === this.state.midiInput?.id) {
        this.state.midiInput.onmidimessage = null;
        this.state.midiInput = null;
        // Reselect best available input
        this.setupMIDIInput();
      }
    }

    // Notify about port list changes so UI can refresh dropdown
    this.onPortsChange?.();
  }

  /**
   * Sets up MIDI input for external clock sync
   * @returns boolean - True if MIDI input was successfully set up
   */
  private setupMIDIInput(): boolean {
    if (!this.state.midiAccess) return false;
    
    const inputs = Array.from(this.state.midiAccess.inputs.values());
    
    if (inputs.length === 0) {
      console.log('No MIDI inputs found - clock sync will not be available');
      return true; // Not critical for basic functionality
    }

    // Prefer input matching currently selected output's name
    const targetName = this.state.midiOutput?.name?.toLowerCase();
    let chosen: WebMidi.MIDIInput | undefined;
    if (targetName) {
      chosen = inputs.find(inp => inp.name?.toLowerCase() === targetName);
      if (!chosen) {
        // Fallback to contains for variants like "(Bus 1)"
        chosen = inputs.find(inp => inp.name?.toLowerCase().includes(targetName));
      }
    }

    // Fallback heuristics for common virtual ports
    if (!chosen) {
      const candidates = ['iac', 'loopmidi', 'yoke', 'midi'];
      chosen = inputs.find(inp => candidates.some(c => inp.name?.toLowerCase().includes(c)));
    }

    // Final fallback to first available input
    chosen = chosen || inputs[0];

    // If switching inputs, detach listener from previous one first to avoid duplicate ticks
    if (this.state.midiInput && this.state.midiInput !== chosen) {
      try { this.state.midiInput.onmidimessage = null; } catch {}
    }

    this.state.midiInput = chosen;
    // Reassign handler idempotently (safe even if same input)
    this.state.midiInput.onmidimessage = this.handleMIDIMessage;

    console.log(`MIDI Input connected: ${this.state.midiInput.name || 'Unknown'}`);
    return true;
  }

  /**
   * Allows manual selection of MIDI clock input (e.g., from UI)
   */
  setInput(input: WebMidi.MIDIInput): void {
    if (this.state.midiInput && this.state.midiInput !== input) {
      this.state.midiInput.onmidimessage = null;
    }
    this.state.midiInput = input;
    this.state.midiInput.onmidimessage = this.handleMIDIMessage;
    console.log(`Switched MIDI Clock Input to: ${input.name || 'Unknown'}`);
  }

  /**
   * Allows manual selection of MIDI note input device
   * @param input - The MIDI input to use for note messages, or null to disable external input
   */
  setNoteInput(input: WebMidi.MIDIInput | null): void {
    // Clean up previous note input
    if (this.state.midiNoteInput) {
      this.state.midiNoteInput.onmidimessage = null;
    }

    this.state.midiNoteInput = input;

    if (input) {
      this.state.midiNoteInput!.onmidimessage = this.handleNoteInputMessage;
      console.log(`Switched MIDI Note Input to: ${input.name || 'Unknown'}`);
    } else {
      console.log('MIDI Note Input disabled (using QWERTY keyboard)');
    }
  }

  /**
   * Gets the currently selected note input device
   */
  getNoteInput(): WebMidi.MIDIInput | null {
    return this.state.midiNoteInput;
  }

  /**
   * Returns available MIDI inputs
   */
  getAvailableInputs(): WebMidi.MIDIInput[] {
    if (!this.state.midiAccess) return [];
    return Array.from(this.state.midiAccess.inputs.values());
  }

  /**
   * Select the best available clock input using internal heuristics
   */
  selectBestClockInput(): void {
    if (!this.state.midiAccess) return;
    this.setupMIDIInput();
  }

  /**
   * Subscribe to port changes (inputs/outputs added/removed)
   */
  onPortsChangeHandler(callback: () => void): void {
    this.onPortsChange = callback;
  }

  /**
   * Subscribe to external MIDI note on events
   */
  onExternalNoteOnHandler(callback: (note: number, velocity: number, channel: number) => void): void {
    this.onExternalNoteOn = callback;
  }

  /**
   * Subscribe to external MIDI note off events
   */
  onExternalNoteOffHandler(callback: (note: number, velocity: number, channel: number) => void): void {
    this.onExternalNoteOff = callback;
  }

  /**
   * Handles incoming MIDI messages for clock sync
   * @param event - The MIDI message event
   */
  private handleMIDIMessage(event: WebMidi.MIDIMessageEvent): void {
    try {
      const [status] = event.data;

      // MIDI Clock (0xF8)
      if (status === 0xF8) {
        // Use high-resolution monotonic clock inside ClockSync
        this.clockSync.onMIDIClockTick();
      }

      // MIDI Start (0xFA)
      if (status === 0xFA) {
        this.clockSync.onMIDIStart();
        this.onClockSyncChange?.('synced');
      }

      // MIDI Continue (0xFB)
      if (status === 0xFB) {
        this.clockSync.onMIDIContinue();
        this.onClockSyncChange?.('synced');
      }

      // MIDI Stop (0xFC)
      if (status === 0xFC) {
        this.clockSync.onMIDIStop();
        this.onClockSyncChange?.('stopped');
      }
    } catch (error) {
      console.error('Error handling MIDI message:', error);
    }
  }

  /**
   * Handles incoming MIDI note messages from external devices
   * @param event - The MIDI message event
   */
  private handleNoteInputMessage(event: WebMidi.MIDIMessageEvent): void {
    try {
      const [status, data1, data2] = event.data;

      // Validate that we have all required data bytes
      if (status === undefined || data1 === undefined || data2 === undefined) {
        console.warn('Incomplete MIDI message received:', event.data);
        return;
      }

      const messageType = status & 0xF0;
      const channel = (status & 0x0F) + 1; // Convert 0-15 to 1-16

      // MIDI Note On (0x90)
      if (messageType === MIDI_NOTE_ON) {
        const note = data1;
        const velocity = data2;

        // Velocity 0 is treated as note off
        if (velocity === 0) {
          this.onExternalNoteOff?.(note, velocity, channel);
        } else {
          this.onExternalNoteOn?.(note, velocity, channel);
        }
      }

      // MIDI Note Off (0x80)
      if (messageType === MIDI_NOTE_OFF) {
        const note = data1;
        const velocity = data2;
        this.onExternalNoteOff?.(note, velocity, channel);
      }
    } catch (error) {
      console.error('Error handling MIDI note input message:', error);
    }
  }

  /**
   * Automatically selects the best available MIDI output
   * Prioritizes IAC Driver on macOS, then falls back to the first available output
   * @returns boolean - True if an output was successfully selected
   */
  private autoSelectOutput(): boolean {
    if (!this.state.midiAccess) return false;
    
    const outputs = Array.from(this.state.midiAccess.outputs.values());
    
    if (outputs.length === 0) {
      this.handleError(new Error('No MIDI outputs found'));
      return false;
    }

    // Try to find IAC Driver first (macOS)
    const iacOutput = outputs.find(output => 
      output.name?.toLowerCase().includes('iac') || 
      output.name?.toLowerCase().includes('bus')
    );
    
    if (iacOutput) {
      this.setOutput(iacOutput);
      return true;
    }

    // Otherwise use the first available output
    this.setOutput(outputs[0]);
    return true;
  }

  /**
   * Sets the active MIDI output and updates connection state
   * @param output - The MIDI output to connect to
   */
  setOutput(output: WebMidi.MIDIOutput): void {
    this.state.midiOutput = output;
    this.state.isConnected = true;
    this.onStateChange?.(true);
    console.log(`Connected to MIDI output: ${output.name || 'Unknown'}`);
  }

  /**
   * Gets all available MIDI outputs from the system
   * @returns Array of available MIDI outputs
   */
  getAvailableOutputs(): WebMidi.MIDIOutput[] {
    if (!this.state.midiAccess) return [];
    return Array.from(this.state.midiAccess.outputs.values());
  }

  /**
   * Sends a MIDI message to the connected output
   * Handles all MIDI message types: note on/off, CC, program change, pitch bend
   * @param message - The MIDI message to send
   */
  sendMessage(message: MIDIMessage): void {
    if (!this.state.midiOutput || !this.state.isConnected) {
      console.warn('No MIDI output connected');
      return;
    }

    // Fast validation using pre-computed cache
    if (!this.validChannels.has(message.channel)) {
      console.error(`Invalid MIDI channel: ${message.channel}`);
      return;
    }

    let data: number[] = [];
    
    switch (message.type) {
      case 'noteon':
        if (message.note === undefined || !this.validNotes.has(message.note)) {
          console.error(`Invalid MIDI note: ${message.note}`);
          return;
        }
        if (message.velocity === undefined || !this.validVelocities.has(message.velocity)) {
          console.error(`Invalid MIDI velocity: ${message.velocity}`);
          return;
        }
        data = [MIDI_NOTE_ON | (message.channel - 1), message.note, message.velocity];
        this.activeNotes.add(message.note);
        break;
        
      case 'noteoff':
        if (message.note === undefined || !this.validNotes.has(message.note)) {
          console.error(`Invalid MIDI note: ${message.note}`);
          return;
        }
        if (message.velocity === undefined || !this.validVelocities.has(message.velocity)) {
          console.error(`Invalid MIDI velocity: ${message.velocity}`);
          return;
        }
        data = [MIDI_NOTE_OFF | (message.channel - 1), message.note, message.velocity];
        if (!this.sustainPedalActive) {
          this.activeNotes.delete(message.note);
        } else {
          this.sustainedNotes.add(message.note);
        }
        break;
        
      case 'cc':
        if (message.controller === undefined || message.controller < 0 || message.controller > 127) {
          console.error(`Invalid MIDI controller: ${message.controller}`);
          return;
        }
        if (message.value === undefined || message.value < 0 || message.value > 127) {
          console.error(`Invalid MIDI controller value: ${message.value}`);
          return;
        }
        data = [MIDI_CC | (message.channel - 1), message.controller, message.value];
        break;
        
      case 'programchange':
        if (message.program === undefined || message.program < 0 || message.program > 127) {
          console.error(`Invalid MIDI program: ${message.program}`);
          return;
        }
        data = [MIDI_PROGRAM_CHANGE | (message.channel - 1), message.program];
        break;
        
      case 'pitchbend':
        if (message.bend === undefined) {
          console.error(`Invalid MIDI pitch bend: ${message.bend}`);
          return;
        }
        const bend = Math.max(0, Math.min(16383, message.bend + 8192));
        data = [MIDI_PITCH_BEND | (message.channel - 1), bend & 0x7F, (bend >> 7) & 0x7F];
        break;
    }

    if (data.length > 0) {
      try {
        this.state.midiOutput.send(data);
      } catch (error) {
        console.error('Failed to send MIDI message:', error, 'Data:', data);
      }
    }
  }

  /**
   * Sends a note on message to the specified channel
   * @param note - MIDI note number (0-127)
   * @param velocity - Note velocity (0-127)
   * @param channel - MIDI channel (1-16)
   */
  playNote(note: number, velocity: number, channel: number): void {
    // Fast validation using pre-computed caches
    if (note === undefined || note === null || !this.validNotes.has(note)) {
      console.error(`Invalid note in playNote: ${note} (type: ${typeof note})`);
      return;
    }
    if (velocity === undefined || velocity === null || !this.validVelocities.has(velocity)) {
      console.error(`Invalid velocity in playNote: ${velocity} (type: ${typeof velocity})`);
      return;
    }
    if (channel === undefined || channel === null || !this.validChannels.has(channel)) {
      console.error(`Invalid channel in playNote: ${channel} (type: ${typeof channel})`);
      return;
    }
    
    this.sendMessage({
      type: 'noteon',
      channel,
      note,
      velocity
    });
  }

  /**
   * Sends a note off message to the specified channel
   * @param note - MIDI note number (0-127)
   * @param velocity - Release velocity (0-127)
   * @param channel - MIDI channel (1-16)
   */
  stopNote(note: number, velocity: number, channel: number): void {
    this.sendMessage({
      type: 'noteoff',
      channel,
      note,
      velocity
    });
  }

  /**
   * Controls the sustain pedal (CC 64)
   * When sustain is on, note off messages are held until sustain is released
   * @param on - True to activate sustain, false to release
   * @param channel - MIDI channel (1-16)
   */
  setSustainPedal(on: boolean, channel: number): void {
    this.sustainPedalActive = on;
    
    this.sendMessage({
      type: 'cc',
      channel,
      controller: MIDI_SUSTAIN_PEDAL,
      value: on ? 127 : 0
    });

    if (!on && this.sustainedNotes.size > 0) {
      // Release all sustained notes
      this.sustainedNotes.forEach(note => {
        this.stopNote(note, 0, channel);
        this.activeNotes.delete(note);
      });
      this.sustainedNotes.clear();
    }
  }

  /**
   * Sends panic messages to stop all notes and reset controllers
   * Useful for clearing stuck notes or resetting the MIDI state
   * @param channel - Optional specific channel to panic, otherwise all channels
   */
  panic(channel?: number): void {
    const channels = channel ? [channel] : Array.from({length: 16}, (_, i) => i + 1);
    
    channels.forEach(ch => {
      // Send all notes off
      for (let note = 0; note < 128; note++) {
        this.sendMessage({
          type: 'noteoff',
          channel: ch,
          note,
          velocity: 0
        });
      }
      
      // Reset controllers
      this.sendMessage({
        type: 'cc',
        channel: ch,
        controller: 123, // All notes off
        value: 0
      });
      
      this.sendMessage({
        type: 'cc',
        channel: ch,
        controller: 121, // Reset all controllers
        value: 0
      });
    });
    
    this.activeNotes.clear();
    this.sustainedNotes.clear();
  }

  /**
   * Gets the set of currently active notes
   * @returns Set of active MIDI note numbers
   */
  getActiveNotes(): Set<number> {
    return new Set(this.activeNotes);
  }

  /**
   * Checks if a MIDI output is currently connected
   * @returns boolean - True if connected to a MIDI output
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Sets a callback for MIDI connection state changes
   * @param callback - Function called when connection state changes
   */
  onConnectionChange(callback: (connected: boolean) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Sets a callback for MIDI error handling
   * @param callback - Function called when MIDI errors occur
   */
  onErrorHandler(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  /**
   * Gets the clock sync instance
   */
  getClockSync(): ClockSync {
    return this.clockSync;
  }

  /**
   * Cleans up MIDI connections and removes event listeners
   * Should be called when the application is shutting down
   */
  cleanup(): void {
    // Remove state change listener
    if (this.state.midiAccess) {
      this.state.midiAccess.onstatechange = null;
    }

    // Remove input message listeners
    if (this.state.midiInput) {
      this.state.midiInput.onmidimessage = null;
    }

    if (this.state.midiNoteInput) {
      this.state.midiNoteInput.onmidimessage = null;
    }

    // Clear all active notes
    this.activeNotes.clear();
    this.sustainedNotes.clear();

    // Reset state
    this.state.midiAccess = null;
    this.state.midiOutput = null;
    this.state.midiInput = null;
    this.state.midiNoteInput = null;
    this.state.isConnected = false;

    // Clear callbacks
    this.onStateChange = undefined;
    this.onError = undefined;
    this.onClockSyncChange = undefined;
    this.onExternalNoteOn = undefined;
    this.onExternalNoteOff = undefined;
  }

  /**
   * Handles MIDI errors and calls the error callback if set
   * @param error - The error that occurred
   */
  private handleError(error: Error): void {
    console.error('MIDI Error:', error);
    this.onError?.(error);
  }
}
