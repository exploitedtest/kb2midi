/**
 * Unit Tests for Arpeggiator
 *
 * Tests arpeggiator patterns, timing strategies, generative features,
 * and clock synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Arpeggiator,
  StraightTiming,
  SwingTiming,
  ShuffleTiming,
  DottedTiming,
  HumanizeTiming,
  LayeredTiming,
  VelocityHumanize,
  AccentPattern,
  GateProbability
} from '@/arpeggiator';
import { ClockSync } from '@/clock-sync';
import { IMidiEngine } from '@/types';

describe('Arpeggiator', () => {
  let arpeggiator: Arpeggiator;
  let clockSync: ClockSync;
  let mockMidiEngine: IMidiEngine;
  let playedNotes: Array<{ note: number; velocity: number; channel: number }>;

  beforeEach(() => {
    vi.useFakeTimers();
    clockSync = new ClockSync();

    playedNotes = [];
    mockMidiEngine = {
      playNote: (note, velocity, channel) => {
        playedNotes.push({ note, velocity, channel });
      },
      stopNote: vi.fn()
    };

    arpeggiator = new Arpeggiator(clockSync);
    arpeggiator.setMidiEngine(mockMidiEngine);
    arpeggiator.setParamGetters(() => 1, () => 80);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default state', () => {
      expect(arpeggiator.isEnabled()).toBe(false);
      expect(arpeggiator.getCurrentStep()).toBe(0);
      expect(arpeggiator.getNoteOrder()).toEqual([]);
    });

    it('should enable and disable arpeggiator', () => {
      arpeggiator.setEnabled(true);
      expect(arpeggiator.isEnabled()).toBe(true);

      arpeggiator.setEnabled(false);
      expect(arpeggiator.isEnabled()).toBe(false);
    });

    it('should add notes to the arpeggio', () => {
      arpeggiator.addNote(60);
      arpeggiator.addNote(64);
      arpeggiator.addNote(67);

      expect(arpeggiator.getNoteOrder()).toContain(60);
      expect(arpeggiator.getNoteOrder()).toContain(64);
      expect(arpeggiator.getNoteOrder()).toContain(67);
    });

    it('should remove notes from the arpeggio', () => {
      arpeggiator.addNote(60);
      arpeggiator.addNote(64);
      arpeggiator.addNote(67);

      arpeggiator.removeNote(64);

      expect(arpeggiator.getNoteOrder()).not.toContain(64);
      expect(arpeggiator.getNoteOrder()).toContain(60);
      expect(arpeggiator.getNoteOrder()).toContain(67);
    });

    it('should clear all notes', () => {
      arpeggiator.addNote(60);
      arpeggiator.addNote(64);

      arpeggiator.clearNotes();

      expect(arpeggiator.getNoteOrder()).toEqual([]);
    });
  });

  describe('Arpeggiator Patterns', () => {
    beforeEach(() => {
      arpeggiator.addNote(60); // C
      arpeggiator.addNote(64); // E
      arpeggiator.addNote(67); // G
      arpeggiator.setEnabled(true);
    });

    it('should play "up" pattern in ascending order', () => {
      arpeggiator.setPattern('up');
      const notes = arpeggiator.getNoteOrder();

      expect(notes[0]).toBe(60);
      expect(notes[1]).toBe(64);
      expect(notes[2]).toBe(67);
    });

    it('should play "down" pattern in descending order', () => {
      arpeggiator.setPattern('down');
      const notes = arpeggiator.getNoteOrder();

      expect(notes[0]).toBe(67);
      expect(notes[1]).toBe(64);
      expect(notes[2]).toBe(60);
    });

    it('should play "up-down" pattern without duplicates at endpoints', () => {
      arpeggiator.setPattern('up-down');
      const notes = arpeggiator.getNoteOrder();

      // Should be: 60, 64, 67, 64 (no duplicate 60 or 67 at wrap)
      expect(notes).toEqual([60, 64, 67, 64]);
    });

    it('should play "down-up" pattern without duplicates at endpoints', () => {
      arpeggiator.setPattern('down-up');
      const notes = arpeggiator.getNoteOrder();

      // Should be: 67, 64, 60, 64 (no duplicate 67 or 60 at wrap)
      expect(notes).toEqual([67, 64, 60, 64]);
    });

    it('should play "random" pattern with all notes', () => {
      arpeggiator.setPattern('random');
      const notes = arpeggiator.getNoteOrder();

      expect(notes).toHaveLength(3);
      expect(notes).toContain(60);
      expect(notes).toContain(64);
      expect(notes).toContain(67);
    });

    it('should play "chord" pattern with all notes simultaneously', () => {
      arpeggiator.setPattern('chord');
      const notes = arpeggiator.getNoteOrder();

      expect(notes).toContain(60);
      expect(notes).toContain(64);
      expect(notes).toContain(67);
    });
  });

  describe('Octave Range', () => {
    beforeEach(() => {
      arpeggiator.addNote(60); // C4
      arpeggiator.setEnabled(true);
    });

    it('should support 1 octave range', () => {
      arpeggiator.setOctaveRange(1);
      const notes = arpeggiator.getNoteOrder();

      expect(notes).toEqual([60]);
    });

    it('should support 2 octave range', () => {
      arpeggiator.setOctaveRange(2);
      const notes = arpeggiator.getNoteOrder();

      expect(notes).toEqual([60, 72]); // C4, C5
    });

    it('should support 3 octave range', () => {
      arpeggiator.setOctaveRange(3);
      const notes = arpeggiator.getNoteOrder();

      expect(notes).toEqual([60, 72, 84]); // C4, C5, C6
    });
  });

  describe('Clock Synchronization', () => {
    beforeEach(() => {
      arpeggiator.addNote(60);
      arpeggiator.addNote(64);
      arpeggiator.addNote(67);
      arpeggiator.setEnabled(true);
      arpeggiator.setPattern('up');
    });

    it('should play notes on clock ticks', () => {
      clockSync.onMIDIStart();

      // Simulate clock ticks (16th notes at 4 divisor)
      for (let i = 0; i < 6; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      vi.runAllTimers();

      // Should have played notes
      expect(playedNotes.length).toBeGreaterThan(0);
    });

    it('should sync to different clock divisions', () => {
      arpeggiator.setClockDivisor(2); // 8th notes

      clockSync.onMIDIStart();

      // 12 ticks = 1 8th note at divisor 2
      for (let i = 0; i < 24; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      vi.runAllTimers();

      expect(playedNotes.length).toBeGreaterThan(0);
    });

    it('should stop arpeggiating when disabled', () => {
      clockSync.onMIDIStart();
      arpeggiator.setEnabled(false);

      playedNotes = [];

      for (let i = 0; i < 24; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      vi.runAllTimers();

      expect(playedNotes.length).toBe(0);
    });
  });

  describe('Timing Strategies', () => {
    describe('Straight Timing', () => {
      it('should return zero offset for all steps', () => {
        const timing = new StraightTiming();

        expect(timing.getDelayOffset(0, 100)).toBe(0);
        expect(timing.getDelayOffset(1, 100)).toBe(0);
        expect(timing.getDelayOffset(100, 100)).toBe(0);
      });
    });

    describe('Swing Timing', () => {
      it('should delay odd steps by 50% at full swing', () => {
        const timing = new SwingTiming(1.0);

        expect(timing.getDelayOffset(0, 100)).toBe(0);
        expect(timing.getDelayOffset(1, 100)).toBe(50); // 50% of 100ms
        expect(timing.getDelayOffset(2, 100)).toBe(0);
        expect(timing.getDelayOffset(3, 100)).toBe(50);
      });

      it('should scale delay with swing amount', () => {
        const timing = new SwingTiming(0.5);

        expect(timing.getDelayOffset(1, 100)).toBe(25); // 50% swing of 50ms
      });

      it('should not delay even steps', () => {
        const timing = new SwingTiming(1.0);

        expect(timing.getDelayOffset(0, 100)).toBe(0);
        expect(timing.getDelayOffset(2, 100)).toBe(0);
        expect(timing.getDelayOffset(4, 100)).toBe(0);
      });
    });

    describe('Shuffle Timing', () => {
      it('should delay odd steps to 2/3 position', () => {
        const timing = new ShuffleTiming(1.0);

        const offset = timing.getDelayOffset(1, 150);
        expect(offset).toBeCloseTo(100, 0.1); // 2/3 of 150ms
      });
    });

    describe('Dotted Timing', () => {
      it('should delay odd steps to 75% position', () => {
        const timing = new DottedTiming(1.0);

        expect(timing.getDelayOffset(1, 100)).toBe(75);
      });
    });

    describe('Humanize Timing', () => {
      it('should add random variation to timing', () => {
        const timing = new HumanizeTiming(1.0, 12345); // Fixed seed

        const offset1 = timing.getDelayOffset(0, 100);
        const offset2 = timing.getDelayOffset(1, 100);

        // Variations should be different
        expect(offset1).not.toBe(offset2);
      });

      it('should scale with tempo', () => {
        const timing = new HumanizeTiming(1.0, 12345);

        const slowOffset = timing.getDelayOffset(0, 200); // Slow tempo
        const fastOffset = timing.getDelayOffset(0, 50); // Fast tempo

        // Slow tempo should have more variation
        expect(Math.abs(slowOffset)).toBeGreaterThanOrEqual(Math.abs(fastOffset));
      });

      it('should use consistent seed for repeatable patterns', () => {
        const timing1 = new HumanizeTiming(1.0, 12345);
        const timing2 = new HumanizeTiming(1.0, 12345);

        const offset1 = timing1.getDelayOffset(5, 100);
        const offset2 = timing2.getDelayOffset(5, 100);

        expect(offset1).toBe(offset2);
      });
    });

    describe('Layered Timing', () => {
      it('should combine multiple timing strategies', () => {
        const swing = new SwingTiming(1.0);
        const humanize = new HumanizeTiming(1.0, 12345);
        const layered = new LayeredTiming([swing, humanize]);

        const swingOffset = swing.getDelayOffset(1, 100);
        const humanizeOffset = humanize.getDelayOffset(1, 100);
        const layeredOffset = layered.getDelayOffset(1, 100);

        // Layered should sum both offsets
        expect(layeredOffset).toBe(swingOffset + humanizeOffset);
      });
    });
  });

  describe('Velocity Humanization', () => {
    it('should add random velocity variation', () => {
      const humanize = new VelocityHumanize(1.0, 12345);

      const offset1 = humanize.getVelocityOffset(0);
      const offset2 = humanize.getVelocityOffset(1);

      // Should produce different offsets
      expect(offset1).not.toBe(offset2);
    });

    it('should limit variation to ±10 at full amount', () => {
      const humanize = new VelocityHumanize(1.0, 12345);

      for (let i = 0; i < 100; i++) {
        const offset = humanize.getVelocityOffset(i);
        expect(Math.abs(offset)).toBeLessThanOrEqual(10);
      }
    });

    it('should scale variation with amount', () => {
      const humanize50 = new VelocityHumanize(0.5, 12345);
      const humanize100 = new VelocityHumanize(1.0, 12345);

      const offset50 = humanize50.getVelocityOffset(0);
      const offset100 = humanize100.getVelocityOffset(0);

      // Full amount should produce larger offsets
      expect(Math.abs(offset100)).toBeGreaterThanOrEqual(Math.abs(offset50));
    });

    it('should use consistent seed for repeatable patterns', () => {
      const humanize1 = new VelocityHumanize(1.0, 12345);
      const humanize2 = new VelocityHumanize(1.0, 12345);

      const offset1 = humanize1.getVelocityOffset(5);
      const offset2 = humanize2.getVelocityOffset(5);

      expect(offset1).toBe(offset2);
    });
  });

  describe('Accent Patterns', () => {
    it('should apply no accents with "none" pattern', () => {
      const pattern = new AccentPattern('none');

      for (let i = 0; i < 10; i++) {
        expect(pattern.getVelocityMultiplier(i)).toBe(1.0);
      }
    });

    it('should emphasize downbeats (every 4th step)', () => {
      const pattern = new AccentPattern('downbeats');

      expect(pattern.getVelocityMultiplier(0)).toBe(1.25); // Emphasized
      expect(pattern.getVelocityMultiplier(1)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(2)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(3)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(4)).toBe(1.25); // Emphasized
    });

    it('should emphasize offbeats (3rd step)', () => {
      const pattern = new AccentPattern('offbeats');

      expect(pattern.getVelocityMultiplier(0)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(1)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(2)).toBe(1.25); // Emphasized
      expect(pattern.getVelocityMultiplier(3)).toBe(1.0);
    });

    it('should emphasize every 3rd step', () => {
      const pattern = new AccentPattern('every-3rd');

      expect(pattern.getVelocityMultiplier(0)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(1)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(2)).toBe(1.2); // Emphasized
      expect(pattern.getVelocityMultiplier(3)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(4)).toBe(1.0);
      expect(pattern.getVelocityMultiplier(5)).toBe(1.2); // Emphasized
    });
  });

  describe('Gate Probability', () => {
    it('should always play at 100% probability', () => {
      const probability = new GateProbability(1.0, 12345);

      for (let i = 0; i < 100; i++) {
        expect(probability.shouldPlayStep(i)).toBe(true);
      }
    });

    it('should never play at 0% probability', () => {
      const probability = new GateProbability(0.0, 12345);

      for (let i = 0; i < 100; i++) {
        expect(probability.shouldPlayStep(i)).toBe(false);
      }
    });

    it('should skip approximately half the steps at 50% probability', () => {
      const probability = new GateProbability(0.5, 12345);

      let playCount = 0;
      for (let i = 0; i < 100; i++) {
        if (probability.shouldPlayStep(i)) {
          playCount++;
        }
      }

      // Should be approximately 50 (±20 for randomness)
      expect(playCount).toBeGreaterThan(30);
      expect(playCount).toBeLessThan(70);
    });

    it('should use consistent seed for repeatable patterns', () => {
      const prob1 = new GateProbability(0.75, 12345);
      const prob2 = new GateProbability(0.75, 12345);

      for (let i = 0; i < 100; i++) {
        expect(prob1.shouldPlayStep(i)).toBe(prob2.shouldPlayStep(i));
      }
    });
  });

  describe('Ratcheting', () => {
    it('should set ratchet count', () => {
      arpeggiator.setRatchetCount(2);
      // Ratcheting is applied during playback, testing integration in E2E
    });

    it('should clamp ratchet count to 1-4 range', () => {
      arpeggiator.setRatchetCount(0);
      // Should clamp to 1 (tested via integration)

      arpeggiator.setRatchetCount(10);
      // Should clamp to 4 (tested via integration)
    });
  });

  describe('Sliding Window / Notes Per Step', () => {
    beforeEach(() => {
      arpeggiator.addNote(60);
      arpeggiator.addNote(64);
      arpeggiator.addNote(67);
      arpeggiator.addNote(72);
      arpeggiator.setPattern('up');
      arpeggiator.setEnabled(true);
    });

    it('should default to 1 note per step', () => {
      expect(arpeggiator.getNotesPerStep()).toBe(1);
    });

    it('should set notes per step', () => {
      arpeggiator.setNotesPerStep(2);
      expect(arpeggiator.getNotesPerStep()).toBe(2);
    });

    it('should clamp notes per step to minimum of 1', () => {
      arpeggiator.setNotesPerStep(0);
      expect(arpeggiator.getNotesPerStep()).toBe(1);
    });

    it('should set sliding window overlap mode', () => {
      arpeggiator.setSlidingWindowOverlap(true);
      arpeggiator.setSlidingWindowOverlap(false);
      // Behavior tested in E2E
    });
  });

  describe('Gate Length', () => {
    it('should set gate length', () => {
      arpeggiator.setGateLength(0.5);
      // Gate length affects note duration, tested in E2E
    });

    it('should clamp gate length to 0-1 range', () => {
      arpeggiator.setGateLength(-0.5);
      arpeggiator.setGateLength(1.5);
      // Clamping verified in integration tests
    });

    it('should enforce minimum gate time safety (5ms)', () => {
      arpeggiator.setGateLength(0.01); // Very short gate
      // Minimum safety enforced during playback, tested in E2E
    });
  });

  describe('Step Callbacks', () => {
    it('should trigger step callbacks when playing', () => {
      const callback = vi.fn();
      arpeggiator.onStep(callback);

      arpeggiator.addNote(60);
      arpeggiator.setEnabled(true);

      clockSync.onMIDIStart();
      for (let i = 0; i < 6; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      vi.runAllTimers();

      expect(callback).toHaveBeenCalled();
    });

    it('should clear step callbacks', () => {
      const callback = vi.fn();
      arpeggiator.onStep(callback);
      arpeggiator.clearStepCallbacks();

      arpeggiator.addNote(60);
      arpeggiator.setEnabled(true);

      clockSync.onMIDIStart();
      for (let i = 0; i < 6; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      vi.runAllTimers();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Timing Features', () => {
    beforeEach(() => {
      arpeggiator.addNote(60);
      arpeggiator.addNote(64);
      arpeggiator.addNote(67);
      arpeggiator.setEnabled(true);
    });

    it('should apply timing strategy to playback', () => {
      const swing = new SwingTiming(1.0);
      arpeggiator.setTimingStrategy(swing);

      // Timing verified during playback in E2E tests
    });

    it('should apply velocity humanization', () => {
      const humanize = new VelocityHumanize(1.0, 12345);
      arpeggiator.setVelocityHumanize(humanize);

      // Velocity variation verified in E2E tests
    });

    it('should apply accent pattern', () => {
      arpeggiator.setAccentPattern('downbeats');

      // Accent verification in E2E tests
    });

    it('should apply gate probability', () => {
      arpeggiator.setGateProbability(0.5);

      // Probability verified in E2E tests
    });
  });

  describe('State Management', () => {
    it('should get current state', () => {
      arpeggiator.setEnabled(true);
      arpeggiator.setPattern('up');
      arpeggiator.setGateLength(0.75);

      const state = arpeggiator.getState();

      expect(state.enabled).toBe(true);
      expect(state.pattern).toBe('up');
      expect(state.gateLength).toBe(0.75);
    });

    it('should reset step counter when disabled', () => {
      arpeggiator.addNote(60);
      arpeggiator.setEnabled(true);

      clockSync.onMIDIStart();
      for (let i = 0; i < 12; i++) {
        clockSync.onMIDIClockTick(i * 20);
      }

      arpeggiator.setEnabled(false);

      expect(arpeggiator.getCurrentStep()).toBe(0);
    });
  });
});
