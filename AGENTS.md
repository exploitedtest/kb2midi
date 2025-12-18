# Agent Onboarding Guide

This guide is for AI agents working in this repository. It blends the README/CLAUDE guidance with actionable steps for a cloud terminal environment so you can ramp up quickly.

## Project Snapshot
- **App:** kb2midi — web + Electron MIDI controller turning QWERTY input into real MIDI output.
- **Primary Stack:** TypeScript + Vite front end (`src/`), Electron wrapper (`electron/`), tests with Vitest/Playwright.
- **Entry Points:** `src/main.ts` wires UI + MIDI modules; `electron/main.cjs` boots the desktop shell; `index.html` + `styles.css` are the static shell.

## Where Things Live
- `src/` core logic:
  - `midi-engine.ts` MIDI I/O, device selection, message send/receive.
  - `keyboard-input.ts` QWERTY mapping, latch, modifiers.
  - `clock-sync.ts` external clock handling and BPM events.
  - `arpeggiator.ts` patterns, swing/shuffle, humanization, ratcheting.
  - `scale-filter.ts` scale definitions and note filtering.
  - `ui-controller.ts` DOM wiring and visual feedback.
- `tests/` Vitest unit tests + Playwright E2E; `tests/mocks/web-midi.mock.ts` is the MIDI mock.
- `electron/` desktop main + preload.
- Build configs: `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`.

## Fast Start (cloud shell)
1. `npm install`
2. Web dev server: `npm run dev` (Vite on :8080).
3. Type checks/build: `npm run type-check`, `npm run build`.
4. Electron dev: `npm run electron-serve` (starts Vite + Electron). Use `npm run electron-dev` if Vite already running.
5. Tests:
   - Unit: `npm run test`, watch: `npm run test:watch`.
   - Coverage: `npm run test:coverage`.
   - E2E: `npm run test:e2e` (headless), variants in CLAUDE.md.

## Coding Conventions
- TypeScript strict, avoid `any`; prefer explicit types and `const`.
- 2-space indent; ~100–120 char soft wrap.
- Files kebab-case; classes/interfaces PascalCase; functions/vars camelCase; constants UPPER_SNAKE_CASE.
- No try/catch wrapping imports. Keep diffs focused; avoid sweeping refactors or dependency churn.

## Feature Priorities
1. User-facing functionality: arpeggiator improvements, MIDI robustness (clock sync, hot-plug), UI polish/layouts.
2. Bug fixes affecting MIDI correctness, latency, or stability.
3. Packaging/signing and tooling follow after core feature/bug work.

## Testing & Verification Tips
- Use the Web MIDI mock for unit tests; see `tests/mocks/web-midi.mock.ts` usage examples in CLAUDE.md.
- Manual sanity: run `npm run dev`, connect a virtual MIDI port, verify note on/off, sustain, octave shifts, arpeggiator timing, clock sync indicators.
- For Electron: `npm run electron-dev`; check window creation, tray/menu, Always on Top, MIDI access.
- Supported browsers: Chrome/Chromium, Safari, Edge. Firefox not supported (Web MIDI limits).

## Git & PR Hygiene
- Commits: short, imperative, scoped (e.g., `arp: smooth swing timing`).
- Before committing: run relevant checks (`npm run type-check`, targeted tests). Keep patches small and reviewable.
- PR message should state what/why and testing performed; include platform info and screenshots/GIFs for UI changes.

## Cloud-Agent Workflow Hints
- Stay within repo root; instructions apply globally (no nested AGENTS files).
- Use `rg` for search (avoid `ls -R`/`grep -R`).
- Keep environment noise low: avoid installing heavy deps unless required.
- When editing styles or UI, consider Playwright screenshot if change is visual (see system instructions).
- Do not commit secrets; keep dev URLs aligned (Vite/Electron expect :8080).

## Troubleshooting Reminders
- No MIDI? ensure virtual port exists and browser allowed MIDI permission.
- Clock issues? verify DAW clock routed to same port and selected in-app.
- Arp silent? enable toggle, hold notes, ensure clock running and beat indicator green.
- No sound overall? kb2midi outputs MIDI only—load an instrument in the DAW and match channels.
