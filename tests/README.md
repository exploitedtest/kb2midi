# kb2midi Testing Documentation

This document provides comprehensive guidance on testing the kb2midi application.

## Table of Contents

- [Overview](#overview)
- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)

## Overview

kb2midi uses a comprehensive testing strategy combining:

- **Vitest** for unit testing
- **Playwright** for end-to-end (E2E) testing (web and Electron)
- **Web MIDI API Mocks** for testing without hardware

### Test Statistics

- **Unit Tests**: 100+ test cases
- **E2E Tests**: 40+ test scenarios
- **Code Coverage Target**: 80%+

## Test Architecture

### Directory Structure

```
tests/
├── unit/                   # Unit tests for individual modules
│   ├── midi-engine.test.ts
│   ├── clock-sync.test.ts
│   ├── arpeggiator.test.ts
│   └── keyboard-input.test.ts
├── e2e/                    # End-to-end tests
│   ├── web-app.test.ts     # Browser-based E2E tests
│   └── electron.test.ts    # Electron desktop app tests
├── mocks/                  # Test mocks and fixtures
│   └── web-midi.mock.ts    # Comprehensive Web MIDI API mock
└── setup.ts                # Global test setup
```

### Testing Stack

| Layer | Framework | Purpose |
|-------|-----------|---------|
| Unit Testing | Vitest | Fast, isolated module testing |
| E2E Testing (Web) | Playwright | Browser compatibility testing |
| E2E Testing (Electron) | Playwright for Electron | Desktop app integration testing |
| Mocking | Custom Mocks | Web MIDI API simulation |
| Coverage | V8 | Code coverage reporting |

## Running Tests

### Quick Start

```bash
# Run all unit tests
npm test

# Run unit tests in watch mode
npm run test:watch

# Run unit tests with UI
npm run test:ui

# Run all E2E tests
npm run test:e2e

# Run everything
npm run test:all
```

### Unit Tests

```bash
# Run once
npm test

# Watch mode (recommended for development)
npm run test:watch

# With coverage
npm run test:coverage

# With UI dashboard
npm run test:ui
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode (pause on breakpoints)
npm run test:e2e:debug

# Run specific browser
npm run test:e2e:chromium
npm run test:e2e:webkit

# Run Electron tests only
npm run test:e2e:electron
```

### Continuous Integration

```bash
# Recommended CI command
npm run type-check && npm run test:all
```

