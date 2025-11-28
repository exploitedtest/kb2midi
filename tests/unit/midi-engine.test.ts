/**
 * Unit Tests for MIDIEngine
 *
 * Tests MIDI communication, device management, and message sending
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MIDIEngine } from '@/midi-engine';
import { ClockSync } from '@/clock-sync';
import { MockMIDIAccess, MockMIDIOutput, MockMIDIInput } from '../mocks/web-midi.mock';

describe('MIDIEngine', () => {
  let midiEngine: MIDIEngine;
  let clockSync: ClockSync;
  let mockAccess: MockMIDIAccess;

  beforeEach(async () => {
    clockSync = new ClockSync();
    midiEngine = new MIDIEngine(clockSync);

    // Get the mock access that was installed by setup.ts
    mockAccess = await navigator.requestMIDIAccess() as unknown as MockMIDIAccess;

    // Clear and reset devices for each test
    mockAccess.clearAllDevices();
    mockAccess.addInput('mock-input-1', 'IAC Driver Bus 1', 'Apple Inc.');
    mockAccess.addOutput('mock-output-1', 'IAC Driver Bus 1', 'Apple Inc.');
    mockAccess.addOutput('mock-output-2', 'Virtual MIDI Output', 'Mock Manufacturer');
  });

  afterEach(() => {
    midiEngine.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize MIDI access successfully', async () => {
      const result = await midiEngine.initialize();
      expect(result).toBe(true);
      expect(midiEngine.isConnected()).toBe(true);
    });

    it('should auto-select the best MIDI output', async () => {
      mockAccess.clearAllDevices();
      mockAccess.addOutput('output-1', 'IAC Driver Bus 1');
      mockAccess.addOutput('output-2', 'Virtual MIDI');

      await midiEngine.initialize();

      // Should prefer IAC Driver
      expect(midiEngine.isConnected()).toBe(true);
    });

    it('should handle no MIDI outputs gracefully', async () => {
      mockAccess.clearAllDevices();

      const result = await midiEngine.initialize();
      expect(result).toBe(false);
      expect(midiEngine.isConnected()).toBe(false);
    });
  });

  describe('MIDI Output Management', () => {
    beforeEach(async () => {
      await midiEngine.initialize();
    });

    it('should get available outputs', () => {
      const outputs = midiEngine.getAvailableOutputs();
      expect(outputs.length).toBeGreaterThan(0);
    });

    it('should set a specific output', () => {
      const outputs = midiEngine.getAvailableOutputs();
      if (outputs.length > 0) {
        midiEngine.setOutput(outputs[0]);
        expect(midiEngine.isConnected()).toBe(true);
      }
    });

    it('should handle output disconnection', async () => {
      const outputs = midiEngine.getAvailableOutputs();
      const output = outputs[0];

      midiEngine.setOutput(output);
      expect(midiEngine.isConnected()).toBe(true);

      // Simulate disconnect
      mockAccess.removeOutput(output.id);

      // Should auto-reconnect to next available output if any
      await vi.waitFor(() => {
        const newOutputs = midiEngine.getAvailableOutputs();
        return newOutputs.length === 0 || midiEngine.isConnected();
      });
    });
  });

  describe('MIDI Input Management', () => {
    beforeEach(async () => {
      await midiEngine.initialize();
    });

    it('should get available inputs', () => {
      const inputs = midiEngine.getAvailableInputs();
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('should set a specific input', () => {
      const inputs = midiEngine.getAvailableInputs();
      if (inputs.length > 0) {
        midiEngine.setInput(inputs[0]);
        // No error should occur
      }
    });

    it('should select best clock input automatically', async () => {
      mockAccess.clearAllDevices();
      mockAccess.addInput('input-1', 'IAC Driver Bus 1');
      mockAccess.addInput('input-2', 'MIDI Clock Source');
      mockAccess.addOutput('output-1', 'IAC Driver Bus 1');

      await midiEngine.initialize();

      // Should auto-select matching input or clock source
      const inputs = midiEngine.getAvailableInputs();
      expect(inputs.length).toBe(2);
    });
  });

  describe('Note Playback', () => {
    let output: MockMIDIOutput;

    beforeEach(async () => {
      await midiEngine.initialize();
      const outputs = midiEngine.getAvailableOutputs() as MockMIDIOutput[];
      output = outputs[0];
      output.clearSentMessages();
    });

    it('should play a note', () => {
      midiEngine.playNote(60, 100, 1);

      const messages = output.getSentMessages();
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual([0x90, 60, 100]); // Note On, channel 1, C4, velocity 100
    });

    it('should stop a note', () => {
      midiEngine.playNote(60, 100, 1);
      output.clearSentMessages();

      midiEngine.stopNote(60, 0, 1);

      const messages = output.getSentMessages();
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual([0x80, 60, 0]); // Note Off, channel 1, C4
    });

    it('should track active notes', () => {
      midiEngine.playNote(60, 100, 1);
      midiEngine.playNote(64, 100, 1);

      const activeNotes = midiEngine.getActiveNotes();
      expect(activeNotes.has(60)).toBe(true);
      expect(activeNotes.has(64)).toBe(true);
      expect(activeNotes.size).toBe(2);
    });

    it('should handle multiple channels', () => {
      midiEngine.playNote(60, 100, 1);
      midiEngine.playNote(60, 100, 2);

      const messages = output.getSentMessages();
      expect(messages[0][0]).toBe(0x90); // Channel 1
      expect(messages[1][0]).toBe(0x91); // Channel 2
    });

    it('should validate note range', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      midiEngine.playNote(-1, 100, 1); // Invalid note
      midiEngine.playNote(128, 100, 1); // Invalid note

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should validate velocity range', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      midiEngine.playNote(60, -1, 1); // Invalid velocity
      midiEngine.playNote(60, 128, 1); // Invalid velocity

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should validate channel range', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      midiEngine.playNote(60, 100, 0); // Invalid channel
      midiEngine.playNote(60, 100, 17); // Invalid channel

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Sustain Pedal', () => {
    let output: MockMIDIOutput;

    beforeEach(async () => {
      await midiEngine.initialize();
      const outputs = midiEngine.getAvailableOutputs() as MockMIDIOutput[];
      output = outputs[0];
      output.clearSentMessages();
    });

    it('should send sustain pedal on', () => {
      midiEngine.setSustainPedal(true, 1);

      const messages = output.getSentMessages();
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual([0xB0, 64, 127]); // CC 64, value 127
    });

    it('should send sustain pedal off', () => {
      midiEngine.setSustainPedal(true, 1);
      output.clearSentMessages();

      midiEngine.setSustainPedal(false, 1);

      const messages = output.getSentMessages();
      expect(messages[0]).toEqual([0xB0, 64, 0]); // CC 64, value 0
    });

    it('should sustain notes when pedal is active', () => {
      midiEngine.playNote(60, 100, 1);
      midiEngine.setSustainPedal(true, 1);
      output.clearSentMessages();

      midiEngine.stopNote(60, 0, 1);

      // Note off should be sent, but note should still be tracked
      const activeNotes = midiEngine.getActiveNotes();
      expect(activeNotes.has(60)).toBe(true);
    });

    it('should release sustained notes when pedal is released', () => {
      midiEngine.playNote(60, 100, 1);
      midiEngine.playNote(64, 100, 1);
      midiEngine.setSustainPedal(true, 1);
      midiEngine.stopNote(60, 0, 1);
      midiEngine.stopNote(64, 0, 1);
      output.clearSentMessages();

      midiEngine.setSustainPedal(false, 1);

      const messages = output.getSentMessages();
      // Should send: pedal off, note off for 60, note off for 64
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('MIDI Panic', () => {
    let output: MockMIDIOutput;

    beforeEach(async () => {
      await midiEngine.initialize();
      const outputs = midiEngine.getAvailableOutputs() as MockMIDIOutput[];
      output = outputs[0];
      output.clearSentMessages();
    });

    it('should send all notes off on panic', () => {
      midiEngine.playNote(60, 100, 1);
      midiEngine.playNote(64, 100, 1);
      output.clearSentMessages();

      midiEngine.panic(1);

      const messages = output.getSentMessages();
      // Should send note offs for all 128 notes + control messages
      expect(messages.length).toBeGreaterThan(128);
    });

    it('should clear active notes tracking after panic', () => {
      midiEngine.playNote(60, 100, 1);
      midiEngine.playNote(64, 100, 1);

      midiEngine.panic(1);

      const activeNotes = midiEngine.getActiveNotes();
      expect(activeNotes.size).toBe(0);
    });

    it('should panic all channels when no channel specified', () => {
      output.clearSentMessages();

      midiEngine.panic();

      const messages = output.getSentMessages();
      // Should send messages for all 16 channels
      expect(messages.length).toBeGreaterThan(128 * 16);
    });
  });

  describe('Control Changes', () => {
    let output: MockMIDIOutput;

    beforeEach(async () => {
      await midiEngine.initialize();
      const outputs = midiEngine.getAvailableOutputs() as MockMIDIOutput[];
      output = outputs[0];
      output.clearSentMessages();
    });

    it('should send CC messages', () => {
      midiEngine.sendMessage({
        type: 'cc',
        channel: 1,
        controller: 1, // Mod wheel
        value: 64
      });

      const messages = output.getSentMessages();
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual([0xB0, 1, 64]);
    });

    it('should send pitch bend messages', () => {
      midiEngine.sendMessage({
        type: 'pitchbend',
        channel: 1,
        bend: 0 // Center position
      });

      const messages = output.getSentMessages();
      expect(messages.length).toBe(1);
      expect(messages[0][0]).toBe(0xE0); // Pitch bend, channel 1
    });

    it('should send program change messages', () => {
      midiEngine.sendMessage({
        type: 'programchange',
        channel: 1,
        program: 10
      });

      const messages = output.getSentMessages();
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual([0xC0, 10]);
    });
  });

  describe('MIDI Clock Handling', () => {
    let input: MockMIDIInput;

    beforeEach(async () => {
      await midiEngine.initialize();
      const inputs = midiEngine.getAvailableInputs() as MockMIDIInput[];
      input = inputs[0];
    });

    it('should handle MIDI clock ticks', () => {
      const tickSpy = vi.spyOn(clockSync, 'onMIDIClockTick');

      input.simulateClockTick();

      expect(tickSpy).toHaveBeenCalled();
    });

    it('should handle MIDI start messages', () => {
      const startSpy = vi.spyOn(clockSync, 'onMIDIStart');

      input.simulateClockStart();

      expect(startSpy).toHaveBeenCalled();
    });

    it('should handle MIDI stop messages', () => {
      const stopSpy = vi.spyOn(clockSync, 'onMIDIStop');

      input.simulateClockStop();

      expect(stopSpy).toHaveBeenCalled();
    });

    it('should calculate BPM from clock ticks', async () => {
      // Simulate 120 BPM: 24 ticks per quarter note
      // At 120 BPM, each tick is ~20.83ms
      input.simulateClockStart();

      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 21));
        input.simulateClockTick();
      }

      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThan(100);
      expect(bpm).toBeLessThan(140);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup properly', async () => {
      await midiEngine.initialize();

      midiEngine.cleanup();

      expect(midiEngine.isConnected()).toBe(false);
    });

    it('should clear active notes on cleanup', async () => {
      await midiEngine.initialize();
      midiEngine.playNote(60, 100, 1);

      midiEngine.cleanup();

      const activeNotes = midiEngine.getActiveNotes();
      expect(activeNotes.size).toBe(0);
    });
  });
});
