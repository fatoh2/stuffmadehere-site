/** Tracks recent pointer samples and returns the release velocity (px/s) over the last ~100 ms. */
export interface Sample {
  x: number;
  y: number;
  t: number;
}

export class VelocityTracker {
  private samples: Sample[] = [];
  private window: number;

  constructor(windowMs = 100) {
    this.window = windowMs;
  }

  reset(): void {
    this.samples.length = 0;
  }

  push(x: number, y: number, t = performance.now()): void {
    this.samples.push({ x, y, t });
    if (this.samples.length > 16) this.samples.shift();
  }

  last(): Sample | undefined {
    return this.samples[this.samples.length - 1];
  }

  velocity(now = performance.now()): { vx: number; vy: number } {
    const recent = this.samples.filter((s) => now - s.t <= this.window);
    if (recent.length < 2) return { vx: 0, vy: 0 };
    const a = recent[0];
    const b = recent[recent.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return { vx: 0, vy: 0 };
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  }
}

/** Pointer position in an element's own coordinate space, scaled to a logical size. */
export function localPoint(el: Element, e: { clientX: number; clientY: number }, w: number, h: number): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * w) / r.width, y: ((e.clientY - r.top) * h) / r.height };
}

export function capture(el: Element, e: PointerEvent): void {
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic or already released */
  }
}
