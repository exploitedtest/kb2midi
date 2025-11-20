/**
 * Unit Tests for ClockSync
 *
 * Tests MIDI clock synchronization, BPM calculation, and timing events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClockSync } from '@/clock-sync';

describe('ClockSync', () => {
  let clockSync: ClockSync;

  beforeEach(() => {
    clockSync = new ClockSync();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = clockSync.getState();

      expect(state.isRunning).toBe(false);
      expect(state.ticks).toBe(0);
      expect(state.bpm).toBe(120);
      expect(state.status).toBe('stopped');
    });

    it('should have initial BPM of 120', () => {
      expect(clockSync.getBPM()).toBe(120);
    });

    it('should not be running initially', () => {
      expect(clockSync.isRunning()).toBe(false);
    });
  });

  describe('MIDI Start', () => {
    it('should start clock on MIDI start message', () => {
      clockSync.onMIDIStart();

      expect(clockSync.isRunning()).toBe(true);
      expect(clockSync.getStatus()).toBe('synced');
    });

    it('should reset ticks on MIDI start', () => {
      clockSync.onMIDIClockTick(100);
      clockSync.onMIDIClockTick(120);

      clockSync.onMIDIStart();

      expect(clockSync.getTicks()).toBe(0);
    });

    it('should trigger onStart callbacks', () => {
      const callback = vi.fn();
      clockSync.onStart(callback);

      clockSync.onMIDIStart();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('MIDI Stop', () => {
    it('should stop clock on MIDI stop message', () => {
      clockSync.onMIDIStart();
      clockSync.onMIDIStop();

      expect(clockSync.isRunning()).toBe(false);
      expect(clockSync.getStatus()).toBe('stopped');
    });

    it('should trigger onStop callbacks', () => {
      const callback = vi.fn();
      clockSync.onStop(callback);

      clockSync.onMIDIStart();
      clockSync.onMIDIStop();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('MIDI Continue', () => {
    it('should resume clock without resetting ticks', () => {
      clockSync.onMIDIStart();
      clockSync.onMIDIClockTick(100);
      clockSync.onMIDIClockTick(120);

      const ticksBefore = clockSync.getTicks();

      clockSync.onMIDIContinue();

      expect(clockSync.isRunning()).toBe(true);
      expect(clockSync.getTicks()).toBe(ticksBefore);
    });

    it('should trigger onStart callbacks', () => {
      const callback = vi.fn();
      clockSync.onStart(callback);

      clockSync.onMIDIContinue();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('MIDI Clock Ticks', () => {
    it('should increment tick counter', () => {
      clockSync.onMIDIClockTick(100);

      expect(clockSync.getTicks()).toBe(1);

      clockSync.onMIDIClockTick(120);

      expect(clockSync.getTicks()).toBe(2);
    });

    it('should auto-start if not explicitly started', () => {
      clockSync.onMIDIClockTick(100);

      expect(clockSync.isRunning()).toBe(true);
      expect(clockSync.getStatus()).toBe('synced');
    });

    it('should trigger onTick callbacks', () => {
      const callback = vi.fn();
      clockSync.onTick(callback);

      clockSync.onMIDIClockTick(100);

      expect(callback).toHaveBeenCalled();
    });

    it('should calculate BPM from tick intervals', () => {
      // Simulate 120 BPM: 24 ticks per quarter note, 2 quarters per second
      // Each tick should be ~20.83ms apart
      let time = 0;
      clockSync.onMIDIClockTick(time);

      for (let i = 0; i < 10; i++) {
        time += 20.83;
        clockSync.onMIDIClockTick(time);
      }

      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThanOrEqual(118);
      expect(bpm).toBeLessThanOrEqual(122);
    });

    it('should filter out duplicate/fast ticks', () => {
      clockSync.onMIDIClockTick(100);
      clockSync.onMIDIClockTick(101); // Too fast, should be filtered

      expect(clockSync.getTicks()).toBe(1); // Only first tick counted
    });

    it('should detect tempo changes', () => {
      // Start at 120 BPM
      let time = 0;
      for (let i = 0; i < 10; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83; // 120 BPM
      }

      const bpm1 = clockSync.getBPM();

      // Change to 140 BPM
      for (let i = 0; i < 10; i++) {
        clockSync.onMIDIClockTick(time);
        time += 17.86; // 140 BPM
      }

      const bpm2 = clockSync.getBPM();

      expect(bpm2).toBeGreaterThan(bpm1);
    });
  });

  describe('Quarter Note Events', () => {
    it('should trigger quarter note callback every 24 ticks', () => {
      const callback = vi.fn();
      clockSync.onQuarterNote(callback);

      for (let i = 0; i < 48; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      expect(callback).toHaveBeenCalledTimes(2); // 48 ticks = 2 quarter notes
    });
  });

  describe('Sixteenth Note Events', () => {
    it('should trigger sixteenth note callback every 6 ticks', () => {
      const callback = vi.fn();
      clockSync.onSixteenthNote(callback);

      for (let i = 0; i < 24; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      expect(callback).toHaveBeenCalledTimes(4); // 24 ticks = 4 sixteenth notes
    });
  });

  describe('Stop Timeout', () => {
    it('should auto-stop after timeout with no ticks', () => {
      const stopCallback = vi.fn();
      clockSync.onStop(stopCallback);

      clockSync.onMIDIStart();
      clockSync.onMIDIClockTick(100);

      expect(clockSync.isRunning()).toBe(true);

      // Advance time past stop timeout (500ms)
      vi.advanceTimersByTime(600);

      expect(clockSync.isRunning()).toBe(false);
      expect(stopCallback).toHaveBeenCalled();
    });

    it('should reset timeout on each tick', () => {
      clockSync.onMIDIStart();
      clockSync.onMIDIClockTick(100);

      // Advance 400ms
      vi.advanceTimersByTime(400);
      expect(clockSync.isRunning()).toBe(true);

      // Send another tick
      clockSync.onMIDIClockTick(600);

      // Advance another 400ms (total 800ms, but timeout resets)
      vi.advanceTimersByTime(400);
      expect(clockSync.isRunning()).toBe(true);

      // Now advance past timeout
      vi.advanceTimersByTime(200);
      expect(clockSync.isRunning()).toBe(false);
    });

    it('should ignore stale intervals after manual stop/continue', () => {
      let time = 0;

      // Establish tempo around 120 BPM
      for (let i = 0; i < 6; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83;
      }

      clockSync.onMIDIStop();

      // Pause for a while, then continue and resume ticks
      time += 1000;
      clockSync.onMIDIContinue();
      clockSync.onMIDIClockTick(time);
      time += 20.83;

      for (let i = 0; i < 6; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83;
      }

      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThan(100);
      expect(bpm).toBeLessThan(140);
    });

    it('should reset intervals after auto-stop timeout before resuming', () => {
      let time = 0;
      clockSync.onMIDIStart();

      for (let i = 0; i < 6; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83;
      }

      // Trigger auto-stop
      vi.advanceTimersByTime(600);
      expect(clockSync.isRunning()).toBe(false);

      // New ticks after a long pause
      time += 800;
      clockSync.onMIDIClockTick(time);
      time += 20.83;
      for (let i = 0; i < 6; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83;
      }

      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThan(100);
      expect(bpm).toBeLessThan(140);
    });
  });

  describe('BPM Calculation Stability', () => {
    it('should use rolling average for BPM calculation', () => {
      let time = 0;

      // Send consistent ticks at 120 BPM
      for (let i = 0; i < 5; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83;
      }

      // Send one outlier tick (jitter)
      clockSync.onMIDIClockTick(time);
      time += 30; // Slower tick

      // Continue with consistent ticks
      for (let i = 0; i < 5; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83;
      }

      // BPM should still be reasonably close to 120 due to averaging
      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThanOrEqual(110);
      expect(bpm).toBeLessThanOrEqual(130);
    });

    it('should require minimum samples before calculating BPM', () => {
      clockSync.onMIDIClockTick(0);
      clockSync.onMIDIClockTick(20);

      // With only 2 samples, should use default BPM
      expect(clockSync.getBPM()).toBe(120);

      clockSync.onMIDIClockTick(40);
      clockSync.onMIDIClockTick(60);

      // With 4+ samples, should calculate BPM
      const bpm = clockSync.getBPM();
      expect(bpm).not.toBe(120); // Should have calculated from ticks
    });
  });

  describe('Callback Management', () => {
    it('should support multiple callbacks for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      clockSync.onTick(callback1);
      clockSync.onTick(callback2);

      clockSync.onMIDIClockTick(100);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should clear all callbacks', () => {
      const tickCallback = vi.fn();
      const startCallback = vi.fn();
      const stopCallback = vi.fn();

      clockSync.onTick(tickCallback);
      clockSync.onStart(startCallback);
      clockSync.onStop(stopCallback);

      clockSync.clearCallbacks();

      clockSync.onMIDIStart();
      clockSync.onMIDIClockTick(100);
      clockSync.onMIDIStop();

      expect(tickCallback).not.toHaveBeenCalled();
      expect(startCallback).not.toHaveBeenCalled();
      expect(stopCallback).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely fast tempos', () => {
      // 300 BPM: each tick ~8.33ms
      let time = 0;
      for (let i = 0; i < 10; i++) {
        clockSync.onMIDIClockTick(time);
        time += 8.33;
      }

      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThan(250);
      expect(bpm).toBeLessThan(350);
    });

    it('should handle extremely slow tempos', () => {
      // 60 BPM: each tick ~41.67ms
      let time = 0;
      for (let i = 0; i < 10; i++) {
        clockSync.onMIDIClockTick(time);
        time += 41.67;
      }

      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThan(50);
      expect(bpm).toBeLessThan(70);
    });

    it('should handle tick counter overflow gracefully', () => {
      // Set ticks to near max value
      for (let i = 0; i < 1000000; i += 24) {
        clockSync.onMIDIClockTick(i);
      }

      const ticks = clockSync.getTicks();
      expect(ticks).toBeGreaterThan(0);
    });
  });
});
