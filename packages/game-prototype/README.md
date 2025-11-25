# Game Prototype

A simple TypeScript + Vite game prototype with canvas rendering.

## Features

- TypeScript with strict type checking
- Canvas-based rendering with game loop
- Keyboard input handling (WASD/Arrow keys)
- Hot module reloading during development

## Development

```bash
# From repository root
npm run game:dev

# Or from this directory
npm run dev
```

The game will be available at http://localhost:8081

## Building

```bash
# From repository root
npm run game:build

# Or from this directory
npm run build
```

## Controls

- **WASD** or **Arrow Keys**: Move the player
- Player stays within canvas bounds automatically

## Project Structure

- `src/main.ts` - Main game class with game loop, input handling, and rendering
- `index.html` - HTML entry point with canvas element
- `vite.config.ts` - Vite configuration (port 8081)
- `tsconfig.json` - TypeScript configuration

## Extending the Game

The `Game` class provides a solid foundation:

- `update(_deltaTime)` - Update game logic every frame
- `render()` - Draw to canvas every frame
- `setupInputHandlers()` - Register keyboard/mouse events

Add your game logic in the `update` method and rendering in the `render` method.
