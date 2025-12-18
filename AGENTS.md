# Agent Onboarding Guide

This is a fast ramp-up for AI agents collaborating on kb2midi in a cloud terminal. It blends the README and CLAUDE docs with extra guardrails for day-1 productivity.

## Project Snapshot
- **App:** kb2midi — Web + Electron MIDI controller turning QWERTY input into real MIDI.
- **Stack:** TypeScript + Vite (web), Electron wrapper, Vitest + Playwright tests.
- **Primary entry points:**
  - `src/main.ts` bootstraps `MIDIController` and wires modules.
  - `electron/main.cjs` launches the desktop shell; `electron/preload.cjs` exposes safe IPC.
  - `index.html` + `styles.css` host the Vite app shell.

## Where Things Live
- `src/midi-engine.ts` — Web MIDI access, port selection, note/CC send + receive.
- `src/keyboard-input.ts` — QWERTY mapping, latch mode, modifier handling, layout-aware hotkeys.
- `src/clock-sync.ts` — External MIDI clock handling and BPM event emission.
- `src/arpeggiator.ts` — Patterns, swing/shuffle, ratcheting, humanization, gate/velocity tweaks.
- `src/scale-filter.ts` — Scale definitions, filtering, and piano highlighting.
- `src/ui-controller.ts` — DOM wiring, visual feedback, and state binding.
- `tests/` — Vitest unit suites + Playwright E2E; `tests/mocks/web-midi.mock.ts` is the MIDI mock.
- `electron/` — Desktop main + preload, packaging scripts, and E2E configs.
- Config: `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, `package.json` scripts.

## Day-1 Checklist (cloud shell)
1. Install deps: `npm install` (already vendored `node_modules/` may exist, but refresh if uncertain).
2. Sync with `main` before edits: `git fetch origin && git checkout work && git merge origin/main` (or `git merge main` if main is local).
3. Web dev server: `npm run dev` (Vite on :8080). Preview build: `npm run preview`.
4. Type/compile: `npm run type-check`, `npm run build`.
5. Electron dev: `npm run electron-serve` (starts Vite + Electron). Use `npm run electron-dev` if Vite already running.
6. Tests: unit `npm run test`, watch `npm run test:watch`, coverage `npm run test:coverage`, E2E `npm run test:e2e` or variants in CLAUDE.md.

## Coding Conventions
- TypeScript strict; avoid `any`. Prefer explicit types and `const`.
- 2-space indent; keep lines ~100–120 chars.
- Naming: files kebab-case; classes/interfaces PascalCase; functions/vars camelCase; constants UPPER_SNAKE_CASE.
- Keep diffs focused; avoid sweeping refactors or dependency churn.
- Never wrap imports in try/catch. Handle errors near their source with clear messaging.

## Workflow Priorities
1. User-facing correctness: MIDI stability (clock sync, hot-plug), arpeggiator timing, UI feedback.
2. Bugs affecting MIDI accuracy, latency, or state consistency.
3. Packaging, signing, and tooling improvements after core fixes.

## Testing & Verification
- Unit tests rely on `tests/mocks/web-midi.mock.ts`; see usage in `tests/setup.ts` and CLAUDE.md.
- Manual sanity: run `npm run dev`, connect a virtual MIDI port, verify note on/off, sustain, octave shifts, arpeggiator timing, and clock indicator behavior.
- Electron: `npm run electron-dev`; confirm window creation, tray/menu, MIDI access, suspend/resume handling.
- Browser support: Chrome/Chromium, Safari, Edge. Firefox unsupported (Web MIDI limits).

## Troubleshooting Reminders
- No MIDI? Ensure a virtual port exists and browser granted MIDI permissions.
- Clock issues? Route DAW clock to the selected clock port and verify the in-app selector.
- Arp silent? Enable the arpeggiator toggle, hold notes, ensure clock is running and beat indicator is active.
- No sound overall? kb2midi outputs MIDI only—load an instrument in the DAW and match channels.

## Git & PR Hygiene
- Branch: work off `work`, but merge `main` first to avoid conflicts.
- Commits: short, imperative (e.g., `arp: fix swing timing clamp`).
- Before committing: run relevant checks (`npm run type-check`, targeted tests/E2E if affected). Keep patches small and reviewable.
- PR message: state what/why and testing performed; include platform info and screenshots/GIFs for UI changes when applicable.

