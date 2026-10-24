/** Sign small, engrave big. A pantograph: four bars in a parallelogram, one pivot fixed, so the tracer
 *  you move and the pen at the far end stay in line with the pivot and the pen travels k times as far.
 *  Draw on the small pad and the linkage engraves it k times larger on the plate. Left alone, the
 *  machine signs the channel's name first, in single-stroke letters. New. */
import { bar, bolt, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { localPoint, capture } from '../lib/pointer';
import { narrow, onVisible, reducedMotion } from '../lib/visible';
import { strokesFor, textWidth } from './strokefont';

export interface PantographHandle {
  clear(): void;
}

export function mountPantograph(cv: HTMLCanvasElement): PantographHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let k = 3; // enlargement
  let s = 100; // bar length
  let O = { x: 0, y: 0 }; // the fixed pivot
  let pad = { x: 0, y: 0, w: 10, h: 10 }; // where you draw
  let plate = { x: 0, y: 0, w: 10, h: 10 }; // where the pen engraves
  const ink = document.createElement('canvas'); // the engraving, kept between frames
  let ictx = ink.getContext('2d')!;
  const tracer = { x: 0, y: 0, down: false };
  let last: { x: number; y: number } | null = null;
  let visible = true;
  let userDrawing = false;
  let lastUser = -1e9;
  // the demo: the machine signs the name once, stroke by stroke
  let demo: { strokes: number[][][]; si: number; pi: number; t: number; done: boolean } | null = null;

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    k = narrow() ? 2 : 3;
    const margin = 24;
    // O on the left; the pad a bar-length to its right; the plate k bar-lengths out
    s = Math.min((W - 2 * margin) / (k + 1.5), (H - 2 * margin) / 2.1);
    O = { x: margin + s * 0.25, y: H * 0.5 };
    const padSide = s * (k === 3 ? 0.62 : 0.9);
    pad = { x: O.x + s * 1.0 - padSide / 2, y: O.y - padSide / 2, w: padSide, h: padSide };
    plate = { x: O.x + k * (pad.x - O.x), y: O.y + k * (pad.y - O.y), w: padSide * k, h: padSide * k };
    const f2 = fit(ink, Math.round(plate.w), Math.round(plate.h));
    ictx = f2.ctx;
    tracer.x = pad.x + pad.w / 2;
    tracer.y = pad.y + pad.h / 2;
    last = null;
  };
  new ResizeObserver(layout).observe(cv);
  layout();

  /* ---------- the linkage, solved from the tracer ---------- */
  function solve(bx: number, by: number): { A: [number, number]; C: [number, number]; D: [number, number]; Q: [number, number] } | null {
    // parallelogram D-A-B-C with B the tracer; O on the line D->A beyond A, Q on the line D->C beyond C
    const alpha = 1 / (k - 1);
    const wx = O.x - bx;
    const wy = O.y - by;
    const wl = Math.hypot(wx, wy);
    if (wl < 1) return null;
    const rhs = (alpha * alpha * s * s + wl * wl - s * s) / (2 * alpha);
    const c = rhs / (s * wl);
    if (c < -1 || c > 1) return null;
    const phi = Math.atan2(wy, wx);
    const theta = phi - Math.acos(c);
    const ux = s * Math.cos(theta);
    const uy = s * Math.sin(theta);
    const vx = alpha * ux - wx;
    const vy = alpha * uy - wy;
    const D: [number, number] = [bx - ux - vx, by - uy - vy];
    const A: [number, number] = [bx - vx, by - vy];
    const C: [number, number] = [bx - ux, by - uy];
    const Q: [number, number] = [O.x + k * (bx - O.x), O.y + k * (by - O.y)];
    return { A, C, D, Q };
  }

  const engrave = (x: number, y: number, pen: boolean): void => {
    // the pen's mark on the plate, in plate coordinates, k times the tracer's move
    const px = O.x + k * (x - O.x) - plate.x;
    const py = O.y + k * (y - O.y) - plate.y;
    if (pen && last) {
      ictx.strokeStyle = P.ink;
      ictx.lineWidth = Math.max(2, s * 0.022);
      ictx.lineCap = 'round';
      ictx.lineJoin = 'round';
      ictx.beginPath();
      ictx.moveTo(last.x, last.y);
      ictx.lineTo(px, py);
      ictx.stroke();
    }
    last = pen ? { x: px, y: py } : null;
  };

  const inPad = (x: number, y: number): boolean => x >= pad.x && x <= pad.x + pad.w && y >= pad.y && y <= pad.y + pad.h;
  const clampPad = (x: number, y: number): [number, number] => [Math.max(pad.x, Math.min(pad.x + pad.w, x)), Math.max(pad.y, Math.min(pad.y + pad.h, y))];

  cv.addEventListener('pointerdown', (e) => {
    const p = localPoint(cv, e, W, H);
    if (!inPad(p.x, p.y)) return;
    capture(cv, e);
    e.preventDefault();
    demo = null;
    userDrawing = true;
    lastUser = performance.now();
    const [x, y] = clampPad(p.x, p.y);
    tracer.x = x;
    tracer.y = y;
    tracer.down = true;
    last = null;
    engrave(x, y, true);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!userDrawing) return;
    const p = localPoint(cv, e, W, H);
    const [x, y] = clampPad(p.x, p.y);
    tracer.x = x;
    tracer.y = y;
    lastUser = performance.now();
    engrave(x, y, true);
  });
  const up = (): void => {
    if (!userDrawing) return;
    userDrawing = false;
    tracer.down = false;
    last = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  function startDemo(): void {
    const text = narrow() ? 'SMH' : 'STUFF MADE HERE';
    const size = Math.min(pad.h * 0.3, (pad.w * 0.9) / Math.max(1, textWidth(text, 1)));
    const lines = narrow() ? [text] : ['STUFF', 'MADE', 'HERE'];
    const strokes: number[][][] = [];
    const lineH = size * 1.5;
    lines.forEach((ln, i) => {
      const w = textWidth(ln, size);
      const x0 = pad.x + (pad.w - w) / 2;
      const y0 = pad.y + pad.h / 2 + (i - (lines.length - 1) / 2) * lineH + size * 0.4;
      strokes.push(...strokesFor(ln, x0, y0, size));
    });
    demo = { strokes, si: 0, pi: 0, t: 0, done: false };
    last = null;
  }

  function stepDemo(dt: number): void {
    if (!demo || demo.done) return;
    const speed = s * 1.6; // px/s at the tracer
    let budget = speed * dt;
    while (budget > 0 && !demo.done) {
      const stroke = demo.strokes[demo.si];
      if (!stroke || stroke.length < 2) {
        demo.si++;
        if (demo.si >= demo.strokes.length) demo.done = true;
        continue;
      }
      if (demo.pi === 0) {
        // travel to the start of the stroke with the pen up
        const [tx, ty] = stroke[0];
        const d = Math.hypot(tx - tracer.x, ty - tracer.y);
        if (d > budget) {
          tracer.x += ((tx - tracer.x) / d) * budget;
          tracer.y += ((ty - tracer.y) / d) * budget;
          tracer.down = false;
          engrave(tracer.x, tracer.y, false);
          budget = 0;
          break;
        }
        tracer.x = tx;
        tracer.y = ty;
        budget -= d;
        tracer.down = true;
        last = null;
        engrave(tx, ty, true);
        demo.pi = 1;
        continue;
      }
      const [tx, ty] = stroke[demo.pi];
      const d = Math.hypot(tx - tracer.x, ty - tracer.y);
      if (d > budget) {
        tracer.x += ((tx - tracer.x) / d) * budget;
        tracer.y += ((ty - tracer.y) / d) * budget;
        engrave(tracer.x, tracer.y, true);
        budget = 0;
        break;
      }
      tracer.x = tx;
      tracer.y = ty;
      budget -= d;
      engrave(tx, ty, true);
      demo.pi++;
      if (demo.pi >= stroke.length) {
        demo.si++;
        demo.pi = 0;
        tracer.down = false;
        last = null;
        if (demo.si >= demo.strokes.length) demo.done = true;
      }
    }
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    // the plate and the engraving on it
    ctx.fillStyle = '#f3f3f0';
    ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
    ctx.drawImage(ink, plate.x, plate.y, plate.w, plate.h);
    bolt(ctx, plate.x + 10, plate.y + 10, 4, M.steel);
    bolt(ctx, plate.x + plate.w - 10, plate.y + 10, 4, M.steel);
    bolt(ctx, plate.x + 10, plate.y + plate.h - 10, 4, M.steel);
    bolt(ctx, plate.x + plate.w - 10, plate.y + plate.h - 10, 4, M.steel);
    // the pad, with the small drawing shown faintly (the plate's ink scaled down)
    ctx.fillStyle = P.recess;
    ctx.fillRect(pad.x - 6, pad.y - 6, pad.w + 12, pad.h + 12);
    ctx.fillStyle = '#e4e5e1';
    ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(ink, pad.x, pad.y, pad.w, pad.h);
    ctx.globalAlpha = 1;
    // the linkage
    const sol = solve(tracer.x, tracer.y);
    if (sol) {
      const { A, C, D, Q } = sol;
      const link = (x1: number, y1: number, x2: number, y2: number, wdt: number, m = M.alu): void => {
        const L = Math.hypot(x2 - x1, y2 - y1);
        ctx.save();
        ctx.translate(x1, y1);
        ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
        bar(ctx, -wdt / 2, -wdt / 2, L + wdt, wdt, m, wdt / 2);
        ctx.restore();
      };
      const wdt = Math.max(6, s * 0.06);
      link(O.x, O.y, D[0], D[1], wdt, M.anod); // the long bar through A
      link(D[0], D[1], Q[0], Q[1], wdt, M.anod); // the long bar through C
      link(A[0], A[1], tracer.x, tracer.y, wdt * 0.8); // short bar A-B
      link(C[0], C[1], tracer.x, tracer.y, wdt * 0.8); // short bar C-B
      for (const [x, y] of [A, C, D]) bolt(ctx, x, y, wdt * 0.42, M.steel);
      // the fixed pivot on its post
      disc(ctx, O.x, O.y, wdt * 0.9, M.steel, wdt * 0.3);
      // the tracer stylus you hold, and the pen that does the work
      disc(ctx, tracer.x, tracer.y, wdt * 0.7, tracer.down ? M.anod : M.alu, wdt * 0.2);
      ctx.fillStyle = tracer.down || userDrawing ? P.accent : P.steelDark;
      ctx.beginPath();
      ctx.arc(Q[0], Q[1], wdt * 0.55, 0, Math.PI * 2);
      ctx.fill();
      disc(ctx, Q[0], Q[1], wdt * 0.3, M.steel);
    }
  }

  if (reducedMotion()) {
    startDemo();
    const demoDone = (): boolean => !demo || demo.done;
    for (let i = 0; i < 4000 && !demoDone(); i++) stepDemo(0.05);
    draw();
    return { clear: () => undefined };
  }
  onVisible(cv, (v) => (visible = v), 0.15);
  let started = false;
  addTicker((dt, now) => {
    if (!visible) return;
    if (!started) {
      started = true;
      startDemo();
    }
    if (!userDrawing && now - lastUser > 300) stepDemo(dt);
    draw();
  });

  return {
    clear() {
      ictx.clearRect(0, 0, plate.w, plate.h);
      last = null;
      demo = null;
      tracer.down = false;
    },
  };
}