## Test Coverage

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html  # macOS
start coverage/index.html # Windows
xdg-open coverage/index.html # Linux
```

### Coverage Targets

| Module | Target | Current |
|--------|--------|---------|
| midi-engine.ts | 90% | ✓ |
| clock-sync.ts | 95% | ✓ |
| arpeggiator.ts | 85% | ✓ |
| keyboard-input.ts | 90% | ✓ |
| **Overall** | **80%** | **✓** |

## Test Suites

### 1. MIDI Engine Tests (`midi-engine.test.ts`)

**Coverage**: MIDI communication, device management, message validation

**Key Test Cases**:
- MIDI access initialization
- Device auto-selection (IAC Driver preference)
- Note playback (note on/off)
- Control changes (CC, pitch bend, program change)
- Sustain pedal handling
- MIDI panic (all notes off)
- Input/output hot-plug detection
- Clock message handling
- Validation (note, velocity, channel ranges)

**Example**:
```typescript
test('should play a note', () => {
  midiEngine.playNote(60, 100, 1);

  const messages = output.getSentMessages();
  expect(messages[0]).toEqual([0x90, 60, 100]);
});
```

### 2. Clock Sync Tests (`clock-sync.test.ts`)

**Coverage**: MIDI clock synchronization, BPM calculation, timing events

**Key Test Cases**:
- MIDI start/stop/continue messages
- Clock tick processing
- BPM calculation with rolling average
- Quarter note and sixteenth note events
- Auto-stop timeout (500ms)
- Duplicate tick filtering (< 3ms)
- Tempo change detection
- Callback management

**Example**:
```typescript
test('should calculate BPM from tick intervals', () => {
  let time = 0;
  for (let i = 0; i < 10; i++) {
    clockSync.onMIDIClockTick(time);
    time += 20.83; // 120 BPM intervals
  }

  expect(clockSync.getBPM()).toBeCloseTo(120, 0);
});
```

### 3. Arpeggiator Tests (`arpeggiator.test.ts`)

**Coverage**: Arpeggiator patterns, timing strategies, generative features

**Key Test Cases**:

**Basic Patterns**:
- Up, Down, Up-Down, Down-Up, Random, Chord
- Octave range (1-4 octaves)
- Note addition/removal with press order preservation
- Clock synchronization with different divisions

**Timing Strategies** (NEW):
- Straight Timing (mechanical precision)
- Swing Timing (50% delay on offbeats)
- Shuffle Timing (66.67% triplet feel)
- Dotted Timing (75% dotted eighth feel)
- Humanize Timing (tempo-adaptive ±15ms variation)
- Layered Timing (combined strategies)

**Generative Features** (NEW):
- Velocity Humanization (±10 velocity variation)
- Accent Patterns (downbeats, offbeats, every-3rd)
- Gate Probability (0-100% note skip chance)
- Ratcheting (2x/3x/4x note repeats)
- Latch Mode (toggle notes on/off)

**Example**:
```typescript
test('should apply swing timing to playback', () => {
  const swing = new SwingTiming(1.0);

  // Even steps: no delay
  expect(swing.getDelayOffset(0, 100)).toBe(0);

  // Odd steps: 50% delay
  expect(swing.getDelayOffset(1, 100)).toBe(50);
});
```

### 4. Keyboard Input Tests (`keyboard-input.test.ts`)

**Coverage**: Keyboard event handling, layout management, latch mode

**Key Test Cases**:
- Simple and Expanded layout mapping
- Note on/off event handling
- Velocity control (default + shift key boost)
- Special keys (octave, sustain, mod wheel, pitch bend)
- Latch mode (toggle behavior)
- Modifier key filtering (Ctrl, Alt, Meta)
- Input field filtering (ignore typing in inputs)
- Pressed key tracking

**Example**:
```typescript
test('should use maximum velocity when shift key pressed', () => {
  const event = new KeyboardEvent('keydown', {
    code: 'KeyZ',
    shiftKey: true,
    bubbles: true
  });

  document.dispatchEvent(event);
  expect(noteOnHandler).toHaveBeenCalledWith(127);
});
```

### 5. Web E2E Tests (`web-app.test.ts`)

**Coverage**: Complete application flow in browser

**Key Test Cases**:
- Application initialization and loading
- Piano interface visibility
- MIDI control availability
- Arpeggiator UI controls (all generative features)
- Keyboard layout switching
- Clock sync indicators (BPM, beat display)
- Panic button functionality
- Visual feedback on interactions
- Accessibility (ARIA labels, keyboard navigation)
- Performance (load time, console errors)
- Responsive design (desktop, tablet)

### 6. Electron E2E Tests (`electron.test.ts`)

**Coverage**: Desktop application integration

**Key Test Cases**:
- Application launch and window creation
- Window management (resize, dimensions)
- System integration (suspend/resume, focus/blur)
- Web MIDI API availability in Electron
- Keyboard input handling
- Performance (startup time, memory leaks)
- Desktop features ("Always on Top")
- Error handling (missing MIDI devices, invalid input)
- Cross-platform compatibility

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { YourModule } from '@/your-module';

describe('YourModule', () => {
  let instance: YourModule;

  beforeEach(() => {
    instance = new YourModule();
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = instance.method(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Group', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display expected element', async ({ page }) => {
    const element = await page.locator('[data-testid="element"]');
    await expect(element).toBeVisible();
  });
});
```

### Best Practices

