/**
 * Game Prototype - Main Entry Point
 */

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private running: boolean = false;
  private lastTime: number = 0;

  // Example game state
  private playerX: number = 400;
  private playerY: number = 300;
  private playerSize: number = 20;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    this.setupInputHandlers();
  }

  private setupInputHandlers(): void {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      const speed = 5;
      switch(e.key) {
        case 'ArrowLeft':
        case 'a':
          this.playerX -= speed;
          break;
        case 'ArrowRight':
        case 'd':
          this.playerX += speed;
          break;
        case 'ArrowUp':
        case 'w':
          this.playerY -= speed;
          break;
        case 'ArrowDown':
        case 's':
          this.playerY += speed;
          break;
      }

      // Keep player in bounds
      this.playerX = Math.max(this.playerSize, Math.min(this.canvas.width - this.playerSize, this.playerX));
      this.playerY = Math.max(this.playerSize, Math.min(this.canvas.height - this.playerSize, this.playerY));
    });
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  public stop(): void {
    this.running = false;
  }

  private gameLoop(currentTime: number): void {
    if (!this.running) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame((time) => this.gameLoop(time));
  }

  private update(_deltaTime: number): void {
    // Update game logic here
    // _deltaTime is in milliseconds (prefixed with _ to indicate intentionally unused)
  }

  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw player
    this.ctx.fillStyle = '#00ff00';
    this.ctx.fillRect(
      this.playerX - this.playerSize / 2,
      this.playerY - this.playerSize / 2,
      this.playerSize,
      this.playerSize
    );

    // Draw instructions
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px monospace';
    this.ctx.fillText('Use WASD or Arrow Keys to move', 10, 20);
  }
}

// Initialize and start the game
const game = new Game('game-canvas');
game.start();

console.log('Game prototype initialized');
