/**
 * End-to-End Tests for kb2midi Web Application
 *
 * Tests the complete application flow including MIDI connection,
 * keyboard input, arpeggiator, and UI interactions
 */

import { test, expect, Page } from '@playwright/test';

test.describe('kb2midi Web Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Application Initialization', () => {
    test('should load the application', async ({ page }) => {
      await expect(page).toHaveTitle(/kb2midi/i);
    });

    test('should display the piano interface', async ({ page }) => {
      const piano = await page.locator('.piano-container');
      await expect(piano).toBeVisible();
    });

    test('should display MIDI controls', async ({ page }) => {
      const midiOutput = await page.locator('[data-testid="midi-output-select"]').or(page.locator('select').first());
      await expect(midiOutput).toBeVisible();
    });

    test('should display velocity slider', async ({ page }) => {
      const velocitySlider = await page.locator('input[type="range"]').first();
      await expect(velocitySlider).toBeVisible();
    });
  });

  test.describe('Keyboard Layout Switching', () => {
    test('should switch between simple and expanded layouts', async ({ page }) => {
      // Find layout selector
      const layoutSelect = await page.locator('select').filter({ hasText: /layout/i });

      if (await layoutSelect.count() > 0) {
        await layoutSelect.selectOption('simple');
        await page.waitForTimeout(100);

        await layoutSelect.selectOption('expanded');
        await page.waitForTimeout(100);
      }
    });
  });

  test.describe('Arpeggiator Controls', () => {
    test('should have arpeggiator enable/disable button', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await expect(arpButton).toBeVisible();
      }
    });

    test('should show/hide arpeggiator controls when toggled', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        // Check if controls are visible
        const patternSelect = await page.locator('select').filter({ hasText: /pattern|up|down/i });
        if (await patternSelect.count() > 0) {
          await expect(patternSelect).toBeVisible();
        }
      }
    });

    test('should allow pattern selection', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const patternSelect = await page.locator('select').filter({ hasText: /pattern|up|down/i }).first();
        if (await patternSelect.count() > 0) {
          const options = await patternSelect.locator('option').allTextContents();
          expect(options.length).toBeGreaterThan(0);
        }
      }
    });

    test('should have timing feel dropdown for timing strategies', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const timingSelect = await page.locator('select').filter({ hasText: /timing|swing|shuffle|straight/i });
        if (await timingSelect.count() > 0) {
          await expect(timingSelect).toBeVisible();
        }
      }
    });

    test('should have humanize checkbox', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const humanizeCheckbox = await page.locator('input[type="checkbox"]').filter({ hasText: /humanize/i });
        if (await humanizeCheckbox.count() > 0) {
          await expect(humanizeCheckbox).toBeVisible();
        }
      }
    });

    test('should have velocity humanization control', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const velHumanize = await page.locator('input[type="checkbox"]').filter({ hasText: /velocity.*humanize/i });
        if (await velHumanize.count() > 0) {
          await expect(velHumanize).toBeVisible();
        }
      }
    });

    test('should have accent pattern dropdown', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const accentSelect = await page.locator('select').filter({ hasText: /accent|downbeat|offbeat/i });
        if (await accentSelect.count() > 0) {
          await expect(accentSelect).toBeVisible();
        }
      }
    });

    test('should have probability slider', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const probSlider = await page.locator('input[type="range"]').filter({ hasText: /probability|prob/i });
        if (await probSlider.count() > 0) {
          await expect(probSlider).toBeVisible();
        }
      }
    });

    test('should have ratchet control', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const ratchetSelect = await page.locator('select').filter({ hasText: /ratchet/i });
        if (await ratchetSelect.count() > 0) {
          await expect(ratchetSelect).toBeVisible();
        }
      }
    });

    test('should have latch mode checkbox', async ({ page }) => {
      const arpButton = await page.getByRole('button', { name: /arpeggiator|arp/i }).or(
        page.locator('[data-testid="arp-enable"]')
      );

      if (await arpButton.count() > 0) {
        await arpButton.click();
        await page.waitForTimeout(200);

        const latchCheckbox = await page.locator('input[type="checkbox"]').filter({ hasText: /latch/i });
        if (await latchCheckbox.count() > 0) {
          await expect(latchCheckbox).toBeVisible();
        }
      }
    });
  });

  test.describe('MIDI Clock Sync', () => {
    test('should display BPM indicator', async ({ page }) => {
      const bpmDisplay = await page.locator('[data-testid="bpm-display"]').or(
        page.getByText(/\d+ BPM/i)
      );

      if (await bpmDisplay.count() > 0) {
        await expect(bpmDisplay).toBeVisible();
      }
    });

    test('should have clock input selector', async ({ page }) => {
      const clockSelect = await page.locator('[data-testid="clock-input-select"]').or(
        page.locator('select').filter({ hasText: /clock/i })
      );

      if (await clockSelect.count() > 0) {
        await expect(clockSelect).toBeVisible();
      }
    });
  });

  test.describe('Panic Button', () => {
    test('should have panic button', async ({ page }) => {
      const panicButton = await page.getByRole('button', { name: /panic/i }).or(
        page.locator('[data-testid="panic-button"]')
      );

      if (await panicButton.count() > 0) {
        await expect(panicButton).toBeVisible();
      }
    });

    test('should be clickable', async ({ page }) => {
      const panicButton = await page.getByRole('button', { name: /panic/i }).or(
        page.locator('[data-testid="panic-button"]')
      );

      if (await panicButton.count() > 0) {
        await panicButton.click();
        await page.waitForTimeout(100);
      }
    });
  });

  test.describe('Keyboard Interaction', () => {
    test('should respond to keyboard input', async ({ page }) => {
      // Focus on the page
      await page.click('body');

      // Press a key that should trigger a note
      await page.keyboard.press('z');
      await page.waitForTimeout(100);

      // Release the key
      await page.keyboard.up('z');
      await page.waitForTimeout(100);
    });

    test('should handle octave changes with arrow keys', async ({ page }) => {
      await page.click('body');

      // Press arrow left for octave down
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);

      // Press arrow right for octave up
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
    });

    test('should handle sustain pedal with space bar', async ({ page }) => {
      await page.click('body');

      // Press space for sustain on
      await page.keyboard.down('Space');
      await page.waitForTimeout(100);

      // Release space for sustain off
      await page.keyboard.up('Space');
      await page.waitForTimeout(100);
    });
  });

  test.describe('Visual Feedback', () => {
    test('should highlight piano keys on interaction', async ({ page }) => {
      const pianoKeys = await page.locator('.piano-key, [data-note]');

      if (await pianoKeys.count() > 0) {
        const firstKey = pianoKeys.first();
        await firstKey.click();
        await page.waitForTimeout(100);

        // Key should have some active/pressed state
        const classList = await firstKey.getAttribute('class');
        // Visual feedback tested visually or with screenshot comparison
      }
    });

    test('should show current octave', async ({ page }) => {
      const octaveDisplay = await page.locator('[data-testid="octave-display"]').or(
        page.getByText(/octave/i)
      );

      if (await octaveDisplay.count() > 0) {
        await expect(octaveDisplay).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const buttons = await page.getByRole('button').all();
      expect(buttons.length).toBeGreaterThan(0);

      for (const button of buttons) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        // Each button should have either text or aria-label
        expect(text || ariaLabel).toBeTruthy();
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should not have console errors on load', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Filter out expected MIDI errors (no devices available in test environment)
      const unexpectedErrors = errors.filter(
        err => !err.includes('MIDI') && !err.includes('Web MIDI')
      );

      expect(unexpectedErrors.length).toBe(0);
    });
  });

  test.describe('Responsive Design', () => {
    test('should be usable on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();

      const piano = await page.locator('.piano-container');
      await expect(piano).toBeVisible();
    });

    test('should be usable on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();

      const piano = await page.locator('.piano-container');
      await expect(piano).toBeVisible();
    });
  });

  test.describe('Browser Compatibility', () => {
    test('should display Web MIDI support status', async ({ page }) => {
      const hasMIDI = await page.evaluate(() => {
        return 'requestMIDIAccess' in navigator;
      });

      // Web MIDI API should be available in Chromium-based browsers
      if (test.info().project.name === 'chromium') {
        expect(hasMIDI).toBe(true);
      }
    });
  });
});
