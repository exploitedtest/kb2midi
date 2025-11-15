/**
 * Particle Engine for visual effects when notes are played
 * Inspired by Rousseau-style piano visualizations
 * Mobile-optimized with performance considerations
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  velocity: number;
}

export class ParticleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private animationFrameId: number | null = null;
  private pianoElement: HTMLElement | null = null;

  // Color palette inspired by Rousseau (rainbow gradient based on pitch)
  private colorPalette = [
    '#FF6B6B', // Red (low notes)
    '#FF8E53',
    '#FFC93C',
    '#FFE66D',
    '#95E1D3', // Cyan
    '#5DADE2',
    '#A569BD', // Purple
    '#EC7063',
    '#F8B500',
    '#48C9B0',
    '#5499C7',
    '#BB8FCE'  // High notes
  ];

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;

    // Set canvas size to match window
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Get reference to piano element for positioning
    this.pianoElement = document.getElementById('piano');

    // Start animation loop
    this.start();
  }

  /**
   * Resize canvas to match window dimensions
   */
  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Get color based on MIDI note number (0-127)
   * Creates a rainbow gradient from low to high notes
   */
  private getNoteColor(note: number): string {
    const index = Math.floor((note / 127) * (this.colorPalette.length - 1));
    return this.colorPalette[Math.min(index, this.colorPalette.length - 1)];
  }

  /**
   * Get position on screen for a given MIDI note
   * Calculates x position based on piano key location
   */
  private getNotePosition(note: number): { x: number; y: number } {
    if (!this.pianoElement) {
      // Fallback to horizontal distribution if piano not found
      const x = (note / 127) * this.canvas.width;
      return { x, y: this.canvas.height * 0.7 };
    }

    // Find the piano key element for this note
    const keyElement = this.pianoElement.querySelector(`[data-note="${note}"]`) as HTMLElement;

    if (keyElement) {
      const rect = keyElement.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top
      };
    }

    // Fallback if specific key not found
    const pianoRect = this.pianoElement.getBoundingClientRect();
    return {
      x: pianoRect.left + pianoRect.width / 2,
      y: pianoRect.top
    };
  }

  /**
   * Spawn particles for a note hit
   * @param note - MIDI note number (0-127)
   * @param velocity - MIDI velocity (0-127)
   */
  public spawnParticles(note: number, velocity: number): void {
    const position = this.getNotePosition(note);
    const color = this.getNoteColor(note);

    // Number of particles based on velocity
    const particleCount = Math.floor(5 + (velocity / 127) * 15); // 5-20 particles

    for (let i = 0; i < particleCount; i++) {
      // Spread particles horizontally around the key
      const spread = 30;
      const angle = (Math.random() - 0.5) * Math.PI * 0.5; // Upward cone
      const speed = 2 + (velocity / 127) * 4; // 2-6 pixels per frame

      this.particles.push({
        x: position.x + (Math.random() - 0.5) * spread,
        y: position.y,
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * speed - 2, // Upward bias
        life: 1.0,
        maxLife: 60 + Math.random() * 60, // 60-120 frames
        size: 2 + (velocity / 127) * 4, // 2-6 pixels
        color: color,
        velocity: velocity
      });
    }
  }

  /**
   * Update all particles
   */
  private update(): void {
    // Update each particle
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Apply gravity (subtle)
      p.vy += 0.05;

      // Apply air resistance
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Decrease life
      p.maxLife--;
      p.life = p.maxLife / (60 + 60); // Normalize to 0-1

      // Remove dead particles
      if (p.maxLife <= 0 || p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  /**
   * Render all particles to canvas
   */
  private render(): void {
    // Clear canvas with slight fade for trail effect
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw each particle
    this.particles.forEach(p => {
      this.ctx.save();

      // Set particle color with opacity based on life
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;

      // Add glow effect
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;

      // Draw particle as circle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    this.update();
    this.render();
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Start the particle engine
   */
  public start(): void {
    if (this.animationFrameId === null) {
      this.animate();
    }
  }

  /**
   * Stop the particle engine
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Clear all particles
   */
  public clear(): void {
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stop();
    this.clear();
    window.removeEventListener('resize', () => this.resizeCanvas());
  }
}
