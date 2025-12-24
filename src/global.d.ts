export {}; // Ensure this file is treated as a module

declare global {
  interface Window {
    electronAPI?: {
      platform?: string;
      isDev?: boolean;
      versions?: { node: string; chrome: string; electron: string };
      getSystemTheme?: () => Promise<'light' | 'dark'>;
      onThemeChange?: (callback: (theme: 'light' | 'dark') => void) => void;
      onSystemResume?: (callback: () => void) => void;
      onSystemSuspend?: (callback: () => void) => void;
      onAppFocus?: (callback: () => void) => void;
      onAppBlur?: (callback: () => void) => void;
    };
  }
}
