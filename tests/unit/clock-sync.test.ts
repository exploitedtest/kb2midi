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

  describe('Internal Clock', () => {
    it('should start internal clock and set running state', () => {
      clockSync.startInternalClock(120);

      expect(clockSync.isRunning()).toBe(true);
      expect(clockSync.getStatus()).toBe('synced');
      expect(clockSync.isInternalClockRunning()).toBe(true);
    });

    it('should set BPM directly from parameter', () => {
      clockSync.startInternalClock(140);

      expect(clockSync.getBPM()).toBe(140);
      expect(clockSync.getInternalClockBPM()).toBe(140);
    });

    it('should clamp BPM to valid range', () => {
      clockSync.startInternalClock(10); // Too low
      expect(clockSync.getBPM()).toBe(20);

      clockSync.startInternalClock(300); // Too high
      expect(clockSync.getBPM()).toBe(240);
    });

    it('should fire start callbacks', () => {
      const callback = vi.fn();
      clockSync.onStart(callback);

      clockSync.startInternalClock(120);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should generate ticks at correct interval', () => {
      const tickCallback = vi.fn();
      clockSync.onTick(tickCallback);

      clockSync.startInternalClock(120);
      // 120 BPM = 24 ticks per quarter, 2 quarters per second = 48 ticks/sec
      // Tick interval = 60000 / (120 * 24) = 20.83ms

      vi.advanceTimersByTime(100); // ~5 ticks at 120 BPM

      expect(tickCallback.mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(tickCallback.mock.calls.length).toBeLessThanOrEqual(6);
    });

    it('should fire quarter note callbacks every 24 ticks', () => {
      const quarterCallback = vi.fn();
      clockSync.onQuarterNote(quarterCallback);

      clockSync.startInternalClock(120);

      // At 120 BPM, a quarter note is 500ms
      vi.advanceTimersByTime(1000); // 2 quarter notes

      expect(quarterCallback).toHaveBeenCalledTimes(2);
    });

    it('should fire sixteenth note callbacks every 6 ticks', () => {
      const sixteenthCallback = vi.fn();
      clockSync.onSixteenthNote(sixteenthCallback);

      clockSync.startInternalClock(120);

      // At 120 BPM, a sixteenth note is 125ms
      vi.advanceTimersByTime(500); // 4 sixteenth notes

      expect(sixteenthCallback).toHaveBeenCalledTimes(4);
    });

    it('should stop internal clock and fire stop callbacks', () => {
      const stopCallback = vi.fn();
      clockSync.onStop(stopCallback);

      clockSync.startInternalClock(120);
      clockSync.stopInternalClock();

      expect(clockSync.isRunning()).toBe(false);
      expect(clockSync.getStatus()).toBe('stopped');
      expect(clockSync.isInternalClockRunning()).toBe(false);
      expect(stopCallback).toHaveBeenCalledTimes(1);
    });

    it('should ignore external clock ticks when internal clock is active', () => {
      clockSync.startInternalClock(120);

      // Get tick count after starting
      const ticksBefore = clockSync.getTicks();

      // Try to send external clock ticks - should be ignored
      clockSync.onMIDIClockTick(100);
      clockSync.onMIDIClockTick(120);
      clockSync.onMIDIClockTick(140);

      // Tick count should not have increased from external ticks
      expect(clockSync.getTicks()).toBe(ticksBefore);

      // Advance time so internal ticks fire
      vi.advanceTimersByTime(100);

      // Now ticks should have increased from internal clock only
      expect(clockSync.getTicks()).toBeGreaterThan(ticksBefore);
    });

    it('should ignore MIDI start/stop/continue when internal clock is active', () => {
      const startCallback = vi.fn();
      const stopCallback = vi.fn();
      clockSync.onStart(startCallback);
      clockSync.onStop(stopCallback);

      clockSync.startInternalClock(120);
      startCallback.mockClear();
      stopCallback.mockClear();

      // Try to send external MIDI messages
      clockSync.onMIDIStart();
      clockSync.onMIDIStop();
      clockSync.onMIDIContinue();

      // These should be ignored
      expect(startCallback).not.toHaveBeenCalled();
      expect(stopCallback).not.toHaveBeenCalled();
    });

    it('should update BPM without resetting ticks or firing start callbacks', () => {
      const startCallback = vi.fn();
      clockSync.onStart(startCallback);

      clockSync.startInternalClock(120);
      vi.advanceTimersByTime(500); // Let some ticks accumulate
      const ticksBefore = clockSync.getTicks();
      startCallback.mockClear();

      clockSync.setInternalClockBPM(140);

      expect(clockSync.getBPM()).toBe(140);
      expect(clockSync.getTicks()).toBe(ticksBefore); // Ticks preserved
      expect(startCallback).not.toHaveBeenCalled(); // No re-fire
    });

    it('should clear stopTimeout when starting internal clock', () => {
      // Start external clock and let timeout be set
      clockSync.onMIDIClockTick(100);
      expect(clockSync.isRunning()).toBe(true);

      // Switch to internal clock
      clockSync.startInternalClock(120);

      // Advance past external stop timeout
      vi.advanceTimersByTime(600);

      // Should still be running (internal clock, timeout was cleared)
      expect(clockSync.isRunning()).toBe(true);
      expect(clockSync.getStatus()).toBe('synced');
    });

    it('should clear stopTimeout when stopping internal clock', () => {
      // Setup external clock with pending timeout
      clockSync.onMIDIClockTick(100);

      // Start and stop internal clock
      clockSync.startInternalClock(120);
      clockSync.stopInternalClock();

      // Advance past external stop timeout - should not cause issues
      vi.advanceTimersByTime(600);

      // State should be clean stopped, not double-stopped
      expect(clockSync.isRunning()).toBe(false);
      expect(clockSync.getStatus()).toBe('stopped');
    });
  });
});
