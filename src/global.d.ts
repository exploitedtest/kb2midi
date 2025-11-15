export {}; // Ensure this file is treated as a module

declare global {
  interface Window {
    // Legacy Electron API (deprecated, kept for backwards compatibility)
    electronAPI?: {
      platform?: string;
      isDev?: boolean;
      versions?: { node: string; chrome: string; electron: string };
      onSystemResume?: (callback: () => void) => void;
      onSystemSuspend?: (callback: () => void) => void;
      onAppFocus?: (callback: () => void) => void;
      onAppBlur?: (callback: () => void) => void;
    };
    // Tauri API types are provided by @tauri-apps/api package
  }
}

