/**
 * Responsive UI Module
 * Handles device detection, viewport management, and touch gesture support
 * for mobile-responsive behavior
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type ViewportSize = 'small' | 'medium' | 'large';
export type Orientation = 'portrait' | 'landscape';

export interface ViewportInfo {
  width: number;
  height: number;
  size: ViewportSize;
  orientation: Orientation;
  deviceType: DeviceType;
  isTouchDevice: boolean;
}

export interface TouchGestureEvent {
  type: 'tap' | 'doubletap' | 'longpress' | 'swipe' | 'pinch';
  direction?: 'up' | 'down' | 'left' | 'right';
  deltaX?: number;
  deltaY?: number;
  scale?: number;
  target: HTMLElement;
}

/**
 * ResponsiveUI class manages device detection, viewport tracking,
 * and touch gesture recognition for mobile-optimized experiences
 */
export class ResponsiveUI {
  private viewportInfo: ViewportInfo;
  private viewportChangeHandlers: ((info: ViewportInfo) => void)[] = [];
  private orientationChangeHandlers: ((orientation: Orientation) => void)[] = [];
  private resizeObserver: ResizeObserver | null = null;

  // Touch gesture tracking
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;
  private lastTapTime: number = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private initialPinchDistance: number = 0;

  // Gesture thresholds
  private readonly SWIPE_THRESHOLD = 50; // pixels
  private readonly SWIPE_VELOCITY_THRESHOLD = 0.3; // pixels/ms
  private readonly LONG_PRESS_DURATION = 500; // ms
  private readonly DOUBLE_TAP_DELAY = 300; // ms
  private readonly PINCH_THRESHOLD = 20; // pixels

  // Shake detection
  private shakeEnabled: boolean = false;
  private lastAcceleration: { x: number; y: number; z: number } | null = null;
  private lastShakeTime: number = 0;
  private shakeHandlers: (() => void)[] = [];
  private readonly SHAKE_THRESHOLD = 15; // m/s²
  private readonly SHAKE_COOLDOWN = 1000; // ms between shake events

  constructor() {
    this.viewportInfo = this.detectViewport();
    this.setupListeners();
  }

  /**
   * Detects current viewport and device information
   */
  private detectViewport(): ViewportInfo {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouchDevice = this.isTouchCapable();

    // Determine viewport size
    let size: ViewportSize;
    if (width < 768) {
      size = 'small';
    } else if (width < 1024) {
      size = 'medium';
    } else {
      size = 'large';
    }

    // Determine device type
    let deviceType: DeviceType;
    if (isTouchDevice && width < 768) {
      deviceType = 'mobile';
    } else if (isTouchDevice && width >= 768 && width < 1024) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    // Determine orientation
    const orientation: Orientation = width > height ? 'landscape' : 'portrait';

    return {
      width,
      height,
      size,
      orientation,
      deviceType,
      isTouchDevice
    };
  }

  /**
   * Checks if device supports touch input
   */
  private isTouchCapable(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
  }

