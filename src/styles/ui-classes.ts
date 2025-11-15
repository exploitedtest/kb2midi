/**
 * UI Classes Helper
 * Centralized CSS class management for the application
 * Provides type-safe access to CSS module classes
 */

import layoutStyles from './layout.module.css';
import controlsStyles from './controls.module.css';
import pianoStyles from './piano.module.css';
import particlesStyles from './particles.module.css';

/**
 * Export all CSS module styles for use throughout the app
 */
export const styles = {
  layout: layoutStyles,
  controls: controlsStyles,
  piano: pianoStyles,
  particles: particlesStyles,
};

/**
 * Helper function to combine class names
 * @param classes - Array of class names or undefined values
 * @returns Combined class string
 */
export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Helper to toggle a class on an element
 * @param element - The DOM element
 * @param className - The class name to toggle
 * @param condition - Whether to add or remove the class
 */
export function toggleClass(
  element: HTMLElement | null,
  className: string,
  condition: boolean
): void {
  if (!element) return;

  if (condition) {
    element.classList.add(className);
  } else {
    element.classList.remove(className);
  }
}

/**
 * Apply CSS module classes to an element
 * @param element - The DOM element
 * @param classes - Array of class names from CSS modules
 */
export function applyClasses(
  element: HTMLElement | null,
  ...classes: (string | undefined | null | false)[]
): void {
  if (!element) return;
  element.className = classNames(...classes);
}

/**
 * CSS module class getters for common components
 */
export const uiClasses = {
  // Layout classes
  header: () => styles.layout.header,
  status: (state?: 'connected' | 'error' | 'info' | 'success') =>
    classNames(
      styles.layout.status,
      state && styles.layout[state]
    ),
  clockStatus: (state?: 'synced' | 'free' | 'stopped') =>
    classNames(
      styles.layout.clockStatus,
      state && styles.layout[state]
    ),
  beatIndicator: (pulse?: boolean) =>
    classNames(
      styles.layout.beatIndicator,
      pulse && styles.layout.pulse
    ),
  octaveDisplay: () => styles.layout.octaveDisplay,
  instructions: () => styles.layout.instructions,
  instructionBox: () => styles.layout.instructionBox,

  // Control classes
  controls: () => styles.controls.controls,
  controlGroup: () => styles.controls.controlGroup,
  button: (variant?: 'primary' | 'danger', pressed?: boolean) =>
    classNames(
      styles.controls.button,
      variant && styles.controls[variant],
      pressed && styles.controls.pressed
    ),
  wheelIndicator: (active?: boolean) =>
    classNames(
      styles.controls.wheelIndicator,
      active && styles.controls.active
    ),
  arpeggiatorControls: () => styles.controls.arpeggiatorControls,

  // Piano classes
  pianoContainer: () => styles.piano.pianoContainer,
  piano: () => styles.piano.piano,
  pianoRow: (position?: 'top' | 'bottom') =>
    classNames(
      styles.piano.pianoRow,
      position === 'top' && styles.piano.topRow,
      position === 'bottom' && styles.piano.bottomRow
    ),
  key: (type: 'white' | 'black', active?: boolean) =>
    classNames(
      styles.piano.key,
      type === 'white' ? styles.piano.whiteKey : styles.piano.blackKey,
      active && styles.piano.active
    ),
  keyLabel: (type: 'white' | 'black') =>
    type === 'white' ? styles.piano.keyLabel : styles.piano.blackKeyLabel,
  keyboardMapping: () => styles.piano.keyboardMapping,
  keyboardRow: () => styles.piano.keyboardRow,
  keyboardWrapper: () => styles.piano.keyboardWrapper,
  kbKey: (bg?: 'white' | 'black' | 'control', wide?: boolean, active?: boolean) =>
    classNames(
      styles.piano.kbKey,
      bg === 'white' && styles.piano.whiteBg,
      bg === 'black' && styles.piano.blackBg,
      bg === 'control' && styles.piano.controlKey,
      wide && styles.piano.wide,
      active && styles.piano.active
    ),

  // Particle classes
  particleCanvas: () => styles.particles.particleCanvas,
};

/**
 * Export individual module styles for direct access if needed
 */
export { layoutStyles, controlsStyles, pianoStyles, particlesStyles };
