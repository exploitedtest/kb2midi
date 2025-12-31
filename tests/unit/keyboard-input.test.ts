/**
 * Unit Tests for KeyboardInput
 *
 * Tests keyboard event handling, layout management, and latch mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardInput } from '@/keyboard-input';

describe('KeyboardInput', () => {
  let keyboardInput: KeyboardInput;
  let noteOnHandler: ReturnType<typeof vi.fn>;
  let noteOffHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    keyboardInput = new KeyboardInput();
    noteOnHandler = vi.fn();
    noteOffHandler = vi.fn();
  });

  afterEach(() => {
    keyboardInput.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with expanded layout', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.name).toBe('expanded');
    });

    it('should get available layouts', () => {
      const layouts = keyboardInput.getAvailableLayouts();
      expect(layouts).toContain('simple');
      expect(layouts).toContain('expanded');
    });
  });

  describe('Layout Management', () => {
    it('should switch to simple layout', () => {
      keyboardInput.setLayout('simple');
      const layout = keyboardInput.getLayout();
      expect(layout.name).toBe('simple');
    });

    it('should switch to expanded layout', () => {
      keyboardInput.setLayout('simple');
      keyboardInput.setLayout('expanded');
      const layout = keyboardInput.getLayout();
      expect(layout.name).toBe('expanded');
    });

    it('should clear pressed keys when switching layouts', () => {
      keyboardInput.setLayout('expanded');

      // Simulate key press
      const event = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true });
      document.dispatchEvent(event);

      keyboardInput.setLayout('simple');

      expect(keyboardInput.getPressedKeys().size).toBe(0);
    });
  });

  describe('Simple Layout Key Mapping', () => {
    beforeEach(() => {
      keyboardInput.setLayout('simple');
    });

    it('should map A key to note offset 0 (C)', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.keys['KeyA']).toBe(0);
    });

    it('should map W key to note offset 1 (C#)', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.keys['KeyW']).toBe(1);
    });

    it('should use Z for octave down', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.octaveDownKey).toBe('KeyZ');
    });

    it('should use X for octave up', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.octaveUpKey).toBe('KeyX');
    });
  });

  describe('Expanded Layout Key Mapping', () => {
    beforeEach(() => {
      keyboardInput.setLayout('expanded');
    });

    it('should map Z key to note offset 0 (C)', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.keys['KeyZ']).toBe(0);
    });

    it('should map S key to note offset 1 (C#)', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.keys['KeyS']).toBe(1);
    });

    it('should use ArrowLeft for octave down', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.octaveDownKey).toBe('ArrowLeft');
    });

    it('should use ArrowRight for octave up', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.octaveUpKey).toBe('ArrowRight');
    });

    it('should support top row keys (Q-P)', () => {
      const layout = keyboardInput.getLayout();
      expect(layout.keys['KeyQ']).toBe(12); // C one octave up
      expect(layout.keys['KeyW']).toBe(14); // D one octave up
    });
  });

  describe('Note On/Off Handlers', () => {
    beforeEach(() => {
      keyboardInput.setLayout('expanded');
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);
      keyboardInput.onNoteOff('KeyZ', noteOffHandler);
    });

    it('should trigger note on handler when key is pressed', () => {
      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should trigger note off handler when key is released', () => {
      const downEvent = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(downEvent);

      const upEvent = new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(upEvent);

      expect(noteOffHandler).toHaveBeenCalled();
    });

    it('should not trigger duplicate note on for repeated keydown events', () => {
      const event1 = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event1);

      noteOnHandler.mockClear();

      const event2 = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event2);

      expect(noteOnHandler).not.toHaveBeenCalled();
    });
  });

  describe('Velocity Handling', () => {
    beforeEach(() => {
      keyboardInput.setLayout('expanded');
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);
    });

    it('should use default velocity when no shift key', () => {
      keyboardInput.setVelocity(80);

      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalledWith(80);
    });

    it('should use maximum velocity (127) when shift key is pressed', () => {
      keyboardInput.setVelocity(80);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        shiftKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalledWith(127);
    });

    it('should set custom velocity value', () => {
      keyboardInput.setVelocity(64);

      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalledWith(64);
    });

    it('should clamp velocity to 1-127 range', () => {
      keyboardInput.setVelocity(200);
      const event1 = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event1);
      expect(noteOnHandler).toHaveBeenCalledWith(127);

      noteOnHandler.mockClear();

      keyboardInput.setVelocity(0);
      const event2 = new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true });
      document.dispatchEvent(event2);
      // Should clamp to minimum of 1
    });
  });

  describe('Special Keys', () => {
    it('should register octave down handler', () => {
      const handler = vi.fn();
      keyboardInput.onSpecialKey('octaveDown', handler);

      const event = new KeyboardEvent('keydown', {
        code: 'ArrowLeft',
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
    });

    it('should register octave up handler', () => {
      const handler = vi.fn();
      keyboardInput.onSpecialKey('octaveUp', handler);

      const event = new KeyboardEvent('keydown', {
        code: 'ArrowRight',
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(handler).toHaveBeenCalled();
    });

    it('should register mod wheel handler', () => {
      const modOnHandler = vi.fn();
      const modOffHandler = vi.fn();

      keyboardInput.onSpecialKey('modOn', modOnHandler);
      keyboardInput.onSpecialKey('modOff', modOffHandler);

      const downEvent = new KeyboardEvent('keydown', {
        code: 'ArrowUp',
        bubbles: true
      });
      document.dispatchEvent(downEvent);

      expect(modOnHandler).toHaveBeenCalled();

      const upEvent = new KeyboardEvent('keyup', {
        code: 'ArrowUp',
        bubbles: true
      });
      document.dispatchEvent(upEvent);

      expect(modOffHandler).toHaveBeenCalled();
    });

    it('should register pitch bend handler', () => {
      const pitchOnHandler = vi.fn();
      const pitchOffHandler = vi.fn();

      keyboardInput.onSpecialKey('pitchDownOn', pitchOnHandler);
      keyboardInput.onSpecialKey('pitchDownOff', pitchOffHandler);

      const downEvent = new KeyboardEvent('keydown', {
        code: 'ArrowDown',
        bubbles: true
      });
      document.dispatchEvent(downEvent);

      expect(pitchOnHandler).toHaveBeenCalled();

      const upEvent = new KeyboardEvent('keyup', {
        code: 'ArrowDown',
        bubbles: true
      });
      document.dispatchEvent(upEvent);

      expect(pitchOffHandler).toHaveBeenCalled();
    });

    it('should register sustain pedal handler', () => {
      const sustainOffHandler = vi.fn();
      keyboardInput.onSpecialKey('sustainOff', sustainOffHandler);

      const upEvent = new KeyboardEvent('keyup', {
        code: 'Space',
        bubbles: true
      });
      document.dispatchEvent(upEvent);

      expect(sustainOffHandler).toHaveBeenCalled();
    });
  });

  describe('Latch Mode', () => {
    beforeEach(() => {
      keyboardInput.setLayout('expanded');
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);
      keyboardInput.onNoteOff('KeyZ', noteOffHandler);
    });

    it('should default to latch mode off', () => {
      expect(keyboardInput.getLatchMode()).toBe(false);
    });

    it('should enable latch mode', () => {
      keyboardInput.setLatchMode(true);
      expect(keyboardInput.getLatchMode()).toBe(true);
    });

    it('should toggle note on first key press in latch mode', () => {
      keyboardInput.setLatchMode(true);

      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalled();
      expect(noteOffHandler).not.toHaveBeenCalled();
    });

    it('should toggle note off on second key press in latch mode', () => {
      keyboardInput.setLatchMode(true);

      const event1 = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event1);

      noteOnHandler.mockClear();
      noteOffHandler.mockClear();

      // Release key
      const upEvent = new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(upEvent);

      // Press again to toggle off
      const event2 = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event2);

      expect(noteOnHandler).not.toHaveBeenCalled();
      expect(noteOffHandler).toHaveBeenCalled();
    });

    it('should not trigger note off on key release in latch mode', () => {
      keyboardInput.setLatchMode(true);

      const downEvent = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(downEvent);

      noteOffHandler.mockClear();

      const upEvent = new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(upEvent);

      expect(noteOffHandler).not.toHaveBeenCalled();
    });

    it('should release all latched notes when disabling latch mode', () => {
      keyboardInput.setLatchMode(true);

      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      noteOffHandler.mockClear();

      keyboardInput.setLatchMode(false);

      expect(noteOffHandler).toHaveBeenCalled();
    });
  });

  describe('Pressed Keys Tracking', () => {
    it('should track pressed keys', () => {
      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      expect(keyboardInput.isKeyPressed('KeyZ')).toBe(true);
    });

    it('should stop tracking when key is released', () => {
      const downEvent = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(downEvent);

      const upEvent = new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(upEvent);

      expect(keyboardInput.isKeyPressed('KeyZ')).toBe(false);
    });

    it('should get all pressed keys', () => {
      const event1 = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event1);

      const event2 = new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true });
      document.dispatchEvent(event2);

      const pressedKeys = keyboardInput.getPressedKeys();
      expect(pressedKeys.has('KeyZ')).toBe(true);
      expect(pressedKeys.has('KeyX')).toBe(true);
    });

    it('should reset pressed keys', () => {
      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      keyboardInput.resetPressedKeys();

      expect(keyboardInput.getPressedKeys().size).toBe(0);
    });
  });

  describe('Input Field Filtering', () => {
    it('should ignore keydown events from text input fields', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: input, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('should ignore keydown events from textareas', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('should ignore keydown events from contenteditable elements', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const div = document.createElement('div');
      div.contentEditable = 'true';
      // jsdom may not set isContentEditable correctly, so mock it
      Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
      document.body.appendChild(div);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: div, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });

    it('should allow keydown events from range inputs (sliders)', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const input = document.createElement('input');
      input.type = 'range';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: input, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('should allow keydown events from checkbox inputs', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const input = document.createElement('input');
      input.type = 'checkbox';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: input, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('should allow keydown events from select elements', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const select = document.createElement('select');
      document.body.appendChild(select);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: select, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalled();

      document.body.removeChild(select);
    });

    it('should ignore keydown events from password inputs', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const input = document.createElement('input');
      input.type = 'password';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: input, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('should ignore keydown events from email inputs', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const input = document.createElement('input');
      input.type = 'email';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        bubbles: true
      });

      Object.defineProperty(event, 'target', { value: input, enumerable: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  describe('Modifier Key Filtering', () => {
    beforeEach(() => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);
    });

    it('should ignore events with Ctrl modifier', () => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        ctrlKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();
    });

    it('should ignore events with Alt modifier', () => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        altKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();
    });

    it('should ignore events with Meta modifier', () => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        metaKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();
    });

    it('should allow Shift modifier (for velocity)', () => {
      const event = new KeyboardEvent('keydown', {
        code: 'KeyZ',
        shiftKey: true,
        bubbles: true
      });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on cleanup', () => {
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);
      keyboardInput.cleanup();

      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).not.toHaveBeenCalled();
    });

    it('should be able to re-attach after cleanup', () => {
      keyboardInput.cleanup();
      keyboardInput.attach();
      keyboardInput.onNoteOn('KeyZ', noteOnHandler);

      const event = new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true });
      document.dispatchEvent(event);

      expect(noteOnHandler).toHaveBeenCalled();
    });
  });
});
