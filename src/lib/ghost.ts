/** A ghost gesture: a pointer ring that performs the machine's own drag once, so a visitor sees what
 *  their hand could do. It appears, drags along a path at a flick's pace, releases (the machine then
 *  does the real thing with the ring's velocity) and fades. Drawn by the machine on its own canvas. */
export interface GhostState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** seconds the drag takes */
  dur: number;
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  released: boolean;
  /** seconds since release, for the fade */
  gone: number;
  done: boolean;
  trail: { x: number; y: number }[];
  onRelease: (g: GhostState) => void;
}

const APPEAR = 0.35; // the ring settles on the start point before it moves
const FADE = 0.45;

export function startGhost(x0: number, y0: number, x1: number, y1: number, dur: number, onRelease: (g: GhostState) => void): GhostState {
  return { x0, y0, x1, y1, dur, t: -APPEAR, x: x0, y: y0, vx: 0, vy: 0, released: false, gone: 0, done: false, trail: [], onRelease };
}

/** ease: slow start, fast finish, the way a flick goes */
const ease = (p: number): number => p * p;

export function stepGhost(g: GhostState, dt: number): void {
  if (g.done) return;
  if (g.released) {
    g.gone += dt;
    if (g.gone > FADE) g.done = true;
    return;
  }
  const t0 = g.t;
  g.t += dt;
  if (g.t <= 0) return;
  const p = Math.min(1, g.t / g.dur);
  const e = ease(p);
  const px = g.x;
  const py = g.y;
  g.x = g.x0 + (g.x1 - g.x0) * e;
  g.y = g.y0 + (g.y1 - g.y0) * e;
  const step = Math.max(1e-3, g.t - Math.max(0, t0));
  g.vx = (g.x - px) / step;
  g.vy = (g.y - py) / step;
  const last = g.trail[g.trail.length - 1];
  if (!last || Math.hypot(last.x - g.x, last.y - g.y) > 6) g.trail.push({ x: g.x, y: g.y });
  if (p >= 1) {
    g.released = true;
    g.onRelease(g);
  }
}

export function drawGhost(ctx: CanvasRenderingContext2D, g: GhostState, ink = '#ffffff'): void {
  if (g.done) return;
  const appear = g.t < 0 ? 1 - Math.min(1, -g.t / APPEAR) : 1;
  const fade = g.released ? 1 - Math.min(1, g.gone / FADE) : 1;
  const a = appear * fade;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  if (g.trail.length > 1) {
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(g.trail[0].x, g.trail[0].y);
    for (const p of g.trail) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // the ring: a fingertip's footprint, pressed while dragging, lifting as it lets go
  const r = g.released ? 16 + g.gone * 60 : g.t < 0 ? 26 - 10 * (1 + g.t / APPEAR) : 16;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
  ctx.stroke();
  if (!g.released) {
    ctx.beginPath();
    ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
