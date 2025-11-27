/**
 * Comprehensive Web MIDI API Mock
 *
 * Provides a complete mock implementation of the Web MIDI API for testing
 * without requiring actual MIDI devices.
 */

export class MockMIDIMessageEvent extends Event {
  data: Uint8Array;

  constructor(data: number[]) {
    super('midimessage');
    this.data = new Uint8Array(data);
  }
}

export class MockMIDIInput implements WebMidi.MIDIInput {
  id: string;
  manufacturer?: string;
  name?: string;
  type: 'input' = 'input' as const;
  version?: string;
  state: 'connected' | 'disconnected' = 'connected';
  connection: 'open' | 'closed' | 'pending' = 'closed';
  onstatechange: ((this: WebMidi.MIDIPort, ev: Event) => any) | null = null;
  onmidimessage: ((this: WebMidi.MIDIInput, ev: Event) => any) | null = null;

  private listeners: Map<string, Set<EventListener>> = new Map();

  constructor(
    id: string,
    name: string = 'Mock MIDI Input',
    manufacturer: string = 'Mock Manufacturer'
  ) {
    this.id = id;
    this.name = name;
    this.manufacturer = manufacturer;
  }

  open(): Promise<WebMidi.MIDIPort> {
    this.connection = 'open';
    return Promise.resolve(this);
  }

  close(): Promise<WebMidi.MIDIPort> {
    this.connection = 'closed';
    return Promise.resolve(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }

    // Also call the onmidimessage handler if it exists
    if (event.type === 'midimessage' && this.onmidimessage) {
      this.onmidimessage.call(this, event);
    }

    return true;
  }

  /**
   * Test helper: Simulate receiving a MIDI message
   */
  simulateMessage(data: number[]): void {
    const event = new MockMIDIMessageEvent(data);
    this.dispatchEvent(event);
  }

  /**
   * Test helper: Simulate MIDI clock tick (0xF8)
   */
  simulateClockTick(): void {
    this.simulateMessage([0xF8]);
  }

  /**
   * Test helper: Simulate MIDI clock start (0xFA)
   */
  simulateClockStart(): void {
    this.simulateMessage([0xFA]);
  }

  /**
   * Test helper: Simulate MIDI clock stop (0xFC)
   */
  simulateClockStop(): void {
    this.simulateMessage([0xFC]);
  }
}

export class MockMIDIOutput implements WebMidi.MIDIOutput {
  id: string;
  manufacturer?: string;
  name?: string;
  type: 'output' = 'output' as const;
  version?: string;
  state: 'connected' | 'disconnected' = 'connected';
  connection: 'open' | 'closed' | 'pending' = 'closed';
  onstatechange: ((this: WebMidi.MIDIPort, ev: Event) => any) | null = null;

  private listeners: Map<string, Set<EventListener>> = new Map();
  public sentMessages: number[][] = [];

  constructor(
    id: string,
    name: string = 'Mock MIDI Output',
    manufacturer: string = 'Mock Manufacturer'
  ) {
    this.id = id;
    this.name = name;
    this.manufacturer = manufacturer;
  }

  open(): Promise<WebMidi.MIDIPort> {
    this.connection = 'open';
    return Promise.resolve(this);
  }

  close(): Promise<WebMidi.MIDIPort> {
    this.connection = 'closed';
    return Promise.resolve(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    return true;
  }

  send(data: number[] | Uint8Array, timestamp?: number): void {
    const message = Array.from(data);
    this.sentMessages.push(message);
  }

  clear(): void {
    // Clear the send queue
  }

  /**
   * Test helper: Get all sent messages
   */
  getSentMessages(): number[][] {
    return this.sentMessages;
  }

  /**
   * Test helper: Clear sent messages history
   */
  clearSentMessages(): void {
    this.sentMessages = [];
  }

  /**
   * Test helper: Get last sent message
   */
  getLastSentMessage(): number[] | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  /**
   * Test helper: Check if a specific message was sent
   */
  wasMessageSent(expectedMessage: number[]): boolean {
    return this.sentMessages.some(msg =>
      msg.length === expectedMessage.length &&
      msg.every((byte, i) => byte === expectedMessage[i])
    );
  }
}

export class MockMIDIInputMap extends Map<string, WebMidi.MIDIInput> implements WebMidi.MIDIInputMap {}
export class MockMIDIOutputMap extends Map<string, WebMidi.MIDIOutput> implements WebMidi.MIDIOutputMap {}

export class MockMIDIAccess implements WebMidi.MIDIAccess {
  inputs: MockMIDIInputMap;
  outputs: MockMIDIOutputMap;
  sysexEnabled = false;
  onstatechange: ((this: WebMidi.MIDIAccess, ev: Event) => any) | null = null;

