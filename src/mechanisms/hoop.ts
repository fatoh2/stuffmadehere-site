/** Mechanism 1: the hoop that won't let you miss.
 *  A two-axis rig on a rail predicts where a thrown ball will come down and drives there under
 *  motor limits (speed and acceleration per axis, no overshoot). From "Moving hoop won't let you
 *  miss" (2020) and "I made a ball seeking hoop" (2022). */
import { axis, stepAxis, clamp } from '../lib/motor';
import { fit, palette, metals, bar, tslot, disc, bolt } from '../lib/canvas';
import { sprite, drawSprite } from '../lib/sprites';
import { VelocityTracker, localPoint, capture } from '../lib/pointer';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion, narrow } from '../lib/visible';

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'fly' | 'made' | 'miss';
  apex: number | null;
  /** the intercept plane chosen for this ball; kept so the rig never dithers between two targets */
  plane: number | null;
  fired: boolean;
  auto?: boolean;
  /** seconds the ball has been lying on the floor; it fades out and is cleared after a moment */
  rest?: number;
}

export interface HoopOptions {
  canvas: HTMLCanvasElement;
  score: HTMLElement;
  rack?: HTMLElement | null;
  /** the text and controls at the bottom of the section; the rig stays above them */
  bottom?: HTMLElement | null;
  onCatch?: (ball: Ball) => void;
  startDelay?: number;
}

export interface HoopHandle {
  /** Launch a ball from a point (canvas coordinates) with a charge 0..1. */
  fire(x: number, y: number, charge: number): void;
  stats(): { made: number; shots: number };
}

const G = 1800;
const R = 13;

