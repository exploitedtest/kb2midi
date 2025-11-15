/// <reference types="vite/client" />

/**
 * TypeScript declarations for CSS Modules
 * Provides type safety when importing CSS modules
 */

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const content: string;
  export default content;
}

/**
 * Electron API types (if available via preload)
 */
interface ElectronAPI {
  onSystemResume?: (callback: () => void) => void;
  onSystemSuspend?: (callback: () => void) => void;
  onAppFocus?: (callback: () => void) => void;
  onAppBlur?: (callback: () => void) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
