/**
 * Vitest Setup File
 *
 * Runs before all tests to configure the test environment
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupWebMIDIMock, teardownWebMIDIMock } from './mocks/web-midi.mock';

// Install Web MIDI API mock globally
beforeAll(() => {
  setupWebMIDIMock();
});

afterAll(() => {
  teardownWebMIDIMock();
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Mock window.matchMedia (used by some UI components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock performance.now() for consistent timing tests
let mockTime = 0;
const originalPerformanceNow = performance.now.bind(performance);

export function setMockTime(time: number): void {
  mockTime = time;
}

export function advanceMockTime(delta: number): void {
  mockTime += delta;
}

export function resetMockTime(): void {
  mockTime = 0;
}

// Provide a way to use real time when needed
export function useRealTime(): void {
  vi.spyOn(performance, 'now').mockImplementation(originalPerformanceNow);
}

// Provide a way to use mock time
export function useMockTime(): void {
  vi.spyOn(performance, 'now').mockImplementation(() => mockTime);
}
