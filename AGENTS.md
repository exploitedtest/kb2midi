# Repository Guidelines

## Project Structure & Module Organization
- `src/`: strict TypeScript sources (MIDI engine, UI, input, clock, arpeggiator). Key: `main.ts`, `midi-engine.ts`, `ui-controller.ts`.
- `electron/`: Electron wrapper (`main.cjs`, `preload.cjs`).
- App shell: `index.html`, `styles.css`. Assets in `assets/`. Builds in `dist/`; packaged artifacts in `release/`.

## Contribution Priorities
- Prioritize user-facing app features: arpeggiator enhancements (patterns, swing/gate), MIDI robustness (clock sync, hot‑plug), UI/UX polish, and layout options.
- Next, fix bugs that affect MIDI correctness, latency, or stability.
- Packaging/signing (notarization, MAS) and build tooling come after feature/bughunt work.
- Keep patches small and scoped; avoid broad refactors or dependency churn unless essential.

## Architecture Overview
- App boot: `src/main.ts` wires `UIController`, `MidiEngine`, `KeyboardInput`, `ClockSync`, and optional `Arpeggiator`.
- MIDI engine: `src/midi-engine.ts` requests MIDI access, manages ports/channels/velocity, and sends Note On/Off.
- Input: `src/keyboard-input.ts` maps QWERTY keys to notes, sustain, and octave changes.
- Clock: `src/clock-sync.ts` listens to external MIDI clock (tempo, start/stop) and exposes timing events/BPM.
- Arpeggiator: `src/arpeggiator.ts` builds patterns from held notes and schedules steps using clock ticks.
- UI: `src/ui-controller.ts` binds DOM controls, reflects state, and forwards actions to the engine.
- Data flow: keyboard-input → (optional arpeggiator) → midi-engine → MIDI out; clock-sync drives arpeggiator timing.
- Electron: `electron/main.cjs` creates window/tray/menus and loads `http://localhost:8080` in dev or `dist/` in prod.

## Build, Test, and Development Commands
- `npm run dev`: Vite dev server at `http://localhost:8080`.
- `npm run build`: Type-check and build to `dist/` (`tsc && vite build`).
- `npm start` / `npm run preview`: Serve built app.
- `npm run type-check`: Strict TS checks (no emit).
- Electron packaging:
  - macOS DMG: `npm run electron-pack-mac-universal` or `npm run electron-pack-mac-arm64`.
  - MAS: `npm run electron-pack-mas` (universal) or `npm run electron-pack-mas-arm64` (Apple Silicon).
  - Windows: `npm run electron-pack-win`; Linux: `npm run electron-pack-linux`; All: `npm run electron-pack-all`.

## Coding Style & Naming Conventions
- TypeScript (strict). Prefer explicit types; avoid `any`.
- 2-space indent; ~100–120 char soft limit.
- Files: kebab-case; Classes: PascalCase; functions/vars: camelCase.
- Imports: `@/*` → `src/*`. Run `npm run type-check` before PRs; keep diffs focused.

## Testing Guidelines
- No formal test suite; use manual verification:
  - Web: `npm run dev`, connect a virtual MIDI port; verify note on/off, sustain, octave, arpeggiator, clock sync.
  - Electron: `npm run electron-dev`; confirm window/tray, “Always on Top”, MIDI access.
- Use a DAW or MIDI monitor; check browser/Electron consoles for errors.
 - Browser support: Chrome, Safari, Edge (Web MIDI required). Firefox is not supported.

## Commit & Pull Request Guidelines
- Commits: short, imperative, scoped (e.g., `arpeggiator: refine swing timing`).
- PRs: include what/why, testing steps, platforms tested (macOS/Windows/Linux), and screenshots/GIFs for UI changes. Link issues when applicable.

## Security & Configuration Tips
- Web MIDI requires user permission and a virtual MIDI port (see README). Do not commit secrets.
- macOS notarization for non‑MAS builds requires Apple credentials; see `ELECTRON.md` → Notarization.
- Keep dev URLs aligned: Vite `8080`; Electron dev URL in `electron/main.cjs`.
- MAS builds use `bundleVersion: ${version}`; bump `package.json` version for each MAS upload (see README/ELECTRON).
- Lean iterations on cloud runners: prefer `SKIP_ELECTRON_DOWNLOAD=1` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` when binaries
  are unnecessary, and avoid global npm installs—use `npm ci --ignore-scripts` for doc-only edits or lint-only passes.