  private listeners: Map<string, Set<EventListener>> = new Map();

  constructor() {
    this.inputs = new MockMIDIInputMap();
    this.outputs = new MockMIDIOutputMap();
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }

    if (event.type === 'statechange' && this.onstatechange) {
      this.onstatechange.call(this, event);
    }

    return true;
  }

  /**
   * Test helper: Add a mock input device
   */
  addInput(id: string, name?: string, manufacturer?: string): MockMIDIInput {
    const input = new MockMIDIInput(id, name, manufacturer);
    this.inputs.set(id, input);
    return input;
  }

  /**
   * Test helper: Add a mock output device
   */
  addOutput(id: string, name?: string, manufacturer?: string): MockMIDIOutput {
    const output = new MockMIDIOutput(id, name, manufacturer);
    this.outputs.set(id, output);
    return output;
  }

  /**
   * Test helper: Remove an input device (simulates disconnect)
   */
  removeInput(id: string): void {
    const input = this.inputs.get(id);
    if (input) {
      input.state = 'disconnected';
      this.inputs.delete(id);
      this.dispatchStateChange();
    }
  }

  /**
   * Test helper: Remove an output device (simulates disconnect)
   */
  removeOutput(id: string): void {
    const output = this.outputs.get(id);
    if (output) {
      output.state = 'disconnected';
      this.outputs.delete(id);
      this.dispatchStateChange();
    }
  }

  /**
   * Test helper: Dispatch statechange event
   */
  dispatchStateChange(): void {
    this.dispatchEvent(new Event('statechange'));
  }

  /**
   * Test helper: Clear all devices
   */
  clearAllDevices(): void {
    this.inputs.clear();
    this.outputs.clear();
  }
}

/**
 * Mock requestMIDIAccess function
 */
export function createMockRequestMIDIAccess(
  mockAccess?: MockMIDIAccess
): (options?: WebMidi.MIDIOptions) => Promise<MockMIDIAccess> {
  return async (options?: WebMidi.MIDIOptions) => {
    const access = mockAccess || new MockMIDIAccess();
    access.sysexEnabled = options?.sysex || false;
    return access;
  };
}

/**
 * Setup function to install Web MIDI API mock in the global navigator
 */
export function setupWebMIDIMock(): MockMIDIAccess {
  const mockAccess = new MockMIDIAccess();

  // Add default mock devices
  mockAccess.addInput('mock-input-1', 'IAC Driver Bus 1', 'Apple Inc.');
  mockAccess.addInput('mock-clock-input', 'MIDI Clock Source', 'Mock Manufacturer');
  mockAccess.addOutput('mock-output-1', 'IAC Driver Bus 1', 'Apple Inc.');
  mockAccess.addOutput('mock-output-2', 'Virtual MIDI Output', 'Mock Manufacturer');

  // Install the mock
  if (typeof navigator !== 'undefined') {
    (navigator as any).requestMIDIAccess = createMockRequestMIDIAccess(mockAccess);
  }

  return mockAccess;
}

/**
 * Teardown function to remove Web MIDI API mock
 */
export function teardownWebMIDIMock(): void {
  if (typeof navigator !== 'undefined') {
    delete (navigator as any).requestMIDIAccess;
  }
}