1. **Test Naming**: Use descriptive names starting with "should"
2. **AAA Pattern**: Arrange, Act, Assert
3. **Isolation**: Each test should be independent
4. **Mocking**: Use mocks for external dependencies
5. **Coverage**: Aim for edge cases, not just happy paths
6. **Performance**: Keep unit tests fast (< 100ms each)

### Using Web MIDI Mocks

```typescript
import { MockMIDIAccess, MockMIDIInput, MockMIDIOutput } from '../mocks/web-midi.mock';

test('should handle MIDI input', async () => {
  const mockAccess = await navigator.requestMIDIAccess() as MockMIDIAccess;
  const input = mockAccess.addInput('test-1', 'Test Input');

  // Simulate MIDI message
  input.simulateMessage([0x90, 60, 100]); // Note On
});
```

## Troubleshooting

### Common Issues

#### "Cannot find module '@/...'"

**Solution**: Path alias not configured. Ensure `vite.config.ts` has:

```typescript
resolve: {
  alias: {
    '@': resolve(__dirname, './src')
  }
}
```

#### "Web MIDI API not supported"

**Solution**: This is expected in test environments. Web MIDI mocks handle this automatically.

#### Playwright tests hanging

**Solution**:
```bash
# Ensure dev server is running
npm run build && npm run preview

# Or use webServer in playwright.config.ts (already configured)
```

#### Coverage reports missing files

**Solution**: Check `coverage.exclude` in `vite.config.ts`:

```typescript
test: {
  coverage: {
    exclude: ['node_modules/', 'tests/', 'dist/']
  }
}
```

### Debugging Tests

#### Unit Tests

```bash
# Run single test file
npx vitest midi-engine.test.ts

# Run with specific pattern
npx vitest --grep "should play a note"

# Debug in VS Code
# Add breakpoint and run "JavaScript Debug Terminal"
```

#### E2E Tests

```bash
# Debug mode (pauses on failures)
npm run test:e2e:debug

# Headed mode (see browser)
npm run test:e2e:headed

# Trace on failures
# Check test-results/ for trace files
```

### CI/CD Integration

#### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run type-check
      - run: npm run test:coverage
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## Test Maintenance

### Adding New Tests

1. **Unit Test**: Create `tests/unit/module-name.test.ts`
2. **E2E Test**: Add scenarios to `tests/e2e/web-app.test.ts` or `electron.test.ts`
3. **Mock**: Extend `tests/mocks/web-midi.mock.ts` if needed
4. **Run**: `npm test` and ensure passing
5. **Coverage**: `npm run test:coverage` and verify coverage

### Updating Existing Tests

1. **Locate Test**: Find test file in `tests/unit/` or `tests/e2e/`
2. **Modify**: Update test cases as needed
3. **Verify**: Run specific test file
4. **Document**: Update this README if architecture changes

### Test Review Checklist

- [ ] All tests passing (`npm test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Code coverage > 80% (`npm run test:coverage`)
- [ ] Type checking passing (`npm run type-check`)
- [ ] No console errors in E2E tests
- [ ] Tests are isolated and deterministic
- [ ] Mock usage is appropriate
- [ ] Test names are descriptive

## Performance Benchmarks

### Unit Tests

- **Total Tests**: ~100+
- **Execution Time**: < 5 seconds
- **Average per Test**: < 50ms

### E2E Tests

- **Total Tests**: ~40+
- **Execution Time**: < 2 minutes (Chromium + WebKit)
- **Average per Test**: ~3 seconds

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Web MIDI API Specification](https://www.w3.org/TR/webmidi/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles/)

## Contributing

When contributing tests:

1. Follow existing test patterns
2. Maintain 80%+ code coverage
3. Ensure tests are fast and deterministic
4. Document complex test scenarios
5. Update this README if adding new test categories

---

**Last Updated**: 2025-11-15
**Test Framework Versions**: Vitest 4.0.9, Playwright 1.56.1
