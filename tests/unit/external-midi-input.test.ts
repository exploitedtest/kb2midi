import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MIDIEngine } from '../../src/midi-engine';
import { ClockSync } from '../../src/clock-sync';
import { setupWebMIDIMock, MockMIDIAccess } from '../mocks/web-midi.mock';

describe('External MIDI Input Routing', () => {
  let midiEngine: MIDIEngine;
  let clockSync: ClockSync;
  let mockAccess: MockMIDIAccess;

  beforeEach(async () => {
    // Setup mock Web MIDI API
    mockAccess = setupWebMIDIMock();

    clockSync = new ClockSync();
    midiEngine = new MIDIEngine(clockSync);
    await midiEngine.initialize();
  });

  describe('Note Input Device Management', () => {
    it('should allow setting a note input device', () => {
      const inputs = midiEngine.getAvailableInputs();
      expect(inputs.length).toBeGreaterThan(0);

      const testInput = inputs[0];
      midiEngine.setNoteInput(testInput);

      expect(midiEngine.getNoteInput()).toBe(testInput);
    });

    it('should allow disabling note input (keyboard mode)', () => {
      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0];

      // Set an input first
      midiEngine.setNoteInput(testInput);
      expect(midiEngine.getNoteInput()).toBe(testInput);

      // Disable it
      midiEngine.setNoteInput(null);
      expect(midiEngine.getNoteInput()).toBeNull();
    });

    it('should clean up previous input when switching', () => {
      const inputs = midiEngine.getAvailableInputs();
      const input1 = inputs[0] as any; // Cast to access dispatchEvent
      const noteOnCallback = vi.fn();

      midiEngine.onExternalNoteOnHandler(noteOnCallback);
      midiEngine.setNoteInput(input1);

      // Send a note to verify handler is active
      const noteOnData = new Uint8Array([0x90, 60, 100]);
      const mockEvent = {
        data: noteOnData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      input1.dispatchEvent(mockEvent);
      expect(noteOnCallback).toHaveBeenCalledTimes(1);

      // Switch to null should clean up
      midiEngine.setNoteInput(null);

      // Send another note - should not trigger callback after cleanup
      noteOnCallback.mockClear();
      input1.dispatchEvent(mockEvent);
      expect(noteOnCallback).not.toHaveBeenCalled();
    });
  });

  describe('External Note On/Off Events', () => {
    it('should trigger callback on external note on', () => {
      const noteOnCallback = vi.fn();
      midiEngine.onExternalNoteOnHandler(noteOnCallback);

      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      midiEngine.setNoteInput(testInput);

      // Simulate MIDI note on message (0x90 = note on, channel 0)
      const noteOnData = new Uint8Array([0x90, 60, 100]); // Note 60 (C4), velocity 100
      const mockEvent = {
        data: noteOnData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      testInput.dispatchEvent(mockEvent);

      expect(noteOnCallback).toHaveBeenCalledWith(60, 100, 1); // Channel 1 (0-indexed to 1-indexed)
    });

    it('should trigger callback on external note off', () => {
      const noteOffCallback = vi.fn();
      midiEngine.onExternalNoteOffHandler(noteOffCallback);

      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      midiEngine.setNoteInput(testInput);

      // Simulate MIDI note off message (0x80 = note off, channel 0)
      const noteOffData = new Uint8Array([0x80, 60, 0]); // Note 60 (C4), velocity 0
      const mockEvent = {
        data: noteOffData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      testInput.dispatchEvent(mockEvent);

      expect(noteOffCallback).toHaveBeenCalledWith(60, 0, 1); // Channel 1
    });

    it('should treat note on with velocity 0 as note off', () => {
      const noteOffCallback = vi.fn();
      midiEngine.onExternalNoteOffHandler(noteOffCallback);

      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      midiEngine.setNoteInput(testInput);

      // Simulate MIDI note on with velocity 0 (common for note off)
      const noteOnZeroVel = new Uint8Array([0x90, 60, 0]); // Note on with velocity 0
      const mockEvent = {
        data: noteOnZeroVel,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      testInput.dispatchEvent(mockEvent);

      expect(noteOffCallback).toHaveBeenCalledWith(60, 0, 1);
    });

    it('should parse MIDI channel correctly', () => {
      const noteOnCallback = vi.fn();
      midiEngine.onExternalNoteOnHandler(noteOnCallback);

      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      midiEngine.setNoteInput(testInput);

      // Test different channels (0x90-0x9F = note on channels 1-16)
      const channels = [0x90, 0x91, 0x92, 0x9F]; // Channels 1, 2, 3, 16

      channels.forEach((statusByte, idx) => {
        const noteOnData = new Uint8Array([statusByte, 60, 100]);
        const mockEvent = {
          data: noteOnData,
          timeStamp: performance.now(),
          type: 'midimessage'
        } as WebMidi.MIDIMessageEvent;

        testInput.dispatchEvent(mockEvent);
      });

      expect(noteOnCallback).toHaveBeenNthCalledWith(1, 60, 100, 1);  // Channel 1
      expect(noteOnCallback).toHaveBeenNthCalledWith(2, 60, 100, 2);  // Channel 2
      expect(noteOnCallback).toHaveBeenNthCalledWith(3, 60, 100, 3);  // Channel 3
      expect(noteOnCallback).toHaveBeenNthCalledWith(4, 60, 100, 16); // Channel 16
    });

    it('should ignore non-note messages on note input', () => {
      const noteOnCallback = vi.fn();
      const noteOffCallback = vi.fn();
      midiEngine.onExternalNoteOnHandler(noteOnCallback);
      midiEngine.onExternalNoteOffHandler(noteOffCallback);

      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      midiEngine.setNoteInput(testInput);

      // Send CC message (should be ignored)
      const ccData = new Uint8Array([0xB0, 64, 127]); // CC 64, value 127
      const mockEvent = {
        data: ccData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      testInput.dispatchEvent(mockEvent);

      expect(noteOnCallback).not.toHaveBeenCalled();
      expect(noteOffCallback).not.toHaveBeenCalled();
    });
  });

  describe('Separation of Clock and Note Inputs', () => {
    it('should allow different inputs for clock and notes', () => {
      const inputs = midiEngine.getAvailableInputs();

      // Set different inputs for clock and notes
      midiEngine.setInput(inputs[0]); // Clock input
      midiEngine.setNoteInput(inputs[0]); // Note input (same device for this test)

      expect(midiEngine.getNoteInput()).toBe(inputs[0]);
    });

    it('should handle clock messages on clock input only', () => {
      const inputs = midiEngine.getAvailableInputs();
      const clockInput = inputs[0] as any;

      midiEngine.setInput(clockInput);

      // Send clock tick to clock input
      const clockTickSpy = vi.spyOn(clockSync, 'onMIDIClockTick');
      const clockData = new Uint8Array([0xF8]); // MIDI clock tick
      const mockEvent = {
        data: clockData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      clockInput.dispatchEvent(mockEvent);

      expect(clockTickSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up note input on cleanup', () => {
      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      const noteOnCallback = vi.fn();

      midiEngine.onExternalNoteOnHandler(noteOnCallback);
      midiEngine.setNoteInput(testInput);

      // Verify handler is active before cleanup
      const noteOnData = new Uint8Array([0x90, 60, 100]);
      const mockEvent = {
        data: noteOnData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      testInput.dispatchEvent(mockEvent);
      expect(noteOnCallback).toHaveBeenCalledTimes(1);

      // Cleanup
      midiEngine.cleanup();
      expect(midiEngine.getNoteInput()).toBeNull();

      // Verify handler is removed after cleanup
      noteOnCallback.mockClear();
      testInput.dispatchEvent(mockEvent);
      expect(noteOnCallback).not.toHaveBeenCalled();
    });

    it('should clear note input callbacks on cleanup', () => {
      const noteOnCallback = vi.fn();
      const noteOffCallback = vi.fn();

      midiEngine.onExternalNoteOnHandler(noteOnCallback);
      midiEngine.onExternalNoteOffHandler(noteOffCallback);

      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      midiEngine.setNoteInput(testInput);

      // Verify handlers are active before cleanup
      const noteOnData = new Uint8Array([0x90, 60, 100]);
      const noteOffData = new Uint8Array([0x80, 60, 0]);
      const noteOnEvent = {
        data: noteOnData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;
      const noteOffEvent = {
        data: noteOffData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      testInput.dispatchEvent(noteOnEvent);
      expect(noteOnCallback).toHaveBeenCalledTimes(1);

      testInput.dispatchEvent(noteOffEvent);
      expect(noteOffCallback).toHaveBeenCalledTimes(1);

      // Cleanup
      midiEngine.cleanup();

      // Send events after cleanup - callbacks should not be called
      noteOnCallback.mockClear();
      noteOffCallback.mockClear();

      testInput.dispatchEvent(noteOnEvent);
      testInput.dispatchEvent(noteOffEvent);

      expect(noteOnCallback).not.toHaveBeenCalled();
      expect(noteOffCallback).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed MIDI messages gracefully', () => {
      const noteOnCallback = vi.fn();
      midiEngine.onExternalNoteOnHandler(noteOnCallback);

      const inputs = midiEngine.getAvailableInputs();
      const testInput = inputs[0] as any;
      midiEngine.setNoteInput(testInput);

      // Send incomplete message
      const badData = new Uint8Array([0x90]); // Missing data bytes
      const mockEvent = {
        data: badData,
        timeStamp: performance.now(),
        type: 'midimessage'
      } as WebMidi.MIDIMessageEvent;

      // Should not throw
      expect(() => {
        testInput.dispatchEvent(mockEvent);
      }).not.toThrow();

      // Callback should not be called with undefined values
      expect(noteOnCallback).not.toHaveBeenCalled();
    });
  });
});
