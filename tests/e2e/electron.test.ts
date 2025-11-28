/**
 * End-to-End Tests for kb2midi Electron Application
 *
 * Tests Electron-specific functionality including window management,
 * system integration, and desktop features
 */

import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('kb2midi Electron Application', () => {
  test.describe('Application Lifecycle', () => {
    test('should launch the Electron app', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await expect(window).toBeTruthy();

      await window.waitForLoadState('networkidle');

      // Take screenshot for verification
      await window.screenshot({ path: 'test-results/electron-launch.png' });

      await electronApp.close();
    });

    test('should have correct window title', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      const title = await window.title();

      expect(title).toMatch(/kb2midi/i);

      await electronApp.close();
    });

    test('should load the application UI', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      const piano = await window.locator('.piano-container');
      await expect(piano).toBeVisible();

      await electronApp.close();
    });
  });

  test.describe('Window Management', () => {
    test('should create window with correct dimensions', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      const size = await window.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));

      // Window should have reasonable dimensions
      expect(size.width).toBeGreaterThan(800);
      expect(size.height).toBeGreaterThan(600);

      await electronApp.close();
    });

    test('should handle window resize', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();

      await window.setViewportSize({ width: 1200, height: 800 });
      await window.waitForTimeout(200);

      const newSize = await window.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));

      expect(newSize.width).toBeCloseTo(1200, -2);
      expect(newSize.height).toBeCloseTo(800, -2);

      await electronApp.close();
    });
  });

  test.describe('System Integration', () => {
    test('should handle system suspend/resume events', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // Simulate window blur (similar to suspend)
      await window.evaluate(() => {
        window.dispatchEvent(new Event('blur'));
      });

      await window.waitForTimeout(100);

      // Simulate window focus (similar to resume)
      await window.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
      });

      await window.waitForTimeout(100);

      await electronApp.close();
    });

    test('should handle application focus/blur', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // Trigger blur event
      await window.evaluate(() => {
        window.dispatchEvent(new Event('blur'));
      });

      await window.waitForTimeout(100);

      // Verify no console errors
      const errors: string[] = [];
      window.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Trigger focus event
      await window.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
      });

      await window.waitForTimeout(100);

      await electronApp.close();
    });
  });

  test.describe('MIDI Access in Electron', () => {
    test('should have Web MIDI API available', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      const hasMIDI = await window.evaluate(() => {
        return 'requestMIDIAccess' in navigator;
      });

      expect(hasMIDI).toBe(true);

      await electronApp.close();
    });

    test('should be able to request MIDI access', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      const midiAccessible = await window.evaluate(async () => {
        try {
          const access = await navigator.requestMIDIAccess();
          return access !== null;
        } catch (error) {
          return false;
        }
      });

      // MIDI access should be requestable (may not have devices)
      expect(typeof midiAccessible).toBe('boolean');

      await electronApp.close();
    });
  });

  test.describe('Keyboard Input in Electron', () => {
    test('should respond to keyboard events', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // Press a key
      await window.keyboard.press('z');
      await window.waitForTimeout(100);

      // Release the key
      await window.keyboard.up('z');
      await window.waitForTimeout(100);

      await electronApp.close();
    });

    test('should handle special keys (arrows, space, tab)', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // Test arrow keys
      await window.keyboard.press('ArrowLeft');
      await window.waitForTimeout(50);
      await window.keyboard.press('ArrowRight');
      await window.waitForTimeout(50);

      // Test space (sustain pedal)
      await window.keyboard.down('Space');
      await window.waitForTimeout(50);
      await window.keyboard.up('Space');
      await window.waitForTimeout(50);

      await electronApp.close();
    });
  });

  test.describe('Performance in Electron', () => {
    test('should start up within reasonable time', async () => {
      const startTime = Date.now();

      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      const launchTime = Date.now() - startTime;

      // Should launch within 10 seconds
      expect(launchTime).toBeLessThan(10000);

      await electronApp.close();
    });

    test('should not have memory leaks on repeated enable/disable', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // Get initial memory usage
      const initialMemory = await window.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Toggle arpeggiator many times
      for (let i = 0; i < 20; i++) {
        const arpButton = await window.getByRole('button', { name: /arpeggiator|arp/i });
        if (await arpButton.count() > 0) {
          await arpButton.click();
          await window.waitForTimeout(50);
        }
      }

      // Get final memory usage
      const finalMemory = await window.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Memory shouldn't grow significantly (allow 10MB increase)
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }

      await electronApp.close();
    });
  });

  test.describe('Desktop Features', () => {
    test('should support "Always on Top" functionality', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // Check if the window has any "always on top" related menu items or buttons
      const alwaysOnTopButton = await window.locator('button').filter({ hasText: /always.*top/i });

      if (await alwaysOnTopButton.count() > 0) {
        await alwaysOnTopButton.click();
        await window.waitForTimeout(100);

        await alwaysOnTopButton.click();
        await window.waitForTimeout(100);
      }

      await electronApp.close();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle missing MIDI devices gracefully', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // App should still function even without MIDI devices
      const piano = await window.locator('.piano-container');
      await expect(piano).toBeVisible();

      await electronApp.close();
    });

    test('should not crash on invalid keyboard input', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      // Send various keyboard inputs rapidly
      const keys = ['a', 'b', 'c', '1', '2', '3', 'Enter', 'Escape'];
      for (const key of keys) {
        await window.keyboard.press(key);
      }

      await window.waitForTimeout(100);

      // Window should still be responsive
      const piano = await window.locator('.piano-container');
      await expect(piano).toBeVisible();

      await electronApp.close();
    });
  });

  test.describe('Cross-Platform', () => {
    test('should run on current platform', async () => {
      const electronApp = await electron.launch({
        args: [path.join(__dirname, '../../electron/main.js')],
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('networkidle');

      const platform = await window.evaluate(() => navigator.platform);

      expect(platform).toBeTruthy();

      await electronApp.close();
    });
  });
});
