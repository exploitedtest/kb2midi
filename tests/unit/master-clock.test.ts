/**
 * Unit Tests for MasterClock
 *
 * Tests internal master clock generation, BPM control, and timing events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MasterClock } from '@/master-clock';

describe('MasterClock', () => {
  let masterClock: MasterClock;

  beforeEach(() => {
    masterClock = new MasterClock();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (masterClock.isClockRunning()) {
      masterClock.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default BPM of 120', () => {
      expect(masterClock.getBPM()).toBe(120);
    });

    it('should not be running initially', () => {
      expect(masterClock.isClockRunning()).toBe(false);
    });

    it('should have zero ticks initially', () => {
      expect(masterClock.getTicks()).toBe(0);
    });
  });

  describe('BPM Control', () => {
    it('should set BPM within valid range', () => {
      masterClock.setBPM(140);
      expect(masterClock.getBPM()).toBe(140);
    });

    it('should reject BPM below 1', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      masterClock.setBPM(0);
      expect(masterClock.getBPM()).toBe(120); // Should remain default
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should reject BPM above 999', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      masterClock.setBPM(1000);
      expect(masterClock.getBPM()).toBe(120); // Should remain default
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should restart clock when changing BPM while running', () => {
      const startCallback = vi.fn();
      const stopCallback = vi.fn();

      masterClock.onStart(startCallback);
      masterClock.onStop(stopCallback);

      masterClock.start();
      expect(startCallback).toHaveBeenCalledTimes(1);

      masterClock.setBPM(140);

      expect(stopCallback).toHaveBeenCalledTimes(1);
      expect(startCallback).toHaveBeenCalledTimes(2);
      expect(masterClock.isClockRunning()).toBe(true);
    });

    it('should not restart clock when changing BPM while stopped', () => {
      const startCallback = vi.fn();

      masterClock.onStart(startCallback);
      masterClock.setBPM(140);

      expect(startCallback).not.toHaveBeenCalled();
      expect(masterClock.isClockRunning()).toBe(false);
    });
  });

  describe('Start/Stop Control', () => {
    it('should start the clock', () => {
      masterClock.start();

      expect(masterClock.isClockRunning()).toBe(true);
    });

    it('should reset ticks when starting', () => {
      masterClock.start();
      vi.advanceTimersByTime(100);
      masterClock.stop();

      const ticksBefore = masterClock.getTicks();
      expect(ticksBefore).toBeGreaterThan(0);

      masterClock.start();
      expect(masterClock.getTicks()).toBe(0);
    });

    it('should trigger onStart callback', () => {
      const callback = vi.fn();
      masterClock.onStart(callback);

      masterClock.start();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not start if already running', () => {
      const callback = vi.fn();
      masterClock.onStart(callback);

      masterClock.start();
      masterClock.start(); // Try to start again

      expect(callback).toHaveBeenCalledTimes(1); // Should only be called once
    });

    it('should stop the clock', () => {
      masterClock.start();
      masterClock.stop();

      expect(masterClock.isClockRunning()).toBe(false);
    });

    it('should trigger onStop callback', () => {
      const callback = vi.fn();
      masterClock.onStop(callback);

      masterClock.start();
      masterClock.stop();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not stop if already stopped', () => {
      const callback = vi.fn();
      masterClock.onStop(callback);

      masterClock.stop(); // Try to stop when not running

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Continue Control', () => {
    it('should continue without resetting ticks', () => {
      masterClock.start();
      vi.advanceTimersByTime(100);
      masterClock.stop();

      const ticksBefore = masterClock.getTicks();
      expect(ticksBefore).toBeGreaterThan(0);

      masterClock.continue();

      expect(masterClock.getTicks()).toBe(ticksBefore); // Ticks preserved
      expect(masterClock.isClockRunning()).toBe(true);
    });

    it('should trigger onStart callback on continue', () => {
      const callback = vi.fn();
      masterClock.onStart(callback);

      masterClock.continue();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not continue if already running', () => {
      const callback = vi.fn();
      masterClock.onStart(callback);

      masterClock.start();
      masterClock.continue(); // Try to continue when already running

      expect(callback).toHaveBeenCalledTimes(1); // Only called by start()
    });
  });

  describe('Tick Generation', () => {
    it('should generate ticks at correct rate for 120 BPM', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.setBPM(120);
      masterClock.start();

      // At 120 BPM: 24 ticks per quarter note, 2 quarters per second = 48 ticks per second
      // Each tick = 1000ms / 48 = ~20.83ms
      vi.advanceTimersByTime(1000); // Advance 1 second

      expect(tickCallback).toHaveBeenCalledTimes(48);
    });

    it('should generate ticks at correct rate for 60 BPM', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.setBPM(60);
      masterClock.start();

      // At 60 BPM: 24 ticks per second
      vi.advanceTimersByTime(1000);

      expect(tickCallback).toHaveBeenCalledTimes(24);
    });

    it('should generate ticks at correct rate for 180 BPM', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.setBPM(180);
      masterClock.start();

      // At 180 BPM: 72 ticks per second
      vi.advanceTimersByTime(1000);

      expect(tickCallback).toHaveBeenCalledTimes(72);
    });

    it('should pass timestamp to tick callbacks', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.start();
      vi.advanceTimersByTime(100);

      expect(tickCallback).toHaveBeenCalled();
      expect(typeof tickCallback.mock.calls[0][0]).toBe('number');
    });

    it('should increment tick counter', () => {
      masterClock.start();

      expect(masterClock.getTicks()).toBe(0);

      vi.advanceTimersByTime(50);

      expect(masterClock.getTicks()).toBeGreaterThan(0);
    });

    it('should not generate ticks when stopped', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.start();
      masterClock.stop();

      tickCallback.mockClear();
      vi.advanceTimersByTime(1000);

      expect(tickCallback).not.toHaveBeenCalled();
    });
  });

  describe('Quarter Note Events', () => {
    it('should trigger quarter note callback every 24 ticks', () => {
      const quarterCallback = vi.fn();
      masterClock.onQuarterNote(quarterCallback);

      masterClock.start();

      // At 120 BPM: 48 ticks per second = 2 quarter notes per second
      vi.advanceTimersByTime(1000);

      expect(quarterCallback).toHaveBeenCalledTimes(2);
    });

    it('should align quarter notes with clock divisions', () => {
      const quarterCallback = vi.fn();
      masterClock.onQuarterNote(quarterCallback);

      masterClock.start();

      // Advance to just before first quarter note
      vi.advanceTimersByTime(499); // Just under 24 ticks
      expect(quarterCallback).not.toHaveBeenCalled();

      // Advance to first quarter note
      vi.advanceTimersByTime(2);
      expect(quarterCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sixteenth Note Events', () => {
    it('should trigger sixteenth note callback every 6 ticks', () => {
      const sixteenthCallback = vi.fn();
      masterClock.onSixteenthNote(sixteenthCallback);

      masterClock.start();

      // At 120 BPM: 48 ticks per second = 8 sixteenth notes per second
      vi.advanceTimersByTime(1000);

      expect(sixteenthCallback).toHaveBeenCalledTimes(8);
    });
  });

  describe('Callback Management', () => {
    it('should support multiple tick callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      masterClock.onTick(callback1);
      masterClock.onTick(callback2);

      masterClock.start();
      vi.advanceTimersByTime(50);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should support multiple start callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      masterClock.onStart(callback1);
      masterClock.onStart(callback2);

      masterClock.start();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should support multiple stop callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      masterClock.onStop(callback1);
      masterClock.onStop(callback2);

      masterClock.start();
      masterClock.stop();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should clear all callbacks', () => {
      const tickCallback = vi.fn();
      const quarterCallback = vi.fn();
      const sixteenthCallback = vi.fn();
      const startCallback = vi.fn();
      const stopCallback = vi.fn();

      masterClock.onTick(tickCallback);
      masterClock.onQuarterNote(quarterCallback);
      masterClock.onSixteenthNote(sixteenthCallback);
      masterClock.onStart(startCallback);
      masterClock.onStop(stopCallback);

      masterClock.clearCallbacks();

      masterClock.start();
      vi.advanceTimersByTime(1000);
      masterClock.stop();

      expect(tickCallback).not.toHaveBeenCalled();
      expect(quarterCallback).not.toHaveBeenCalled();
      expect(sixteenthCallback).not.toHaveBeenCalled();
      expect(startCallback).not.toHaveBeenCalled();
      expect(stopCallback).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very fast BPM (300)', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.setBPM(300);
      masterClock.start();

      vi.advanceTimersByTime(1000);

      // 300 BPM: 120 ticks per second
      expect(tickCallback).toHaveBeenCalledTimes(120);
    });

    it('should handle very slow BPM (20)', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.setBPM(20);
      masterClock.start();

      vi.advanceTimersByTime(1000);

      // 20 BPM: 8 ticks per second
      expect(tickCallback).toHaveBeenCalledTimes(8);
    });

    it('should handle rapid start/stop cycles', () => {
      for (let i = 0; i < 10; i++) {
        masterClock.start();
        vi.advanceTimersByTime(10);
        masterClock.stop();
      }

      expect(masterClock.isClockRunning()).toBe(false);
    });

    it('should handle BPM changes during playback', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.setBPM(120);
      masterClock.start();
      vi.advanceTimersByTime(500);

      const ticks1 = tickCallback.mock.calls.length;
      tickCallback.mockClear();

      masterClock.setBPM(240); // Double the speed
      vi.advanceTimersByTime(500);

      const ticks2 = tickCallback.mock.calls.length;

      // Second interval should have roughly twice as many ticks
      expect(ticks2).toBeGreaterThan(ticks1 * 1.5);
    });

    it('should not leak memory with many callbacks', () => {
      // Add many callbacks
      for (let i = 0; i < 100; i++) {
        masterClock.onTick(() => {});
      }

      masterClock.start();
      vi.advanceTimersByTime(1000);
      masterClock.stop();

      // Clear and verify no calls after clearing
      masterClock.clearCallbacks();

      const newCallback = vi.fn();
      masterClock.onTick(newCallback);

      masterClock.start();
      vi.advanceTimersByTime(100);

      expect(newCallback).toHaveBeenCalled();
    });

    it('should handle long-running clock without drift', () => {
      const tickCallback = vi.fn();
      masterClock.onTick(tickCallback);

      masterClock.setBPM(120);
      masterClock.start();

      // Run for 10 seconds
      vi.advanceTimersByTime(10000);

      // 120 BPM: 48 ticks per second * 10 seconds = 480 ticks
      expect(tickCallback).toHaveBeenCalledTimes(480);
    });
  });

  describe('Integration with Clock Sync', () => {
    it('should provide consistent timing interface', () => {
      // Verify interface compatibility with ClockSync expectations
      const tickCallback = vi.fn();
      const quarterCallback = vi.fn();
      const sixteenthCallback = vi.fn();

      masterClock.onTick(tickCallback);
      masterClock.onQuarterNote(quarterCallback);
      masterClock.onSixteenthNote(sixteenthCallback);

      masterClock.start();
      vi.advanceTimersByTime(1000);

      expect(tickCallback).toHaveBeenCalled();
      expect(quarterCallback).toHaveBeenCalled();
      expect(sixteenthCallback).toHaveBeenCalled();
      expect(masterClock.getTicks()).toBeGreaterThan(0);
      expect(masterClock.getBPM()).toBe(120);
      expect(masterClock.isClockRunning()).toBe(true);
    });
  });
});