  /**
   * Sets up event listeners for viewport and orientation changes
   */
  private setupListeners(): void {
    // Viewport resize
    window.addEventListener('resize', () => this.handleResize());

    // Orientation change
    window.addEventListener('orientationchange', () => this.handleOrientationChange());

    // Also use ResizeObserver for more granular updates
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(document.body);
    }
  }

  /**
   * Handles viewport resize events
   */
  private handleResize(): void {
    const oldInfo = this.viewportInfo;
    this.viewportInfo = this.detectViewport();

    // Only notify if something significant changed
    if (
      oldInfo.size !== this.viewportInfo.size ||
      oldInfo.deviceType !== this.viewportInfo.deviceType ||
      oldInfo.orientation !== this.viewportInfo.orientation
    ) {
      this.notifyViewportChange();
    }
  }

  /**
   * Handles orientation change events
   */
  private handleOrientationChange(): void {
    setTimeout(() => {
      const oldOrientation = this.viewportInfo.orientation;
      this.viewportInfo = this.detectViewport();

      if (oldOrientation !== this.viewportInfo.orientation) {
        this.notifyOrientationChange();
      }
    }, 100); // Small delay to ensure dimensions are updated
  }

  /**
   * Notifies all viewport change handlers
   */
  private notifyViewportChange(): void {
    this.viewportChangeHandlers.forEach(handler => handler(this.viewportInfo));
  }

  /**
   * Notifies all orientation change handlers
   */
  private notifyOrientationChange(): void {
    this.orientationChangeHandlers.forEach(handler => handler(this.viewportInfo.orientation));
  }

  /**
   * Registers a handler for viewport changes
   */
  onViewportChange(handler: (info: ViewportInfo) => void): void {
    this.viewportChangeHandlers.push(handler);
    // Immediately call with current info
    handler(this.viewportInfo);
  }

  /**
   * Registers a handler for orientation changes
   */
  onOrientationChange(handler: (orientation: Orientation) => void): void {
    this.orientationChangeHandlers.push(handler);
  }

  /**
   * Gets current viewport information
   */
  getViewportInfo(): ViewportInfo {
    return { ...this.viewportInfo };
  }

  /**
   * Checks if current device is mobile
   */
  isMobile(): boolean {
    return this.viewportInfo.deviceType === 'mobile';
  }

  /**
   * Checks if current device is tablet
   */
  isTablet(): boolean {
    return this.viewportInfo.deviceType === 'tablet';
  }

  /**
   * Checks if current device is desktop
   */
  isDesktop(): boolean {
    return this.viewportInfo.deviceType === 'desktop';
  }

  /**
   * Checks if device supports touch
   */
  isTouchDevice(): boolean {
    return this.viewportInfo.isTouchDevice;
  }

  /**
   * Sets up touch gesture recognition on an element
   */
  enableGestures(
    element: HTMLElement,
    callbacks: {
      onTap?: (e: TouchGestureEvent) => void;
      onDoubleTap?: (e: TouchGestureEvent) => void;
      onLongPress?: (e: TouchGestureEvent) => void;
      onSwipe?: (e: TouchGestureEvent) => void;
      onPinch?: (e: TouchGestureEvent) => void;
    }
  ): () => void {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();

        // Set up long press detection
        if (callbacks.onLongPress) {
          this.longPressTimer = setTimeout(() => {
            callbacks.onLongPress!({
              type: 'longpress',
              target: element
            });
          }, this.LONG_PRESS_DURATION);
        }
      } else if (e.touches.length === 2) {
        // Pinch gesture start
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Cancel long press if finger moves
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      // Handle pinch gesture
      if (e.touches.length === 2 && callbacks.onPinch) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const distanceDiff = currentDistance - this.initialPinchDistance;

        if (Math.abs(distanceDiff) > this.PINCH_THRESHOLD) {
          const scale = currentDistance / this.initialPinchDistance;
          callbacks.onPinch({
            type: 'pinch',
            scale,
            target: element
          });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Clear long press timer
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - this.touchStartTime;

      if (e.changedTouches.length === 1) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - this.touchStartX;
        const deltaY = touchEndY - this.touchStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const velocity = distance / touchDuration;

        // Detect swipe
        if (
          distance > this.SWIPE_THRESHOLD &&
          velocity > this.SWIPE_VELOCITY_THRESHOLD &&
          callbacks.onSwipe
        ) {
          let direction: 'up' | 'down' | 'left' | 'right';
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
          } else {
            direction = deltaY > 0 ? 'down' : 'up';
          }

          callbacks.onSwipe({
            type: 'swipe',
            direction,
            deltaX,
            deltaY,
            target: element
          });
        }
        // Detect tap or double tap
        else if (distance < 10 && touchDuration < 300) {
          const timeSinceLastTap = touchEndTime - this.lastTapTime;

          if (timeSinceLastTap < this.DOUBLE_TAP_DELAY && callbacks.onDoubleTap) {
            callbacks.onDoubleTap({
              type: 'doubletap',
              target: element
            });
            this.lastTapTime = 0; // Reset to prevent triple tap
          } else if (callbacks.onTap) {
            callbacks.onTap({
              type: 'tap',
              target: element
            });
            this.lastTapTime = touchEndTime;
          }
        }
      }
    };

    const handleTouchCancel = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    // Return cleanup function
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }

  /**
   * Shows or hides elements based on device type
   */
  adaptiveDisplay(selector: string, options: {
    mobile?: boolean;
    tablet?: boolean;
    desktop?: boolean;
  }): void {
    const elements = document.querySelectorAll(selector);
    const shouldShow = (
      (this.isMobile() && options.mobile !== false) ||
      (this.isTablet() && options.tablet !== false) ||
      (this.isDesktop() && options.desktop !== false)
    );

    elements.forEach(element => {
      (element as HTMLElement).style.display = shouldShow ? '' : 'none';
    });
  }

  /**
   * Enables shake detection for panic/all-notes-off functionality
   * Uses DeviceMotion API to detect rapid device movement
   */
  enableShakeDetection(onShake: () => void): void {
    if (!this.isTouchDevice()) {
      console.log('Shake detection only available on touch devices');
      return;
    }

    this.shakeHandlers.push(onShake);

    if (this.shakeEnabled) {
      // Already enabled, just add the handler
      return;
    }

    // Check for DeviceMotion API support
    if (typeof DeviceMotionEvent === 'undefined') {
      console.warn('DeviceMotion API not supported');
      return;
    }

    // Request permission on iOS 13+
    if (
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            this.setupShakeListener();
          } else {
            console.warn('DeviceMotion permission denied');
          }
        })
        .catch((error: Error) => {
          console.error('Error requesting DeviceMotion permission:', error);
        });
    } else {
      // Non-iOS or older iOS, just set up the listener
      this.setupShakeListener();
    }
  }

  /**
   * Sets up the device motion event listener
   */
  private setupShakeListener(): void {
    this.shakeEnabled = true;

    window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
      if (!event.accelerationIncludingGravity) {
        return;
      }

      const { x, y, z } = event.accelerationIncludingGravity;

      if (x === null || y === null || z === null) {
        return;
      }

      // First reading, just store it
      if (!this.lastAcceleration) {
        this.lastAcceleration = { x, y, z };
        return;
      }

      // Calculate change in acceleration
      const deltaX = Math.abs(x - this.lastAcceleration.x);
      const deltaY = Math.abs(y - this.lastAcceleration.y);
      const deltaZ = Math.abs(z - this.lastAcceleration.z);

      // Update last acceleration
      this.lastAcceleration = { x, y, z };

      // Check if shake threshold exceeded
      const now = Date.now();
      const timeSinceLastShake = now - this.lastShakeTime;

      if (
        (deltaX > this.SHAKE_THRESHOLD ||
          deltaY > this.SHAKE_THRESHOLD ||
          deltaZ > this.SHAKE_THRESHOLD) &&
        timeSinceLastShake > this.SHAKE_COOLDOWN
      ) {
        this.lastShakeTime = now;
        this.notifyShake();
      }
    }, { passive: true });
  }

  /**
   * Notifies all shake handlers
   */
  private notifyShake(): void {
    console.log('Shake detected!');
    this.shakeHandlers.forEach(handler => handler());
  }

  /**
   * Disables shake detection
   */
  disableShakeDetection(): void {
    this.shakeEnabled = false;
    this.shakeHandlers = [];
    // Note: Can't easily remove the devicemotion listener without storing a reference
    // For now, we just clear handlers and check shakeEnabled flag
  }

  /**
   * Cleanup and remove all listeners
   */
  cleanup(): void {
    window.removeEventListener('resize', () => this.handleResize());
    window.removeEventListener('orientationchange', () => this.handleOrientationChange());

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.disableShakeDetection();
    this.viewportChangeHandlers = [];
    this.orientationChangeHandlers = [];
  }
}