export function mountHoop(o: HoopOptions): HoopHandle {
  const cv = o.canvas;
  const P = palette();
  const M = metals();
  let W = 0;
  let H = 0;
  let ctx!: CanvasRenderingContext2D;
  let m = 32;
  const g = { railY: 0, x0: 0, x1: 0, xmin: 0, xmax: 0, ymin: 0, ymax: 0, homeX: 0, homeY: 0, pitchX: 0, pitchY: 0, rackX: 0, rackY: 0 };
  const rig = { x: axis(0, 4000, 24000), y: axis(0, 3400, 20000) };
  let tx = 0;
  let ty = 0;
  let rigYPrev = 0;
  const balls: Ball[] = [];
  let made = 0;
  let shots = 0;
  let lastThrow = 0;
  let flash = 0;
  let muzzle = 0;
  let muzzleAt = { x: 0, y: 0 };
  let pred: { x: number; y: number } | null = null;
  const misses: Record<string, number | boolean>[] = [];
  let visible = false;
  const still = reducedMotion();
  let drag: { tracker: VelocityTracker; x: number; y: number } | null = null;
  const pitch = { kick: 0, spin: 0 };
  const startAt = performance.now() + (o.startDelay ?? 1400);
  let phone = narrow();
  let rackVisible = false;

  function resize(): void {
    const f = fit(cv);
    W = f.w;
    H = f.h;
    ctx = f.ctx;
    phone = narrow();
    m = clamp(W * 0.022, 16, 32);
    g.railY = m + 56 + 14;
    g.x0 = m + 4;
    g.x1 = W - m - 4;
    g.xmin = g.x0 + 34;
    g.xmax = g.x1 - 34;
    g.ymin = g.railY + 100;
    const bottomH = o.bottom?.offsetHeight ?? (phone ? 250 : 180);
    g.ymax = Math.max(g.ymin + 80, H - bottomH - 90);
    g.homeX = W * 0.56;
    g.homeY = g.ymin + 30;
    g.pitchX = W - m - (phone ? 44 : 60);
    g.pitchY = Math.min(H * 0.52, g.ymax - 30);
    if (o.rack) {
      // on a phone the rack sits just above the text block (its first visible child, since the block
      // itself is stretched by the grid), never behind the title
      const first = o.bottom?.firstElementChild;
      if (phone && first) {
        const fr = first.getBoundingClientRect();
        const cr0 = cv.getBoundingClientRect();
        o.rack.style.bottom = `${Math.max(0, cr0.bottom - fr.top + 14)}px`;
      } else o.rack.style.bottom = '';
      const rr = o.rack.getBoundingClientRect();
      const cr = cv.getBoundingClientRect();
      g.rackX = rr.left - cr.left + rr.width / 2;
      g.rackY = rr.top - cr.top + rr.height / 2;
      rackVisible = rr.width > 0 && getComputedStyle(o.rack).display !== 'none';
    }
    if (rig.x.p === 0 && rig.y.p === 0) {
      rig.x.p = g.homeX;
      rig.y.p = g.homeY;
    }
  }
  resize();
  new ResizeObserver(resize).observe(cv);
  if (o.bottom) {
    const ro = new ResizeObserver(resize);
    ro.observe(o.bottom);
    Array.from(o.bottom.children).forEach((c) => ro.observe(c));
  }
  onVisible(cv, (v) => (visible = v), 0.2);

  /* ---------- throwing ---------- */
  function startDrag(e: PointerEvent, target: Element): void {
    if (e.button !== 0) return;
    capture(target, e);
    const p = localPoint(cv, e, W, H);
    const tracker = new VelocityTracker(110);
    tracker.push(p.x, p.y);
    drag = { tracker, x: p.x, y: p.y };
  }
  function moveDrag(e: PointerEvent): void {
    if (!drag) return;
    const p = localPoint(cv, e, W, H);
    drag.x = p.x;
    drag.y = p.y;
    drag.tracker.push(p.x, p.y);
  }
  function endDrag(): void {
    if (!drag) return;
    const { vx, vy } = drag.tracker.velocity();
    const x = drag.x;
    const y = drag.y;
    drag = null;
    const sp = Math.hypot(vx, vy);
    if (sp < 160) return;
    const cap = 2700;
    const k = sp > cap ? cap / sp : 1;
    throwBall(x, y, vx * k, vy * k, false);
  }
  function throwBall(x: number, y: number, vx: number, vy: number, fired: boolean): void {
    // a throw is capped so that even a wild flick stays inside the section, where the walls return it
    const speed = Math.hypot(vx, vy);
    const cap = 2400;
    if (speed > cap) {
      vx *= cap / speed;
      vy *= cap / speed;
    }
    balls.push({ x, y, vx, vy, state: 'fly', apex: null, plane: null, fired });
    shots++;
    lastThrow = performance.now();
    updateScore();
  }
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return; // a thumb scrolls; the rack is the touch target
    startDrag(e, cv);
  });
  if (o.rack) {
    o.rack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startDrag(e, o.rack!);
    });
  }
  window.addEventListener('pointermove', moveDrag, { passive: true });
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', () => (drag = null));

  function autoThrow(): void {
    // a real pitching machine is aimed: pick a landing point the rig can reach and solve the throw
    const x = g.pitchX - (phone ? 50 : 70);
    const y = g.pitchY;
    const plane = g.ymin + 20;
    const targetX = g.xmin + 40 + Math.random() * (g.xmax - g.xmin - 80);
    const vy = -(Math.sqrt(2 * G * Math.max(60, y - plane)) + 350 + Math.random() * 450);
    const T = (-vy + Math.sqrt(vy * vy + 2 * G * (plane - y))) / G;
    const vx = (targetX - x) / T;
    throwBall(x, y, vx, vy, false);
    balls[balls.length - 1].auto = true;
    pitch.kick = 1;
  }

  function predict(b: Ball, planeY: number): { x: number; t: number } | null {
    let x = b.x;
    let y = b.y;
    let vx = b.vx;
    let vy = b.vy;
    let t = 0;
    const dt = 1 / 120;
    for (let i = 0; i < 540; i++) {
      const py = y;
      vy += G * dt;
      x += vx * dt;
      y += vy * dt;
      t += dt;
      if (x < R) {
        x = R;
        vx = -vx * 0.7;
      } else if (x > W - R) {
        x = W - R;
        vx = -vx * 0.7;
      }
      if (y < R) {
        y = R;
        vy = -vy * 0.7;
      }
      if (vy > 0 && py <= planeY && y >= planeY) return { x, t };
      if (y > H + 60) return null;
    }
    return null;
  }

  (window as unknown as { __hoop: () => unknown }).__hoop = () => ({
    W, H, g, rig: { x: rig.x.p, y: rig.y.p, tx, ty }, pred, visible, still, made, shots, misses,
    balls: balls.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy), state: b.state, apex: b.apex, plane: b.plane })),
  });

  function updateScore(): void {
    o.score.innerHTML = shots ? `<b>${made}</b> of ${shots} caught` : '';
  }

  /* ---------- the loop ---------- */
  addTicker((dt, now) => {
    if (!visible && balls.length === 0 && !drag) return;
    // controller: pick the earliest-arriving live ball
    pred = null;
    let best: { x: number; t: number; plane: number } | null = null;
    for (const b of balls) {
      if (b.state !== 'fly') continue;
      if (b.apex == null) b.apex = b.vy < 0 ? b.y - (b.vy * b.vy) / (2 * G) : b.y;
      // the hoop meets the ball just below its apex; if that point is beyond the rail, it waits
      // for the ball lower down. The plane is chosen once per ball so the target never dithers.
      if (b.plane == null) {
        let bestReach = Infinity;
        for (const extra of [80, 170, 280, 420, Infinity]) {
          const candidate = clamp(b.apex + extra, g.ymin, g.ymax);
          const q = predict(b, candidate);
          if (!q) continue;
          const reach = Math.max(0, g.xmin - q.x, q.x - g.xmax);
          if (reach < bestReach) {
            bestReach = reach;
            b.plane = candidate;
          }
          if (reach === 0) break;
        }
      }
      if (b.plane == null) continue;
      const plane = b.plane;
      const p = predict(b, plane);
      if (!p) {
        b.plane = null; // the ball got past that plane: pick a lower one next frame and keep trying
        continue;
      }
      if (!best || p.t < best.t) best = { x: p.x, t: p.t, plane };
    }
    if (best) {
      tx = clamp(best.x, g.xmin, g.xmax);
      ty = best.plane;
      pred = { x: best.x, y: best.plane };
    } else {
      tx = g.homeX;
      ty = g.homeY;
    }
    if (!still || best) {
      stepAxis(rig.x, tx, dt);
      stepAxis(rig.y, ty, dt);
    }
    // balls
    for (const b of balls) {
      const py = b.y;
      b.vy += G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < R) {
        b.x = R;
        b.vx = -b.vx * 0.7;
      } else if (b.x > W - R) {
        b.x = W - R;
        b.vx = -b.vx * 0.7;
      }
      if (b.y < R) {
        b.y = R;
        b.vy = -b.vy * 0.7;
      }
      if (b.y > H - R) {
        // the floor: a dead-ish bounce, then the ball rolls out and lies there
        b.y = H - R;
        if (b.vy > 0) b.vy = b.vy > 120 ? -b.vy * 0.5 : 0;
        b.vx *= 0.96;
        if (b.vy === 0 && Math.abs(b.vx) < 30) {
          b.vx = 0;
          b.rest = (b.rest ?? 0) + dt;
          if (b.state === 'fly') {
            b.state = 'miss';
            misses.push({ floor: true, bx: Math.round(b.x), apex: Math.round(b.apex ?? 0), plane: Math.round(b.plane ?? -1), rigx: Math.round(rig.x.p), rigy: Math.round(rig.y.p), auto: !!b.auto });
          }
        }
      }
      // crossing is judged relative to the rim, so a rig diving faster than the ball cannot skip it
      if (b.state === 'fly' && b.vy > 0 && py - rigYPrev <= 0 && b.y - rig.y.p >= 0) {
        if (Math.abs(b.x - rig.x.p) < 38) {
          b.state = 'made';
          made++;
          flash = 1;
          updateScore();
          if (b.fired && o.onCatch) o.onCatch(b);
        } else {
          b.state = 'miss';
          misses.push({ bx: Math.round(b.x), rigx: Math.round(rig.x.p), rigy: Math.round(rig.y.p), tx: Math.round(tx), ty: Math.round(ty), auto: !!b.auto, vx: Math.round(b.vx) });
        }
      }
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.y > H + 80 || (b.rest ?? 0) > 1.4) {
        if (b.state === 'fly') misses.push({ fell: true, bx: Math.round(b.x), apex: Math.round(b.apex ?? 0), plane: Math.round(b.plane ?? -1), rigx: Math.round(rig.x.p), rigy: Math.round(rig.y.p), auto: !!b.auto });
        balls.splice(i, 1);
      }
    }
    rigYPrev = rig.y.p;
    flash = Math.max(0, flash - dt * 2.5);
    muzzle = Math.max(0, muzzle - dt * 4);
    pitch.kick = Math.max(0, pitch.kick - dt * 2.5);
    pitch.spin += dt * (6 + pitch.kick * 50);
    if (!still && visible && !drag && now > startAt && now - lastThrow > 4200 && !balls.some((b) => b.state === 'fly')) autoThrow();
    draw();
  });

  /* ---------- drawing ---------- */
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    const rx = rig.x.p;
    const ry = rig.y.p;
    const hoopImg = sprite('hoop');
    const carImg = sprite('carriage');
    const pitchImg = sprite('pitcher');
    // the hoop render hangs from a bracket 97px left of and 34px above the rim centre
    const hs = phone ? 104 / 140 : 1; // the hoop render's scale
    const slideX = hoopImg ? rx - 97 * hs : rx;
    const slideEnd = hoopImg ? ry - 34 * hs : ry - 22;
    // vertical slide, behind the rail
    bar(ctx, slideX - 5, g.railY, 10, Math.max(0, slideEnd - g.railY), M.steel, 2);
    // rail: a T-slot extrusion from end block to end block
    tslot(ctx, g.x0, g.railY - 7, g.x1 - g.x0, 14, M.anod);
    bar(ctx, g.x0 - 6, g.railY - 12, 12, 24, M.alu, 2);
    bar(ctx, g.x1 - 6, g.railY - 12, 12, 24, M.alu, 2);
    bolt(ctx, g.x0, g.railY, 3, M.steel);
    bolt(ctx, g.x1, g.railY, 3, M.steel);
    // carriage riding on the rail
    if (carImg) drawSprite(ctx, carImg, slideX, g.railY - 6, phone ? 44 : 58, 0.5, 1);
    else {
      bar(ctx, slideX - 30, g.railY - 20, 60, 20, M.anod, 3);
      bolt(ctx, slideX - 20, g.railY - 10, 3, M.steel);
      bolt(ctx, slideX + 20, g.railY - 10, 3, M.steel);
    }
    // balls already through the rim fall behind the net
    for (const b of balls) if (b.state !== 'fly' && b.y > ry) drawBall(b);
    // the hoop
    if (hoopImg) {
      drawSprite(ctx, hoopImg, rx, ry, phone ? 104 : 140, 0.695, 0.6);
    } else {
      bar(ctx, rx - 12, ry - 22, 24, 16, M.alu, 2);
      bar(ctx, rx + 34, ry - 66, 8, 74, M.alu, 1);
      ctx.strokeStyle = M.steel.face;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(rx + i * 10, ry + 3);
        ctx.lineTo(rx + i * 5.5, ry + 40);
        ctx.stroke();
      }
      ctx.strokeStyle = flash > 0 ? P.ink : P.ball;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(rx - 33, ry);
      ctx.lineTo(rx + 33, ry);
      ctx.stroke();
    }
    if (flash > 0) {
      ctx.strokeStyle = P.ink;
      ctx.globalAlpha = flash * 0.9;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 46, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // predicted intercept
    if (pred) {
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pred.x, pred.y, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pred.x - 16, pred.y);
      ctx.lineTo(pred.x + 16, pred.y);
      ctx.moveTo(pred.x, pred.y - 16);
      ctx.lineTo(pred.x, pred.y + 16);
      ctx.stroke();
    }
    // pitching machine
    if (!still) {
      const x = g.pitchX;
      const y = g.pitchY;
      if (pitchImg) drawSprite(ctx, pitchImg, x, y, phone ? 120 : 170, 0.492, 0.472);
      else {
        bar(ctx, x - 26, y + 14, 52, 26, M.anod, 3);
        for (const off of [-13, 13]) {
          ctx.save();
          ctx.translate(x + off, y);
          ctx.rotate(pitch.spin * (off > 0 ? 1 : -1));
          disc(ctx, 0, 0, 12, M.alu, 3);
          ctx.restore();
        }
      }
      if (pitch.kick > 0) {
        ctx.strokeStyle = P.ball;
        ctx.globalAlpha = pitch.kick * 0.6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x - 70, y, 16 + (1 - pitch.kick) * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (muzzle > 0) {
      ctx.fillStyle = P.ball;
      ctx.globalAlpha = muzzle * 0.8;
      ctx.beginPath();
      ctx.arc(muzzleAt.x, muzzleAt.y, 14 + (1 - muzzle) * 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (rackVisible && !drag) ball(g.rackX, g.rackY, P.ball);
    for (const b of balls) if (b.state === 'fly' || b.y <= ry) drawBall(b);
    if (drag) ball(drag.x, drag.y, P.ball);
  }
  function drawBall(b: Ball): void {
    ctx.globalAlpha = b.rest ? Math.max(0, 1 - b.rest / 1.4) : 1;
    ball(b.x, b.y, b.state === 'miss' ? P.steelDark : P.ball);
    ctx.globalAlpha = 1;
  }
  function ball(x: number, y: number, fill: string): void {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = P.bg;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, R - 4, 0.4, 2.7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  return {
    fire(x, y, charge) {
      muzzle = 1;
      muzzleAt = { x, y };
      const vx = -(350 + 900 * charge) * (phone ? 0.55 : 1);
      const vy = -(1000 + 950 * charge) * (phone ? 0.8 : 1);
      throwBall(x, y, vx, vy, true);
    },
    stats: () => ({ made, shots }),
  };
}
