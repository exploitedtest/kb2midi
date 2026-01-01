/**
 * Unit Tests for ClockSync
 *
 * Tests MIDI clock synchronization, BPM calculation, and internal master clock
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
    it('should initialize with external clock source by default', () => {
      expect(clockSync.getClockSource()).toBe('external');
      expect(clockSync.isRunning()).toBe(false);
      expect(clockSync.getBPM()).toBe(120);
    });
  });

  describe('External Clock (MIDI)', () => {
    it('should handle MIDI clock ticks', () => {
      const tickCallback = vi.fn();
      clockSync.onTick(tickCallback);

      clockSync.onMIDIClockTick(100);
      expect(tickCallback).toHaveBeenCalledTimes(1);
      expect(clockSync.getTicks()).toBe(1);
    });

    it('should auto-start on first tick', () => {
      clockSync.onMIDIClockTick(100);
      expect(clockSync.isRunning()).toBe(true);
    });

    it('should calculate BPM from tick intervals', () => {
      // Simulate 120 BPM: ~20.83ms per tick
      let time = 0;
      for (let i = 0; i < 10; i++) {
        clockSync.onMIDIClockTick(time);
        time += 20.83;
      }

      const bpm = clockSync.getBPM();
      expect(bpm).toBeGreaterThanOrEqual(118);
      expect(bpm).toBeLessThanOrEqual(122);
    });

    it('should trigger quarter note events every 24 ticks', () => {
      const quarterCallback = vi.fn();
      clockSync.onQuarterNote(quarterCallback);

      for (let i = 0; i < 48; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      expect(quarterCallback).toHaveBeenCalledTimes(2);
    });

    it('should handle start/stop messages', () => {
      clockSync.onMIDIStart();
      expect(clockSync.isRunning()).toBe(true);

      clockSync.onMIDIStop();
      expect(clockSync.isRunning()).toBe(false);
    });
  });

  describe('Internal Master Clock', () => {
    beforeEach(() => {
      clockSync.setClockSource('internal');
    });

    it('should generate ticks at correct BPM', () => {
      const tickCallback = vi.fn();
      clockSync.onTick(tickCallback);

      clockSync.setInternalBPM(120);
      clockSync.startInternalClock();

      // At 120 BPM: 48 ticks per second
      vi.advanceTimersByTime(1000);

      // Allow for timer imprecision (±2 ticks tolerance)
      const callCount = tickCallback.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(46);
      expect(callCount).toBeLessThanOrEqual(50);
    });

    it('should trigger quarter note events every 24 ticks', () => {
      const quarterCallback = vi.fn();
      clockSync.onQuarterNote(quarterCallback);

      clockSync.startInternalClock();

      // Advance to 2 quarter notes worth of time (at 120 BPM = 1 second)
      vi.advanceTimersByTime(1000);

      expect(quarterCallback).toHaveBeenCalledTimes(2);
    });

    it('should start and stop correctly', () => {
      const startCallback = vi.fn();
      const stopCallback = vi.fn();
      clockSync.onStart(startCallback);
      clockSync.onStop(stopCallback);

      clockSync.startInternalClock();
      expect(clockSync.isRunning()).toBe(true);
      expect(startCallback).toHaveBeenCalledTimes(1);

      clockSync.stopInternalClock();
      expect(clockSync.isRunning()).toBe(false);
      expect(stopCallback).toHaveBeenCalledTimes(1);
    });

    it('should update BPM while running', () => {
      const tickCallback = vi.fn();
      clockSync.onTick(tickCallback);

      clockSync.setInternalBPM(120);
      clockSync.startInternalClock();

      vi.advanceTimersByTime(500);
      const ticks120 = tickCallback.mock.calls.length;

      // Change to 240 BPM (should double tick rate)
      tickCallback.mockClear();
      clockSync.setInternalBPM(240);

      vi.advanceTimersByTime(500);
      const ticks240 = tickCallback.mock.calls.length;

      expect(ticks240).toBeGreaterThan(ticks120);
    });

    it('should reset ticks when starting', () => {
      clockSync.startInternalClock();
      vi.advanceTimersByTime(100);

      clockSync.stopInternalClock();
      clockSync.startInternalClock();

      expect(clockSync.getTicks()).toBe(0);
    });
  });

  describe('Clock Source Switching', () => {
    it('should switch from external to internal', () => {
      expect(clockSync.getClockSource()).toBe('external');

      clockSync.setClockSource('internal');
      expect(clockSync.getClockSource()).toBe('internal');
    });

    it('should ignore external clock when using internal', () => {
      clockSync.setClockSource('internal');

      clockSync.onMIDIClockTick(100);
      expect(clockSync.getTicks()).toBe(0); // Should not increment
    });

    it('should stop internal clock when switching to external', () => {
      clockSync.setClockSource('internal');
      clockSync.startInternalClock();
      expect(clockSync.isRunning()).toBe(true);

      clockSync.setClockSource('external');
      expect(clockSync.isRunning()).toBe(false);
    });

    it('should ignore all clock when source is off', () => {
      clockSync.setClockSource('off');

      clockSync.onMIDIClockTick(100);
      expect(clockSync.getTicks()).toBe(0);
      expect(clockSync.isRunning()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should reject invalid BPM values', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      clockSync.setInternalBPM(10); // Too low
      expect(consoleWarn).toHaveBeenCalled();

      clockSync.setInternalBPM(400); // Too high
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });

    it('should warn when starting internal clock with wrong source', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      clockSync.setClockSource('external');
      clockSync.startInternalClock();

      expect(consoleWarn).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it('should handle rapid source switching', () => {
      clockSync.setClockSource('internal');
      clockSync.setClockSource('external');
      clockSync.setClockSource('off');
      clockSync.setClockSource('internal');

      expect(clockSync.getClockSource()).toBe('internal');
      expect(() => clockSync.startInternalClock()).not.toThrow();
    });
  });
});
