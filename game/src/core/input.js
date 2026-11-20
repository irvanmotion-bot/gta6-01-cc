// Keyboard and mouse state: held keys, keys pressed this frame, mouse look deltas and pointer lock.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.buttons = [false, false, false];
    this.buttonPressed = [false, false, false];
    this.locked = false;
    this.enabled = false;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this.onMouseButton(e, true));
    window.addEventListener('mouseup', (e) => this.onMouseButton(e, false));
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
  }

  onKey(event, down) {
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
    if (down) {
      if (!event.repeat) this.pressed.add(event.code);
      this.held.add(event.code);
    } else {
      this.held.delete(event.code);
    }
  }

  onMouseMove(event) {
    if (!this.enabled) return;
    if (this.locked || this.buttons[2]) {
      this.mouseDX += event.movementX || 0;
      this.mouseDY += event.movementY || 0;
    }
  }

  onMouseButton(event, down) {
    if (event.button > 2) return;
    if (down && this.enabled && !this.locked) this.requestLock();
    if (down && !this.buttons[event.button]) this.buttonPressed[event.button] = true;
    this.buttons[event.button] = down;
  }

  requestLock() {
    try {
      const wait = this.canvas.requestPointerLock();
      if (wait && wait.catch) wait.catch(() => {});
    } catch (error) {
      // Pointer lock is optional: without it, right-drag looks around and clicks still shoot.
      this.lockUnavailable = true;
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  releaseAll() {
    this.held.clear();
    this.buttons = [false, false, false];
  }

  isHeld(...codes) {
    return codes.some((code) => this.held.has(code));
  }

  wasPressed(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  /** -1, 0 or 1 from a pair of opposing keys. */
  axis(negativeCodes, positiveCodes) {
    return (this.isHeld(...positiveCodes) ? 1 : 0) - (this.isHeld(...negativeCodes) ? 1 : 0);
  }

  /** Clear the per-frame state; called once at the end of every frame. */
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.buttonPressed = [false, false, false];
  }
}
