// Lanternfall — keyboard and mouse state. One file, one job: it turns raw
// browser events into a small, testable input snapshot the game reads.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.consumed = new Set();
    this.canvas = canvas;
    this.onKey = null;
    this.onClick = null;
    this.attach(canvas);
  }

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this.keys.add(e.key.toLowerCase());
        if (this.onKey) this.onKey(e.key.toLowerCase());
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      this.mouse.clicked = true;
      if (this.onClick) this.onClick(this.mouse.x, this.mouse.y);
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  // Movement vector from WASD or arrow keys, normalised.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // True once for a key pressed since the last frame; callers consume it.
  pressed(key) {
    const k = key.toLowerCase();
    if (this.keys.has(k) && !this.consumed.has(k)) {
      this.consumed.add(k);
      return true;
    }
    return false;
  }

  endFrame() {
    this.consumed.clear();
    this.mouse.clicked = false;
  }
}
